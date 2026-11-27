import { App } from "aws-cdk-lib";
import { Annotations, Match, Template } from "aws-cdk-lib/assertions";
import { describe, expect, it } from "vitest";
import { IMAGE_TAG_PARAMETER } from "../lib/api-stack";
import { buildApp } from "../lib/app";
import { ACCOUNT_CONTEXT_KEY, CDK_DIFF_ROLE_NAME, config } from "../lib/config";

const ACCOUNT = "111111111111";
const production = config.apiEnvironments.production;

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

describe("FreshcastShared", () => {
  const { shared } = testApp();
  const template = Template.fromStack(shared);

  it("holds the API's image repository with immutable tags and scan on push", () => {
    template.resourceCountIs("AWS::ECR::Repository", 1);
    template.hasResourceProperties("AWS::ECR::Repository", {
      RepositoryName: config.apiImage.repositoryName,
      ImageTagMutability: "IMMUTABLE",
      ImageScanningConfiguration: { ScanOnPush: true },
    });
  });

  it("expires untagged images after a day and keeps the last deployed and other images", () => {
    const repository = Object.values(template.findResources("AWS::ECR::Repository"))[0];
    const policy = JSON.parse(repository.Properties.LifecyclePolicy.LifecyclePolicyText);
    expect(policy.rules).toEqual([
      expect.objectContaining({
        selection: expect.objectContaining({
          tagStatus: "untagged",
          countType: "sinceImagePushed",
          countNumber: 1,
          countUnit: "days",
        }),
        action: { type: "expire" },
      }),
      expect.objectContaining({
        selection: expect.objectContaining({
          tagStatus: "tagged",
          tagPrefixList: [config.apiImage.deployedTagPrefix],
          countType: "imageCountMoreThan",
          countNumber: config.apiImage.imagesToKeep,
        }),
        action: { type: "expire" },
      }),
      expect.objectContaining({
        selection: expect.objectContaining({
          tagStatus: "any",
          countType: "imageCountMoreThan",
          countNumber: config.apiImage.imagesToKeep,
        }),
        action: { type: "expire" },
      }),
    ]);
  });

  it("keeps the repository and its images if the stack is deleted", () => {
    template.hasResource("AWS::ECR::Repository", {
      DeletionPolicy: "Retain",
      UpdateReplacePolicy: "Retain",
    });
  });

  it("can't be deleted by accident", () => {
    expect(shared.terminationProtection).toBe(true);
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

  it("uses public subnets only, with no NAT gateway", () => {
    template.resourceCountIs("AWS::EC2::NatGateway", 0);
    template.resourceCountIs("AWS::EC2::Subnet", config.availabilityZones.length);
    template.allResourcesProperties("AWS::EC2::Subnet", { MapPublicIpOnLaunch: true });
  });

  it("serves HTTPS on api.freshcast.site and redirects HTTP", () => {
    const domainName = `${production.subdomain}.${config.domainName}`;
    template.hasResourceProperties("AWS::CertificateManager::Certificate", {
      DomainName: domainName,
      ValidationMethod: "DNS",
    });
    template.hasResourceProperties("AWS::ElasticLoadBalancingV2::Listener", {
      Port: 443,
      Protocol: "HTTPS",
      Certificates: [Match.objectLike({ CertificateArn: Match.anyValue() })],
    });
    template.hasResourceProperties("AWS::ElasticLoadBalancingV2::Listener", {
      Port: 80,
      DefaultActions: [Match.objectLike({ Type: "redirect", RedirectConfig: Match.objectLike({ Port: "443" }) })],
    });
    template.hasResourceProperties("AWS::Route53::RecordSet", {
      Name: `${domainName}.`,
      Type: "A",
      HostedZoneId: "ZTESTZONE",
    });
  });

  it("checks liveness, never readiness, on the target group", () => {
    template.hasResourceProperties("AWS::ElasticLoadBalancingV2::TargetGroup", {
      Port: config.apiService.containerPort,
      HealthCheckPath: "/health/live",
    });
  });

  it("rolls back a deploy whose tasks can't start", () => {
    template.hasResourceProperties("AWS::ECS::Service", {
      DesiredCount: 1,
      DeploymentConfiguration: Match.objectLike({
        DeploymentCircuitBreaker: { Enable: true, Rollback: true },
        MinimumHealthyPercent: 100,
      }),
    });
  });

  it("waits longer than the API's startup database retries before health checks count", () => {
    const service = Object.values(template.findResources("AWS::ECS::Service"))[0];
    // About 55s at worst (apps/api/src/database/prisma.service.ts).
    expect(service.Properties.HealthCheckGracePeriodSeconds).toBeGreaterThan(55);
  });

  it("admits only the load balancer to the API port", () => {
    template.hasResourceProperties("AWS::EC2::SecurityGroupIngress", {
      FromPort: config.apiService.containerPort,
      ToPort: config.apiService.containerPort,
      SourceSecurityGroupId: Match.anyValue(),
    });
    const ingress = Object.values(template.findResources("AWS::EC2::SecurityGroupIngress"));
    expect(ingress).toHaveLength(1);
  });

  it("runs the image tag given at deploy, on ARM64, and reports it as the version", () => {
    template.hasParameter(IMAGE_TAG_PARAMETER, { Type: "String", Default: Match.absent() });
    template.hasResourceProperties("AWS::ECS::TaskDefinition", {
      RuntimePlatform: { CpuArchitecture: "ARM64", OperatingSystemFamily: "LINUX" },
      ContainerDefinitions: [
        Match.objectLike({
          Image: Match.objectLike({ "Fn::Join": Match.arrayWith([Match.arrayWith([{ Ref: IMAGE_TAG_PARAMETER }])]) }),
          Environment: Match.arrayWith([{ Name: "APP_VERSION", Value: { Ref: IMAGE_TAG_PARAMETER } }]),
        }),
      ],
    });
  });

  // A retained group with a fixed name would already exist when the stack is
  // recreated (after a failed first deploy, for example), and fail the create.
  it("retains the API log group under a generated name", () => {
    const groups = Object.values(template.findResources("AWS::Logs::LogGroup")).filter(
      (group) => group.DeletionPolicy === "Retain",
    );
    expect(groups).toHaveLength(1);
    expect(groups[0].Properties.LogGroupName).toBeUndefined();
    expect(groups[0].Properties.RetentionInDays).toBe(config.apiService.logRetentionDays);
  });

  it("injects startup secrets from Secrets Manager, never as plain values", () => {
    const taskDefinition = Object.values(template.findResources("AWS::ECS::TaskDefinition"))[0];
    const [container] = taskDefinition.Properties.ContainerDefinitions;
    const secretNames = container.Secrets.map((secret: { Name: string }) => secret.Name).sort();
    expect(secretNames).toEqual(Object.keys(production.secrets.startup).sort());
    const envNames = container.Environment.map((variable: { Name: string }) => variable.Name);
    for (const name of secretNames) expect(envNames).not.toContain(name);
  });

  // Secrets Manager reads an ARN ending in a hyphen and 6 characters as a
  // complete ARN, so a name like `freshcast/auth-secret` must never be used
  // as a partial ARN (it failed the first deploy).
  it("references every secret by its complete ARN and grants exactly that ARN", () => {
    const secretIds = [...Object.values(production.secrets.startup), ...Object.values(production.secrets.runtime)];
    for (const secretId of secretIds) expect(secretId).toMatch(/-[A-Za-z0-9]{6}$/);

    const taskDefinition = Object.values(template.findResources("AWS::ECS::TaskDefinition"))[0];
    const [container] = taskDefinition.Properties.ContainerDefinitions;
    const policies = JSON.stringify(template.findResources("AWS::IAM::Policy"));
    for (const secret of container.Secrets as { ValueFrom: unknown }[]) {
      expect(JSON.stringify(secret.ValueFrom)).toMatch(/:secret:[^"]+-[A-Za-z0-9]{6}"/);
      expect(policies).toContain(JSON.stringify(secret.ValueFrom));
    }
    expect(policies).not.toContain("??????");
  });

  it("gives the task role only the runtime secrets (least privilege)", () => {
    const policies = Object.entries(template.findResources("AWS::IAM::Policy")).filter(([id]) =>
      id.startsWith("TaskDefinitionTaskRole"),
    );
    expect(policies).toHaveLength(1);
    const statements = policies[0][1].Properties.PolicyDocument.Statement;
    expect(statements).toHaveLength(1);
    expect([...statements[0].Action].sort()).toEqual([
      "secretsmanager:DescribeSecret",
      "secretsmanager:GetSecretValue",
    ]);
    expect(JSON.stringify(statements[0].Resource)).toContain(
      `:secret:${production.secrets.runtime.ANTHROPIC_API_KEY}"`,
    );
  });
});

describe("every stack", () => {
  const { account, shared, api } = testApp();
  const stacks = [account, shared, api];

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

    Template.fromStack(shared).hasResourceProperties("AWS::ECR::Repository", {
      Tags: Match.arrayWith([
        { Key: "project", Value: "freshcast" },
        { Key: "stage", Value: "shared" },
      ]),
    });
  });
});
