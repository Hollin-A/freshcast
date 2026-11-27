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
  /** The API's container image (#32). */
  apiImage: {
    /** ECR repository in the FreshcastShared stack. */
    repositoryName: "freshcast-api",
    /** Images kept for rollback; older ones expire. */
    imagesToKeep: 10,
    /**
     * Prefix of the marker tag (`production-<sha>`) that protects a deployed
     * image from expiring. Every deploy must add it before the stack runs the
     * image: the deploy job (#34), or by hand until then (CONTRIBUTING,
     * Deploys).
     */
    deployedTagPrefix: "production-",
  },
  /**
   * Availability Zones for each environment's VPC. An ALB needs two. They are
   * named here, not looked up, so synth needs no AWS credentials.
   */
  availabilityZones: ["ap-southeast-2a", "ap-southeast-2b"],
  /** How the API runs, the same in every environment (#33). */
  apiService: {
    /** The port the API listens on (apps/api/Dockerfile, `PORT`). */
    containerPort: 4000,
    /** Fargate size: 0.25 vCPU and 512 MiB, the smallest ARM64 size. */
    cpu: 256,
    memoryMiB: 512,
    /**
     * Liveness only, never `/health/ready`: a database outage must not make
     * ECS replace healthy tasks (ADR-023 §7).
     */
    healthCheckPath: "/health/live",
    /**
     * Longer than the API's startup database retry window (about 55s at
     * worst, apps/api/src/database/prisma.service.ts), so ECS doesn't stop a
     * task that is still connecting.
     */
    healthCheckGracePeriodSeconds: 120,
    /** How long the ALB lets in-flight requests finish before a task stops. */
    deregistrationDelaySeconds: 30,
    logRetentionDays: 30,
  },
  /**
   * One entry per API environment. Only production exists; staging is
   * decided at the start of Stage 4 (ADR-021 §4).
   */
  apiEnvironments: {
    production: {
      /** The `stage` tag on the stack's resources. */
      stage: "production",
      /** `<subdomain>.<domainName>` */
      subdomain: "api",
      /**
       * Secrets Manager secrets, created by hand outside CDK (ADR-021).
       * ECS reads `startup` ones when a task starts; the API reads
       * `runtime` ones itself when it needs them (SecretsService, ADR-018).
       *
       * Each is the secret's name plus the 6-character suffix Secrets
       * Manager adds, so stacks reference its complete ARN. A name alone
       * isn't enough: Secrets Manager reads an ARN ending in a hyphen and 6
       * characters as a complete one, so `freshcast/auth-secret` would mean
       * a secret called `freshcast/auth`. Recreating a secret changes its
       * suffix; changing its value doesn't.
       */
      secrets: {
        startup: {
          DATABASE_URL: "freshcast/database-url-nW6Kv8",
          AUTH_SECRET: "freshcast/auth-secret-pZBxRx",
        },
        // Keyed by the env var that overrides it locally (SecretsService).
        runtime: {
          ANTHROPIC_API_KEY: "freshcast/anthropic-api-key-iSc9jB",
        },
      },
    },
  },
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
