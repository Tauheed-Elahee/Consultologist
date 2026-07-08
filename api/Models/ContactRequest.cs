namespace Api.Models;

public class ContactRequest
{
    public string Name { get; set; } = "";
    public string Email { get; set; } = "";
    public string Specialty { get; set; } = "";
    public string Organization { get; set; } = "";
    public string Comments { get; set; } = "";

    /// <summary>Honeypot field — always empty for real users.</summary>
    public string Website { get; set; } = "";

    /// <summary>Milliseconds between page load and submit, reported by the client.</summary>
    public long? ElapsedMs { get; set; }

    /// <summary>Turnstile response token to verify with Cloudflare.</summary>
    public string TurnstileToken { get; set; } = "";
}
