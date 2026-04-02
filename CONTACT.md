# Plan: Port Contact Form from Website to Blazor

## Context
The Astro website (`../website/Consultologist`) has a working contact form with 5 fields (name, email, specialty, institution, comments) backed by a Node.js Azure Function that sends email via Azure Communication Services. The Blazor rewrite (`rewrite-blazor` branch) has no form yet. The goal is to port this form into the Blazor app.

---

## Approach

### 1. Create a Contact model (`Models/ContactRequest.cs`)
A simple DTO with `[Required]` data annotations for Blazor's built-in validation:
```csharp
public class ContactRequest
{
    [Required] public string Name { get; set; } = "";
    [Required, EmailAddress] public string Email { get; set; } = "";
    [Required] public string Specialty { get; set; } = "";
    [Required] public string Institution { get; set; } = "";
    [Required] public string Comments { get; set; } = "";
}
```
Create `Models/` folder if it doesn't exist.

### 2. Create `Pages/Contact.razor`
Route: `/contact`

- Use Blazor's `<EditForm>` with `<DataAnnotationsValidator>` and `<ValidationSummary>`
- Fields: `<FluentTextField>` for name, email, specialty, institution; `<FluentTextArea>` for comments
- Submit button: `<FluentButton>` (disabled during submission)
- States: idle → loading → success / error
- On submit: `await Http.PostAsJsonAsync("/api/contact", model)`
- Show success message on 200; show error (with fallback email) on failure
- Inject `HttpClient` directly (same pattern as `Weather.razor`)

### 3. Create the API endpoint as a .NET isolated-worker Azure Function

Create a new .NET 8 isolated-worker Azure Function project in `api/`. This replaces the Node.js function in the website with an equivalent C# implementation using `Azure.Communication.Email`.

**`api/api.csproj`** — project file targeting `net8.0-windows` (or `net8.0`), referencing:
- `Microsoft.Azure.Functions.Worker`
- `Microsoft.Azure.Functions.Worker.Extensions.Http`
- `Azure.Communication.Email`

**`api/Program.cs`** — minimal host builder:
```csharp
var host = new HostBuilder()
    .ConfigureFunctionsWorkerDefaults()
    .Build();
await host.RunAsync();
```

**`api/Models/ContactRequest.cs`** — deserialization DTO matching the Blazor model:
```csharp
public class ContactRequest
{
    public string Name { get; set; } = "";
    public string Email { get; set; } = "";
    public string Specialty { get; set; } = "";
    public string Organization { get; set; } = "";
    public string Comments { get; set; } = "";
    public ContractSummary? Contract { get; set; }
}
```

**`api/Models/ContractSummary.cs`** — optional contract DTO:
```csharp
public class ContractSummary
{
    public List<ContractItem> Items { get; set; } = [];
    public decimal? TotalMonthly { get; set; }
}

public class ContractItem
{
    public string PlanName { get; set; } = "";
    public decimal? Percentage { get; set; }
    public decimal? Fte { get; set; }
    public decimal? BasePrice { get; set; }
    public decimal? AdjustedMonthly { get; set; }
}
```

**`api/ContactFunction.cs`** — the ported logic:
- `[Function("contact")]` with `HttpTrigger(AuthorizationLevel.Anonymous, "post")`
- Read env vars: `ACS_CONNECTION_STRING`, `ACS_SENDER_ADDRESS`, `ACS_CONTACT_RECIPIENT`
- Deserialize body with `req.ReadFromJsonAsync<ContactRequest>()`
- Validate required fields; return `400` if any are missing or blank
- Build plain-text and HTML email bodies (port of `buildPlainText`/`buildHtml`/`buildContractHtml`)
  - HTML escaping: `System.Net.WebUtility.HtmlEncode()`
  - Currency formatting: `value.ToString("C2", CultureInfo.GetCultureInfo("en-US"))`
- Send via `Azure.Communication.Email.EmailClient`:
  - `emailClient.BeginSend(message)` returns a poller
  - Await `poller.WaitForCompletionAsync()` — same long-running operation pattern as the JS SDK
- Return `200` with `{ message, operationId }` on success; `500` on exception
- Same env vars required on deployment: `ACS_CONNECTION_STRING`, `ACS_SENDER_ADDRESS`, `ACS_CONTACT_RECIPIENT`

### 4. Add nav link
In `Layout/NavMenu.razor`, add a `<FluentNavLink>` for `/contact` (e.g., with `Mail` icon).

---

## Files to create/modify
| Action | File |
|---|---|
| Create | `Models/ContactRequest.cs` |
| Create | `Pages/Contact.razor` |
| Create | `api/api.csproj` |
| Create | `api/Program.cs` |
| Create | `api/Models/ContactRequest.cs` |
| Create | `api/Models/ContractSummary.cs` |
| Create | `api/ContactFunction.cs` |
| Modify | `Layout/NavMenu.razor` — add Contact nav link |

## Files to reference
- Website form: `../website/Consultologist/src/components/Contact.astro` — field names, UX states, error messages
- Website API: `../website/Consultologist/api/contact/index.js` — source logic to port (email body templates, validation, contract formatting)
- Pattern to follow: `Pages/Weather.razor` — HttpClient injection and usage pattern
- Pattern to follow: `Layout/NavMenu.razor` — how to add nav links

## Verification
1. `dotnet run` — app should compile and serve
2. Navigate to `/contact` — form should render with all 5 fields
3. Submit empty form — validation errors should appear inline
4. (With ACS env vars set) submit a valid form — should send email and show success
5. Check nav menu has Contact link
