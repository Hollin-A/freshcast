import { App } from "aws-cdk-lib";
import { Annotations, Match, Template } from "aws-cdk-lib/assertions";
import { describe, expect, it } from "vitest";
import { buildApp } from "../lib/app";
import { ACCOUNT_CONTEXT_KEY, CDK_DIFF_ROLE_NAME, config } from "../lib/config";

const ACCOUNT = "111111111111";

// A cached lookup result, the way cdk.context.json holds it, so the tests
// never call AWS.
function testApp() {
  const app = new App({
    context: {
      [ACCOUNT_CONTEXT_KEY]: ACCOUNT,
      [`hosted-zone:account=${ACCOUNT}:domainName=${config.domainName}:region=${config.region}`]: {
        Id: "/hostedzone/ZTESTZONE",
        Name: `${config.domainName}.`,
      },
    },
  });
  return buildApp(app);
}

describe("FreshcastAccount", () => {
  const { account } = testApp();
  const template = Template.fromStack(account);

  it("trusts GitHub's OIDC provider for STS only", () => {
    template.hasResourceProperties("AWS::IAM::OIDCProvider", {
      Url: "https://token.actions.githubusercontent.com",
      ClientIdList: ["sts.amazonaws.com"],
    });
  });

  it("lets only this repo's pull requests assume the diff role", () => {
    template.hasResourceProperties("AWS::IAM::Role", {
      RoleName: CDK_DIFF_ROLE_NAME,
      AssumeRolePolicyDocument: {
        Statement: [
          Match.objectLike({
            Action: "sts:AssumeRoleWithWebIdentity",
            Condition: {
              StringEquals: {
                "token.actions.githubusercontent.com:aud": "sts.amazonaws.com",
                "token.actions.githubusercontent.com:sub": `repo:${config.github.repository}:pull_request`,
              },
            },
          }),
        ],
      },
    });
  });

  it("gives the diff role nothing but the bootstrap lookup role", () => {
    const policies = template.findResources("AWS::IAM::Policy");
    const statements = Object.values(policies).flatMap(
      (policy) => policy.Properties.PolicyDocument.Statement,
    );
    expect(statements).toHaveLength(1);
    expect(statements[0].Action).toBe("sts:AssumeRole");
    expect(JSON.stringify(statements[0].Resource)).toContain(
      `:role/cdk-${config.bootstrapQualifier}-lookup-role-${ACCOUNT}-${config.region}`,
    );
  });

  it("alerts by email before the monthly budget is spent", () => {
    template.hasResourceProperties("AWS::Budgets::Budget", {
      Budget: Match.objectLike({
        BudgetName: config.budget.name,
        BudgetType: "COST",
        TimeUnit: "MONTHLY",
        BudgetLimit: { Amount: config.budget.monthlyLimitUsd, Unit: "USD" },
      }),
      NotificationsWithSubscribers: [
        Match.objectLike({
          Notification: Match.objectLike({ NotificationType: "ACTUAL", Threshold: 80 }),
          Subscribers: [Match.objectLike({ SubscriptionType: "EMAIL" })],
        }),
        Match.objectLike({
          Notification: Match.objectLike({ NotificationType: "FORECASTED", Threshold: 100 }),
          Subscribers: [Match.objectLike({ SubscriptionType: "EMAIL" })],
        }),
      ],
    });
    // The address comes from SSM at deploy time, never from the code.
    template.hasParameter("*", {
      Type: "AWS::SSM::Parameter::Value<String>",
      Default: config.budget.emailParameterName,
    });
  });

  it("can't be deleted by accident", () => {
    expect(account.terminationProtection).toBe(true);
  });
});

describe("FreshcastApi", () => {
  const { api } = testApp();
  const template = Template.fromStack(api);

  it("looks up the existing hosted zone instead of creating one", () => {
    expect(api.hostedZone.hostedZoneId).toBe("ZTESTZONE");
    template.resourceCountIs("AWS::Route53::HostedZone", 0);
  });

  it("deploys to the account and AWS Region from config", () => {
    expect(api.account).toBe(ACCOUNT);
    expect(api.region).toBe(config.region);
  });
});

describe("every stack", () => {
  const { account, api } = testApp();
  const stacks = [account, api];

  // Validation plugins (cdk-nag, CloudFormation validation) run during synth
  // and make it throw on any violation.
  it("synthesizes without validation errors", () => {
    for (const stack of stacks) {
      expect(() => Template.fromStack(stack)).not.toThrow();
      expect(Annotations.fromStack(stack).findError("*", Match.anyValue())).toEqual([]);
    }
  });

  // Untaggable types (an inline IAM policy, CDK's metadata) have no Tags.
  it("tags every taggable resource with the project and stage", () => {
    const template = Template.fromStack(account);
    const tagged = { project: "freshcast", stage: "account" };
    for (const type of ["AWS::IAM::OIDCProvider", "AWS::IAM::Role"]) {
      template.hasResourceProperties(type, {
        Tags: Match.arrayWith(Object.entries(tagged).map(([Key, Value]) => ({ Key, Value }))),
      });
    }
    template.hasResourceProperties("AWS::Budgets::Budget", {
      ResourceTags: Match.arrayWith(Object.entries(tagged).map(([Key, Value]) => ({ Key, Value }))),
    });
  });
});
