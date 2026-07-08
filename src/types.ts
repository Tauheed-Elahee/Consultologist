/** Request body for POST /api/contact — mirrors api/Models/ContactRequest.cs. */
export interface ContactPayload {
    name: string;
    email: string;
    specialty: string;
    organization: string;
    comments: string;
}

/** Response body from POST /api/contact. */
export interface ContactResponse {
    message?: string;
}
