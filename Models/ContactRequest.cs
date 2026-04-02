using System.ComponentModel.DataAnnotations;

namespace Consultologist.Models;

public class ContactRequest
{
    [Required] public string Name { get; set; } = "";
    [Required, EmailAddress] public string Email { get; set; } = "";
    [Required] public string Specialty { get; set; } = "";
    [Required] public string Institution { get; set; } = "";
    [Required] public string Comments { get; set; } = "";
}
