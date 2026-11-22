import { CfnOutput, Stack, type StackProps } from "aws-cdk-lib";
import * as budgets from "aws-cdk-lib/aws-budgets";
import * as iam from "aws-cdk-lib/aws-iam";
import * as ssm from "aws-cdk-lib/aws-ssm";
import type { Construct } from "constructs";
import { CDK_DIFF_ROLE_NAME, config } from "./config";

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

    // Read-only: CI shows `cdk diff` on pull requests. The deploy role on
    // main is added with #34.
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
  }
}
