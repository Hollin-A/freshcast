import "server-only";
import { Resend } from "resend";
import { logger } from "./logger";
import { sendEmailViaSES } from "./ses";
import { getSecret } from "./secrets";

let resend: Resend | null = null;
let initialized = false;

async function getResend(): Promise<Resend | null> {
  if (initialized) return resend;
  initialized = true;

  const apiKey = await getSecret("RESEND_API_KEY", "freshcast/resend-api-key");
  if (!apiKey) return null;

  resend = new Resend(apiKey);
  return resend;
}

const FROM_EMAIL = "Freshcast <onboarding@resend.dev>";

/**
 * Send an email. Tries SES first (for AWS deployments), falls back to Resend.
 */
export async function sendEmail(
  to: string,
  subject: string,
  html: string
): Promise<boolean> {
  // Try SES first (available on AWS Amplify via IAM role)
  const sesSent = await sendEmailViaSES(to, subject, html);
  if (sesSent) return true;

  // Fall back to Resend
  try {
    const client = await getResend();
    if (!client) {
      logger.warn("email", "No email provider available (SES failed, no Resend API key resolved)", { to, subject });
      return false;
    }

    const { error } = await client.emails.send({
      from: FROM_EMAIL,
      to,
      subject,
      html,
    });

    if (error) {
      logger.error("email", "Failed to send email", { to, subject, error });
      return false;
    }

    logger.info("email", "Email sent", { to, subject });
    return true;
  } catch (err) {
    logger.error("email", "Email delivery error", err);
    return false;
  }
}

export function buildPasswordResetEmail(resetUrl: string): string {
  return `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 480px; margin: 0 auto; padding: 40px 20px;">
      <h2 style="color: #B5553A; font-size: 24px; margin-bottom: 8px;">Freshcast</h2>
      <p style="color: #555; font-size: 16px; line-height: 1.5; margin-bottom: 24px;">
        You requested a password reset. Click the button below to set a new password.
      </p>
      <a href="${resetUrl}" style="display: inline-block; background-color: #B5553A; color: #FFF8EC; text-decoration: none; padding: 12px 32px; border-radius: 999px; font-size: 16px; font-weight: 500;">
        Reset Password
      </a>
      <p style="color: #999; font-size: 13px; line-height: 1.5; margin-top: 32px;">
        This link expires in 1 hour. If you didn't request this, you can safely ignore this email.
      </p>
      <p style="color: #ccc; font-size: 12px; margin-top: 40px; border-top: 1px solid #eee; padding-top: 16px;">
        Freshcast — Sales tracking for small businesses
      </p>
    </div>
  `;
}
