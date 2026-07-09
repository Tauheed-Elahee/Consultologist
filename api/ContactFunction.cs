using System.Collections.Concurrent;
using System.Net;
using System.Net.Http.Json;
using Api.Models;
using Azure;
using Azure.Communication.Email;
using Microsoft.Azure.Functions.Worker;
using Microsoft.Azure.Functions.Worker.Http;
using Microsoft.Extensions.Logging;

namespace Api;

public class ContactFunction(ILogger<ContactFunction> logger, IHttpClientFactory httpClientFactory)
{
    // Only name and email are required: the form serves waitlist signups,
    // general inquiries, and privacy requests, so everything else is optional.
    private static readonly string[] RequiredFields = ["Name", "Email"];

    private const int MinFillMilliseconds = 3000;
    private const int MaxShortFieldLength = 200;
    private const int MaxCommentsLength = 5000;
    private const int RateLimitMaxRequests = 5;
    private static readonly TimeSpan RateLimitWindow = TimeSpan.FromMinutes(10);
    private static readonly ConcurrentDictionary<string, List<DateTimeOffset>> RequestLog = new();

    private const string SuccessMessage = "Request sent successfully. Our team will reach out shortly.";

    [Function("contact")]
    public async Task<HttpResponseData> Run(
        [HttpTrigger(AuthorizationLevel.Anonymous, "post")] HttpRequestData req)
    {
        logger.LogInformation("Contact function invoked");

        var connectionString = Environment.GetEnvironmentVariable("ACS_CONNECTION_STRING");
        var senderAddress = Environment.GetEnvironmentVariable("ACS_SENDER_ADDRESS");
        var recipientAddress = Environment.GetEnvironmentVariable("ACS_CONTACT_RECIPIENT") ?? senderAddress;

        if (string.IsNullOrWhiteSpace(connectionString) ||
            string.IsNullOrWhiteSpace(senderAddress) ||
            string.IsNullOrWhiteSpace(recipientAddress))
        {
            logger.LogError("ACS configuration missing. Ensure ACS_CONNECTION_STRING, ACS_SENDER_ADDRESS, and ACS_CONTACT_RECIPIENT are set.");
            return await WriteJsonResponse(req, HttpStatusCode.InternalServerError, new
            {
                error = "Azure Communication Services is not configured. Please verify your connection string and sender settings."
            });
        }

        ContactRequest? payload;
        try
        {
            payload = await req.ReadFromJsonAsync<ContactRequest>();
        }
        catch
        {
            payload = null;
        }

        if (payload is null)
        {
            return await WriteJsonResponse(req, HttpStatusCode.BadRequest, new { error = "Invalid request body." });
        }

        var clientIp = GetClientIp(req);

        // Honeypot: real users never fill this field. Answer with a fake
        // success so bots don't learn they were detected.
        if (!string.IsNullOrWhiteSpace(payload.Website))
        {
            logger.LogWarning("Spam rejected (honeypot) from {ClientIp}", clientIp);
            return await WriteJsonResponse(req, HttpStatusCode.OK, new { message = SuccessMessage });
        }

        // Time trap: humans take longer than a few seconds to fill five fields.
        if (payload.ElapsedMs is null || payload.ElapsedMs < MinFillMilliseconds)
        {
            logger.LogWarning("Spam rejected (time trap, {ElapsedMs} ms) from {ClientIp}", payload.ElapsedMs, clientIp);
            return await WriteJsonResponse(req, HttpStatusCode.OK, new { message = SuccessMessage });
        }

        var missingFields = RequiredFields
            .Where(field => string.IsNullOrWhiteSpace(GetField(payload, field)))
            .ToList();

        if (missingFields.Count > 0)
        {
            return await WriteJsonResponse(req, HttpStatusCode.BadRequest, new
            {
                error = $"Missing fields: {string.Join(", ", missingFields)}"
            });
        }

        if (payload.Name.Length > MaxShortFieldLength ||
            payload.Email.Length > MaxShortFieldLength ||
            payload.Specialty.Length > MaxShortFieldLength ||
            payload.Organization.Length > MaxShortFieldLength ||
            payload.Comments.Length > MaxCommentsLength)
        {
            return await WriteJsonResponse(req, HttpStatusCode.BadRequest, new { error = "One or more fields exceed the allowed length." });
        }

        if (IsRateLimited(clientIp))
        {
            logger.LogWarning("Rate limit exceeded for {ClientIp}", clientIp);
            return await WriteJsonResponse(req, (HttpStatusCode)429, new { error = "Too many requests. Please try again later." });
        }

        if (!await VerifyTurnstileAsync(payload.TurnstileToken, clientIp))
        {
            return await WriteJsonResponse(req, HttpStatusCode.BadRequest, new
            {
                error = "We could not verify that you are human. Please try again."
            });
        }

        try
        {
            var emailClient = new EmailClient(connectionString);
            var message = new EmailMessage(
                senderAddress: senderAddress,
                recipientAddress: recipientAddress,
                content: new EmailContent($"Consultologist contact from {payload.Name}")
                {
                    PlainText = BuildPlainText(payload),
                    Html = BuildHtml(payload)
                });
            message.ReplyTo.Add(new EmailAddress(payload.Email));

            var operation = await emailClient.SendAsync(WaitUntil.Completed, message);

            return await WriteJsonResponse(req, HttpStatusCode.OK, new
            {
                message = SuccessMessage,
                operationId = operation.Id
            });
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Failed to send ACS email");
            return await WriteJsonResponse(req, HttpStatusCode.InternalServerError, new
            {
                error = "We were unable to relay your request. Please verify your ACS credentials and try again."
            });
        }
    }

