/** Fixed settings for every stack in this app. */
export const config = {
  /** All API infrastructure lives in one AWS Region (ADR-021). */
  region: "ap-southeast-2",
  /**
   * The existing Route 53 hosted zone. CDK looks it up and never creates or
   * changes the zone itself, or the records Amplify manages in it (ADR-021 §3).
   */
  domainName: "freshcast.site",
  github: {
    /** The repository whose workflows may assume the CI roles. */
    repository: "Hollin-A/freshcast",
    /** The issuer of GitHub Actions' OIDC tokens. */
    oidcHost: "token.actions.githubusercontent.com",
  },
  /** Qualifier of the CDK bootstrap stack (the CDK default). */
  bootstrapQualifier: "hnb659fds",
  /** Tags on every taggable resource in the app's stacks, for cost tracking. */
  tags: { project: "freshcast" },
  budget: {
    name: "freshcast-monthly",
    /** Monthly cost budget for the whole AWS account, in USD. */
    monthlyLimitUsd: 60,
    /** Email alerts: actual spend over 80%, forecast spend over 100%. */
    alerts: [
      { type: "ACTUAL", thresholdPercent: 80 },
      { type: "FORECASTED", thresholdPercent: 100 },
    ],
    /**
     * SSM parameter that holds the alert email address. The repo is public,
     * so the address stays out of the code; CloudFormation reads the
     * parameter at deploy time.
     */
    emailParameterName: "/freshcast/budget-alert-email",
  },
} as const;

/** Context key in cdk.json that holds the AWS account ID. */
export const ACCOUNT_CONTEXT_KEY = "freshcast:awsAccountId";

/** The name of the role that CI assumes to run `cdk diff` on pull requests. */
export const CDK_DIFF_ROLE_NAME = "freshcast-github-cdk-diff";
