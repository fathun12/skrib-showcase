import { reportError } from "@/lib/report-error";

const BREVO_URL = "https://api.brevo.com/v3/smtp/email";
const TIMEOUT_MS = 8000;

export type SendEmailInput = {
  to: string;
  subject: string;
  text: string;
  // Optional HTML version; the text stays as the fallback.
  html?: string;
  // Optional custom headers (for example List-Unsubscribe in C4).
  headers?: Record<string, string>;
};

// Sends one plain-text mail through the Brevo REST API. Server only. Never throws.
// Without BREVO_API_KEY (local, Preview) it does nothing.
export async function sendEmail(
  input: SendEmailInput,
): Promise<{ ok: boolean }> {
  const apiKey = process.env.BREVO_API_KEY;
  const senderEmail = process.env.BREVO_SENDER_EMAIL;
  if (!apiKey || !senderEmail) return { ok: false };

  try {
    const response = await fetch(BREVO_URL, {
      method: "POST",
      headers: {
        "api-key": apiKey,
        "content-type": "application/json",
        accept: "application/json",
      },
      body: JSON.stringify({
        sender: {
          email: senderEmail,
          name: process.env.BREVO_SENDER_NAME || "Skrib",
        },
        to: [{ email: input.to }],
        subject: input.subject,
        textContent: input.text,
        ...(input.html ? { htmlContent: input.html } : {}),
        ...(input.headers ? { headers: input.headers } : {}),
      }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });

    if (!response.ok) {
      // The status code only: the response body can contain the address.
      reportError("sendEmail", new Error(`Brevo answered HTTP ${response.status}`));
      return { ok: false };
    }
    return { ok: true };
  } catch (error) {
    // The error name only: the message could contain the address.
    const name = error instanceof Error ? error.name : "unknown";
    reportError("sendEmail", new Error(`Brevo request failed: ${name}`));
    return { ok: false };
  }
}