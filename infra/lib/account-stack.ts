import { CfnOutput, Stack, Validations, type StackProps } from "aws-cdk-lib";
import * as budgets from "aws-cdk-lib/aws-budgets";
import * as iam from "aws-cdk-lib/aws-iam";
import * as ssm from "aws-cdk-lib/aws-ssm";
import type { Construct } from "constructs";
import { API_DEPLOY_ROLE_NAME, CDK_DIFF_ROLE_NAME, config } from "./config";

/**
 * Resources the AWS account needs once, whatever runs in it: GitHub's OIDC
 * provider, the roles CI assumes, and the cost budget.
 *
 * CI can't create the role it signs in with, so this stack is deployed by
 * hand, once, with admin credentials (see CONTRIBUTING). Later changes go
 * through pull requests like any other stack.
 */
export class AccountStack extends Stack {
  constructor(scope: Construct, id: string, props: StackProps) {
    super(scope, id, { ...props, terminationProtection: true });

    // IAM no longer checks GitHub's thumbprint (it trusts GitHub's CA), but
    // the CloudFormation resource still requires one. These are GitHub's
    // published intermediate CA thumbprints.
    const github = new iam.OidcProviderNative(this, "GitHubOidcProvider", {
      url: `https://${config.github.oidcHost}`,
      clientIds: ["sts.amazonaws.com"],
      thumbprints: [
        "6938fd4d98bab03faadb97b34396831e3780aea1",
        "1c58a3a8518e8759bf075b76b750d4f2df264fcd",
      ],
    });

    // Read-only: CI shows `cdk diff` on pull requests.
    const cdkDiffRole = new iam.Role(this, "CdkDiffRole", {
      roleName: CDK_DIFF_ROLE_NAME,
      description: "GitHub Actions: cdk diff on pull requests (read-only)",
      assumedBy: new iam.WebIdentityPrincipal(github.oidcProviderArn, {
        StringEquals: {
          [`${config.github.oidcHost}:aud`]: "sts.amazonaws.com",
          [`${config.github.oidcHost}:sub`]: `repo:${config.github.repository}:pull_request`,
        },
      }),
    });

    // `cdk diff --method template` reads the deployed templates through the
    // bootstrap stack's read-only lookup role (the CLI's
    // accessStackForLookupBestEffort), so the CI role only needs to assume it.
    cdkDiffRole.addToPolicy(
      new iam.PolicyStatement({
        actions: ["sts:AssumeRole"],
        resources: [
          `arn:${this.partition}:iam::${this.account}:role/cdk-${config.bootstrapQualifier}-lookup-role-${this.account}-${this.region}`,
        ],
      }),
    );

    const deployRole = this.apiDeployRole(github.oidcProviderArn);

    const alertEmail = ssm.StringParameter.valueForStringParameter(
      this,
      config.budget.emailParameterName,
    );
    const subscribers = [{ subscriptionType: "EMAIL", address: alertEmail }];

    new budgets.CfnBudget(this, "MonthlyCostBudget", {
      budget: {
        budgetName: config.budget.name,
        budgetType: "COST",
        timeUnit: "MONTHLY",
        budgetLimit: { amount: config.budget.monthlyLimitUsd, unit: "USD" },
      },
      notificationsWithSubscribers: config.budget.alerts.map((alert) => ({
        notification: {
          notificationType: alert.type,
          comparisonOperator: "GREATER_THAN",
          threshold: alert.thresholdPercent,
          thresholdType: "PERCENTAGE",
        },
        subscribers,
      })),
    });

    new CfnOutput(this, "CdkDiffRoleArn", {
      value: cdkDiffRole.roleArn,
      description: "Set as the AWS_CDK_DIFF_ROLE_ARN repository variable in GitHub",
    });

    new CfnOutput(this, "ApiDeployRoleArn", {
      value: deployRole.roleArn,
      description: "Set as the AWS_DEPLOY_ROLE_ARN repository variable in GitHub",
    });
  }

  /**
   * CI's deploy job on `main` (#34): pushes the API image, tags it
   * `production-<sha>`, and runs `cdk deploy FreshcastApi`. Only tokens for
   * the repository's `production` GitHub environment may assume it; that
   * environment's branch rule allows `main` only.
   *
   * `cdk deploy` works through the CDK bootstrap's roles, so CloudFormation
   * makes the changes with the bootstrap execution role, which has
   * AdministratorAccess by default. The control is who can merge to `main`
   * (ARCHITECTURE §12.3); narrowing that policy is #176. Nothing in IAM
   * limits the role to FreshcastApi: the workflow names that stack, and
   * FreshcastAccount and FreshcastShared stay deployed by hand.
   */
  private apiDeployRole(oidcProviderArn: string): iam.Role {
    const role = new iam.Role(this, "ApiDeployRole", {
      roleName: API_DEPLOY_ROLE_NAME,
      description: "GitHub Actions: deploy the API from main",
      assumedBy: new iam.WebIdentityPrincipal(oidcProviderArn, {
        StringEquals: {
          [`${config.github.oidcHost}:aud`]: "sts.amazonaws.com",
          [`${config.github.oidcHost}:sub`]: `repo:${config.github.repository}:environment:${config.github.deployEnvironment}`,
        },
      }),
    });

    // `cdk deploy` uploads the template and assets through the file
    // publishing role and deploys through the deploy role. The image is
    // pushed directly, below, so the image publishing role isn't needed.
    const bootstrapRole = (name: string) =>
      `arn:${this.partition}:iam::${this.account}:role/cdk-${config.bootstrapQualifier}-${name}-role-${this.account}-${this.region}`;
    role.addToPolicy(
      new iam.PolicyStatement({
        actions: ["sts:AssumeRole"],
        resources: [bootstrapRole("deploy"), bootstrapRole("file-publishing")],
      }),
    );

    // Push the image, check whether its tag already exists (tags are
    // immutable, so a re-run must skip the push), and add the
    // `production-<sha>` marker tag. The repository lives in FreshcastShared;
    // its ARN is built from the name, so this stack doesn't depend on that one.
    role.addToPolicy(
      new iam.PolicyStatement({
        actions: [
          "ecr:BatchCheckLayerAvailability",
          "ecr:BatchGetImage",
          "ecr:CompleteLayerUpload",
          "ecr:DescribeImages",
          "ecr:InitiateLayerUpload",
          "ecr:PutImage",
          "ecr:UploadLayerPart",
        ],
        resources: [
          this.formatArn({
            service: "ecr",
            resource: "repository",
            resourceName: config.apiImage.repositoryName,
          }),
        ],
      }),
    );
    role.addToPolicy(
      new iam.PolicyStatement({ actions: ["ecr:GetAuthorizationToken"], resources: ["*"] }),
    );
    Validations.of(role).acknowledge({
      id: "AwsSolutions::AwsSolutions-IAM5[Resource::*]",
      reason: "ecr:GetAuthorizationToken has no resource-level permissions; it must be granted on *.",
    });

    return role;
  }
}
