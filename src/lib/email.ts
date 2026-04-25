import { Resend } from "resend";
import { logger } from "./logger";

let resend: Resend | null = null;

function getResend(): Resend | null {
  if (!process.env.RESEND_API_KEY) return null;
  if (!resend) resend = new Resend(process.env.RESEND_API_KEY);
  return resend;
}

const FROM_EMAIL = "Freshcast <onboarding@resend.dev>";

export async function sendEmail(
  to: string,
  subject: string,
  html: string
): Promise<boolean> {
  try {
    const client = getResend();
    if (!client) {
      logger.warn("email", "RESEND_API_KEY not set, skipping email", { to, subject });
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
