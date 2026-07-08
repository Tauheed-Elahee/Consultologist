import type { ContactPayload, ContactResponse } from "../types";

const FALLBACK_ERROR = "We could not send your request. Please email hello@consultologist.ai.";

const form = document.getElementById("contact-form") as HTMLFormElement | null;
const submitButton = document.getElementById("contact-submit") as HTMLButtonElement | null;
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
    };

    if (submitButton) {
        submitButton.disabled = true;
        submitButton.textContent = "Sending...";
    }
    showResponse("loading");

    try {
        const response = await fetch("/api/contact", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
        });

        if (response.ok) {
            const result = (await response.json()) as ContactResponse;
            showResponse("success", result.message ?? "Thanks! Your waitlist request was sent.");
            form.reset();
        } else {
            showResponse("error", FALLBACK_ERROR);
        }
    } catch {
        showResponse("error", FALLBACK_ERROR);
    } finally {
        if (submitButton) {
            submitButton.disabled = false;
            submitButton.textContent = "Join waitlist";
        }
    }
});