    private static string GetClientIp(HttpRequestData req)
    {
        if (req.Headers.TryGetValues("x-forwarded-for", out var values))
        {
            var first = values.FirstOrDefault()?.Split(',')[0].Trim();
            if (!string.IsNullOrEmpty(first))
            {
                // Strip a port suffix if present (e.g. "1.2.3.4:5678").
                var portIndex = first.LastIndexOf(':');
                if (portIndex > 0 && first.Count(c => c == ':') == 1)
                {
                    first = first[..portIndex];
                }
                return first;
            }
        }
        return "unknown";
    }

    private static bool IsRateLimited(string clientIp)
    {
        var now = DateTimeOffset.UtcNow;
        var entries = RequestLog.GetOrAdd(clientIp, _ => []);
        lock (entries)
        {
            entries.RemoveAll(t => now - t > RateLimitWindow);
            if (entries.Count >= RateLimitMaxRequests)
            {
                return true;
            }
            entries.Add(now);
            return false;
        }
    }

    private async Task<bool> VerifyTurnstileAsync(string token, string clientIp)
    {
        var secret = Environment.GetEnvironmentVariable("TURNSTILE_SECRET_KEY");
        if (string.IsNullOrWhiteSpace(secret))
        {
            logger.LogWarning("TURNSTILE_SECRET_KEY not configured — skipping Turnstile verification");
            return true;
        }

        if (string.IsNullOrWhiteSpace(token))
        {
            logger.LogWarning("Spam rejected (missing Turnstile token) from {ClientIp}", clientIp);
            return false;
        }

        try
        {
            var client = httpClientFactory.CreateClient("turnstile");
            client.Timeout = TimeSpan.FromSeconds(5);
            var response = await client.PostAsync(
                "https://challenges.cloudflare.com/turnstile/v0/siteverify",
                new FormUrlEncodedContent(new Dictionary<string, string>
                {
                    ["secret"] = secret,
                    ["response"] = token,
                    ["remoteip"] = clientIp
                }));
            var result = await response.Content.ReadFromJsonAsync<TurnstileVerifyResponse>();
            if (result?.Success != true)
            {
                logger.LogWarning("Spam rejected (Turnstile failed: {Errors}) from {ClientIp}",
                    string.Join(", ", result?.ErrorCodes ?? []), clientIp);
                return false;
            }
            return true;
        }
        catch (Exception ex)
        {
            // Fail open: losing a waitlist signup costs more than letting one
            // submission through while Cloudflare is unreachable.
            logger.LogError(ex, "Turnstile siteverify unreachable — allowing submission");
            return true;
        }
    }

    private sealed class TurnstileVerifyResponse
    {
        [System.Text.Json.Serialization.JsonPropertyName("success")]
        public bool Success { get; set; }

        [System.Text.Json.Serialization.JsonPropertyName("error-codes")]
        public string[] ErrorCodes { get; set; } = [];
    }

    private static string? GetField(ContactRequest payload, string field) => field switch
    {
        "Name" => payload.Name,
        "Email" => payload.Email,
        "Specialty" => payload.Specialty,
        "Organization" => payload.Organization,
        "Comments" => payload.Comments,
        _ => null
    };

    private static string Escape(string value) => WebUtility.HtmlEncode(value);

    private static string BuildPlainText(ContactRequest p)
    {
        var sb = new System.Text.StringBuilder();
        sb.AppendLine("New Consultologist contact request");
        sb.AppendLine($"Name: {p.Name}");
        sb.AppendLine($"Email: {p.Email}");
        sb.AppendLine($"Specialty: {p.Specialty}");
        sb.AppendLine($"Clinic/Organization: {p.Organization}");
        sb.AppendLine();
        sb.AppendLine("Comments:");
        sb.AppendLine(p.Comments);
        return sb.ToString();
    }

    private static string BuildHtml(ContactRequest p)
    {
        var sb = new System.Text.StringBuilder();
        sb.AppendLine("<h2>New Consultologist contact request</h2>");
        sb.AppendLine($"<p><strong>Name:</strong> {Escape(p.Name)}</p>");
        sb.AppendLine($"<p><strong>Email:</strong> {Escape(p.Email)}</p>");
        sb.AppendLine($"<p><strong>Specialty:</strong> {Escape(p.Specialty)}</p>");
        sb.AppendLine($"<p><strong>Clinic or Organization:</strong> {Escape(p.Organization)}</p>");
        sb.AppendLine($"<p><strong>Comments:</strong></p>");
        sb.AppendLine($"<p>{Escape(p.Comments).Replace("\n", "<br />")}</p>");
        return sb.ToString();
    }

    private static async Task<HttpResponseData> WriteJsonResponse(HttpRequestData req, HttpStatusCode status, object body)
    {
        var response = req.CreateResponse(status);
        await response.WriteAsJsonAsync(body);
        return response;
    }
}
