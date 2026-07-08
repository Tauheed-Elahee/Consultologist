/** Request body for POST /api/contact — mirrors api/Models/ContactRequest.cs. */
export interface ContactPayload {
    name: string;
    email: string;
    specialty: string;
    organization: string;
    comments: string;
    /** Honeypot — must be empty for real users. */
    website: string;
    /** Milliseconds between page load and submit. */
    elapsedMs: number;
    /** Turnstile response token from the widget. */
    turnstileToken: string;
}

/** Response body from POST /api/contact. */
export interface ContactResponse {
    message?: string;
}
