import "server-only";

type AwsCredentials = {
  accessKeyId: string;
  secretAccessKey: string;
  sessionToken?: string;
};

type AwsRuntimeConfig = {
  region: string;
  credentials?: AwsCredentials;
};

/**
 * Resolve AWS runtime config while supporting platforms that reserve `AWS_*` env vars.
 *
 * Preferred explicit vars (optional):
 * - APP_AWS_REGION
 * - APP_AWS_ACCESS_KEY_ID
 * - APP_AWS_SECRET_ACCESS_KEY
 * - APP_AWS_SESSION_TOKEN (required when using temporary STS credentials)
 *
 * Important:
 * - If APP_AWS_ACCESS_KEY_ID / APP_AWS_SECRET_ACCESS_KEY are NOT set, we do not
 *   force static credentials and let the AWS SDK provider chain resolve IAM role credentials.
 * - This avoids accidentally pinning stale/invalid build-time AWS_* credentials.
 */
export function getAwsRuntimeConfig(defaultRegion = "ap-southeast-2"): AwsRuntimeConfig {
  const region = process.env.APP_AWS_REGION || process.env.AWS_REGION || defaultRegion;

  const accessKeyId = process.env.APP_AWS_ACCESS_KEY_ID;
  const secretAccessKey = process.env.APP_AWS_SECRET_ACCESS_KEY;
  const sessionToken = process.env.APP_AWS_SESSION_TOKEN;

  if (accessKeyId && secretAccessKey) {
    return {
      region,
      credentials: {
        accessKeyId,
        secretAccessKey,
        sessionToken,
      },
    };
  }

  return { region };
}
