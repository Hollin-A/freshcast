type AwsCredentials = {
  accessKeyId: string;
  secretAccessKey: string;
};

type AwsRuntimeConfig = {
  region: string;
  credentials?: AwsCredentials;
};

/**
 * Resolve AWS runtime config while supporting platforms that reserve `AWS_*` env vars.
 *
 * Preferred custom vars:
 * - APP_AWS_REGION
 * - APP_AWS_ACCESS_KEY_ID
 * - APP_AWS_SECRET_ACCESS_KEY
 *
 * Backward-compatible fallback:
 * - AWS_REGION
 * - AWS_ACCESS_KEY_ID
 * - AWS_SECRET_ACCESS_KEY
 */
export function getAwsRuntimeConfig(defaultRegion = "ap-southeast-2"): AwsRuntimeConfig {
  const region = process.env.APP_AWS_REGION || process.env.AWS_REGION || defaultRegion;

  const accessKeyId = process.env.APP_AWS_ACCESS_KEY_ID || process.env.AWS_ACCESS_KEY_ID;
  const secretAccessKey =
    process.env.APP_AWS_SECRET_ACCESS_KEY || process.env.AWS_SECRET_ACCESS_KEY;

  if (accessKeyId && secretAccessKey) {
    return {
      region,
      credentials: {
        accessKeyId,
        secretAccessKey,
      },
    };
  }

  return { region };
}
