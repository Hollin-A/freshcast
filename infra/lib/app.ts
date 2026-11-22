import { App, Tags, Validations, type Environment } from "aws-cdk-lib";
import { AwsSolutionsChecks } from "cdk-nag";
import { AccountStack } from "./account-stack";
import { ApiStack } from "./api-stack";
import { ACCOUNT_CONTEXT_KEY, config } from "./config";

/**
 * Builds the app's stacks. The CLI entry point (bin/freshcast.ts) and the
 * tests share it, so tests check exactly what gets deployed.
 */
export function buildApp(app: App) {
  const env = resolveEnvironment(app);

  const account = new AccountStack(app, "FreshcastAccount", { env });
  const api = new ApiStack(app, "FreshcastApi", { env });

  Tags.of(account).add("stage", "account");
  Tags.of(api).add("stage", "production");
  for (const [key, value] of Object.entries(config.tags)) {
    Tags.of(app).add(key, value);
  }

  // cdk-nag's AWS Solutions rules validate every synthesized template, next
  // to CDK's built-in CloudFormation validation. Any violation fails synth;
  // acknowledge one only with Validations.of(construct).acknowledge() and a
  // reason.
  Validations.of(app).addPlugins(new AwsSolutionsChecks(app, { verbose: true }));

  return { account, api };
}

/**
 * Stacks need a concrete account for the hosted zone lookup. The account ID
 * is committed in cdk.json so synth works without AWS credentials (CI's
 * infra-diff job synthesizes before it signs in); the CLI's credentials are
 * the fallback until it is set.
 */
function resolveEnvironment(app: App): Environment {
  const account =
    (app.node.tryGetContext(ACCOUNT_CONTEXT_KEY) as string | undefined) ??
    process.env.CDK_DEFAULT_ACCOUNT;
  if (!account) {
    throw new Error(
      `No AWS account. Set "${ACCOUNT_CONTEXT_KEY}" in infra/cdk.json, or run with AWS credentials (--profile freshcast).`,
    );
  }
  return { account, region: config.region };
}
