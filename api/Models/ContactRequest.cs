namespace Api.Models;

public class ContactRequest
{
    public string Name { get; set; } = "";
    public string Email { get; set; } = "";
    public string Specialty { get; set; } = "";
    public string Organization { get; set; } = "";
    public string Comments { get; set; } = "";
    public ContractSummary? Contract { get; set; }
}
