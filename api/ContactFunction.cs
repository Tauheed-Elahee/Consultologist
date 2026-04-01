using System.Globalization;
using System.Net;
using Api.Models;
using Azure;
using Azure.Communication.Email;
using Microsoft.Azure.Functions.Worker;
using Microsoft.Azure.Functions.Worker.Http;
using Microsoft.Extensions.Logging;

namespace Api;

public class ContactFunction(ILogger<ContactFunction> logger)
{
    private static readonly string[] RequiredFields = ["Name", "Email", "Specialty", "Organization", "Comments"];

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

        var contract = SanitizeContract(payload.Contract);

        try
        {
            var emailClient = new EmailClient(connectionString);
            var message = new EmailMessage(
                senderAddress: senderAddress,
                recipientAddress: recipientAddress,
                content: new EmailContent($"Consultologist contact from {payload.Name}")
                {
                    PlainText = BuildPlainText(payload, contract),
                    Html = BuildHtml(payload, contract)
                });
            message.ReplyTo.Add(new EmailAddress(payload.Email));

            var operation = await emailClient.SendAsync(WaitUntil.Completed, message);

            return await WriteJsonResponse(req, HttpStatusCode.OK, new
            {
                message = "Request sent successfully. Our team will reach out shortly.",
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

    private static string? GetField(ContactRequest payload, string field) => field switch
    {
        "Name" => payload.Name,
        "Email" => payload.Email,
        "Specialty" => payload.Specialty,
        "Organization" => payload.Organization,
        "Comments" => payload.Comments,
        _ => null
    };

    private static ContractSummary? SanitizeContract(ContractSummary? raw)
    {
        if (raw is null) return null;

        var items = raw.Items
            .Where(item => !string.IsNullOrWhiteSpace(item.PlanName) && item.AdjustedMonthly.HasValue)
            .Select(item => new ContractItem
            {
                PlanName = item.PlanName,
                Percentage = item.Percentage,
                Fte = item.Fte,
                BasePrice = item.BasePrice,
                AdjustedMonthly = item.AdjustedMonthly
            })
            .ToList();

        if (items.Count == 0) return null;

        var total = raw.TotalMonthly ?? items.Sum(i => i.AdjustedMonthly ?? 0);
        return new ContractSummary { Items = items, TotalMonthly = total };
    }

    private static string FormatCurrency(decimal? value) =>
        (value ?? 0).ToString("C2", CultureInfo.GetCultureInfo("en-US"));

    private static string Escape(string value) => WebUtility.HtmlEncode(value);

    private static string BuildPlainText(ContactRequest p, ContractSummary? contract)
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

        if (contract is not null)
        {
            sb.AppendLine();
            sb.AppendLine("Contract Summary:");
            foreach (var item in contract.Items)
            {
                var utilization = item.Fte.HasValue
                    ? $"{item.Fte} FTE"
                    : item.Percentage.HasValue
                        ? $"{item.Percentage}%"
                        : "-";
                sb.AppendLine($"- {item.PlanName} ({utilization}): {FormatCurrency(item.AdjustedMonthly)}/month");
            }
            sb.AppendLine($"Total: {FormatCurrency(contract.TotalMonthly)}/month");
        }

        return sb.ToString();
    }

    private static string BuildHtml(ContactRequest p, ContractSummary? contract)
    {
        var sb = new System.Text.StringBuilder();
        sb.AppendLine("<h2>New Consultologist contact request</h2>");
        sb.AppendLine($"<p><strong>Name:</strong> {Escape(p.Name)}</p>");
        sb.AppendLine($"<p><strong>Email:</strong> {Escape(p.Email)}</p>");
        sb.AppendLine($"<p><strong>Specialty:</strong> {Escape(p.Specialty)}</p>");
        sb.AppendLine($"<p><strong>Clinic or Organization:</strong> {Escape(p.Organization)}</p>");
        sb.AppendLine($"<p><strong>Comments:</strong></p>");
        sb.AppendLine($"<p>{Escape(p.Comments).Replace("\n", "<br />")}</p>");

        if (contract is not null)
        {
            sb.AppendLine("<h3 style=\"margin-top:1.5rem;\">Contract Summary</h3>");
            sb.AppendLine("<table style=\"border-collapse:collapse;width:100%;margin-top:0.5rem\">");
            sb.AppendLine("<thead><tr>");
            sb.AppendLine("<th style=\"text-align:left;padding:4px 0;\">Plan</th>");
            sb.AppendLine("<th style=\"text-align:left;padding:4px 0;\">Utilization</th>");
            sb.AppendLine("<th style=\"text-align:left;padding:4px 0;\">Monthly</th>");
            sb.AppendLine("</tr></thead><tbody>");
            foreach (var item in contract.Items)
            {
                var utilization = item.Fte.HasValue
                    ? $"{item.Fte} FTE"
                    : item.Percentage.HasValue
                        ? $"{item.Percentage}%"
                        : "-";
                sb.AppendLine("<tr>");
                sb.AppendLine($"<td style=\"padding:4px 0;\">{Escape(item.PlanName)}</td>");
                sb.AppendLine($"<td style=\"padding:4px 0;\">{utilization}</td>");
                sb.AppendLine($"<td style=\"padding:4px 0;\">{FormatCurrency(item.AdjustedMonthly)}/month</td>");
                sb.AppendLine("</tr>");
            }
            sb.AppendLine("</tbody><tfoot><tr>");
            sb.AppendLine("<td colspan=\"2\" style=\"padding-top:6px;font-weight:600;\">Total</td>");
            sb.AppendLine($"<td style=\"padding-top:6px;font-weight:600;\">{FormatCurrency(contract.TotalMonthly)}/month</td>");
            sb.AppendLine("</tr></tfoot></table>");
        }

        return sb.ToString();
    }

    private static async Task<HttpResponseData> WriteJsonResponse(HttpRequestData req, HttpStatusCode status, object body)
    {
        var response = req.CreateResponse(status);
        response.Headers.Add("Content-Type", "application/json");
        await response.WriteAsJsonAsync(body);
        return response;
    }
}
