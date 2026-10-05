import "server-only";
import { SESClient, SendEmailCommand } from "@aws-sdk/client-ses";
import { logger } from "./logger";
import { getAwsRuntimeConfig } from "./aws-config";

let client: SESClient | null = null;

function getClient(): SESClient | null {
  // SES is available when running on AWS with IAM role, or with explicit credentials
  if (!client) {
    try {
      client = new SESClient(getAwsRuntimeConfig());
    } catch {
      return null;
    }
  }
  return client;
}

const FROM_EMAIL = process.env.SES_FROM_EMAIL || "noreply@freshcast.site";

export async function sendEmailViaSES(
  to: string,
  subject: string,
  html: string
): Promise<boolean> {
  const ses = getClient();
  if (!ses) {
    logger.debug("ses", "SES client not available, skipping");
    return false;
  }

  try {
    await ses.send(
      new SendEmailCommand({
        Source: FROM_EMAIL,
        Destination: { ToAddresses: [to] },
        Message: {
          Subject: { Data: subject, Charset: "UTF-8" },
          Body: { Html: { Data: html, Charset: "UTF-8" } },
        },
      })
    );

    logger.info("ses", "Email sent via SES", { to, subject });
    return true;
  } catch (err) {
    const error = err as Error;
    logger.warn("ses", "SES email failed, will fall back", {
      to,
      errorName: error.name,
      errorMessage: error.message,
      stack: error.stack?.split("\n").slice(0, 3).join(" | "),
    });
    return false;
  }
}
