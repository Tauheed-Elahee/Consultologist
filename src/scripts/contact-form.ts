import type { ContactPayload, ContactResponse } from "../types";

declare global {
    interface Window {
        turnstile?: { reset: () => void };
    }
}

const FALLBACK_ERROR = "We could not send your request. Please email hello@consultologist.ai.";

const loadedAt = Date.now();

const form = document.getElementById("contact-form") as HTMLFormElement | null;
const submitButton = document.getElementById("contact-submit") as HTMLButtonElement | null;

// The Proof-section CTAs arrive with an interest hint; start the comments for
// them. Only when the field is empty, so a back-navigation never loses text.
const PREFILLS: Record<string, string> = {
    beta: "I'd like an invite when the beta opens.",
    release: "Please email me when Consultologist is released for my specialty.",
};
const interest = new URLSearchParams(window.location.search).get("interest") ?? "";
const commentsField = form?.elements.namedItem("comments");
if (commentsField instanceof HTMLTextAreaElement && commentsField.value === "" && PREFILLS[interest]) {
    commentsField.value = PREFILLS[interest];
}
const responseCard = document.getElementById("form-response");
const loadingMessage = document.getElementById("form-loading");
const successMessage = document.getElementById("form-success");
const errorMessage = document.getElementById("form-error");

function showResponse(state: "loading" | "success" | "error", text?: string): void {
    responseCard?.removeAttribute("hidden");
    loadingMessage?.toggleAttribute("hidden", state !== "loading");
    successMessage?.toggleAttribute("hidden", state !== "success");
    errorMessage?.toggleAttribute("hidden", state !== "error");

    if (state === "success" && text) {
        successMessage!.querySelector("p")!.textContent = text;
    }
    if (state === "error" && text) {
        errorMessage!.querySelector("p")!.textContent = text;
    }
}

form?.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!form.reportValidity()) {
        return;
    }

    const data = new FormData(form);
    const payload: ContactPayload = {
        name: String(data.get("name") ?? ""),
        email: String(data.get("email") ?? ""),
        specialty: String(data.get("specialty") ?? ""),
        organization: String(data.get("organization") ?? ""),
        comments: String(data.get("comments") ?? ""),
        website: String(data.get("website") ?? ""),
        elapsedMs: Date.now() - loadedAt,
        turnstileToken: String(data.get("cf-turnstile-response") ?? ""),
    };

    if (submitButton) {
        submitButton.disabled = true;
        submitButton.textContent = "Sending...";
    }
    showResponse("loading");

    let succeeded = false;
    try {
        const response = await fetch("/api/contact", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
        });

        if (response.ok) {
            const result = (await response.json()) as ContactResponse;
            showResponse("success", result.message ?? "Thanks! Your message was sent.");
            form.reset();
            succeeded = true;
        } else {
            showResponse("error", FALLBACK_ERROR);
        }
    } catch {
        showResponse("error", FALLBACK_ERROR);
    } finally {
        if (submitButton) {
            submitButton.disabled = false;
            submitButton.textContent = "Send message";
        }
        // Turnstile tokens are single-use; get a fresh one for any retry.
        if (!succeeded) {
            window.turnstile?.reset();
        }
    }
});
