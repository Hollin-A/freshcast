import {
  ArnFormat,
  CfnOutput,
  CfnParameter,
  Duration,
  RemovalPolicy,
  Stack,
  Validations,
  type StackProps,
} from "aws-cdk-lib";
import * as acm from "aws-cdk-lib/aws-certificatemanager";
import * as ec2 from "aws-cdk-lib/aws-ec2";
import * as ecr from "aws-cdk-lib/aws-ecr";
import * as ecs from "aws-cdk-lib/aws-ecs";
import * as elbv2 from "aws-cdk-lib/aws-elasticloadbalancingv2";
import * as logs from "aws-cdk-lib/aws-logs";
import * as route53 from "aws-cdk-lib/aws-route53";
import * as targets from "aws-cdk-lib/aws-route53-targets";
import * as secretsmanager from "aws-cdk-lib/aws-secretsmanager";
import type { Construct } from "constructs";
import { config } from "./config";

/** The settings that differ between API environments (config.apiEnvironments). */
export type ApiEnvironment = (typeof config.apiEnvironments)[keyof typeof config.apiEnvironments];

export interface ApiStackProps extends StackProps {
  readonly environment: ApiEnvironment;
}

/**
 * Name of the stack parameter (its construct ID in ApiStack) that holds the image tag (a git SHA) the
 * service runs. The deploy job passes it (`cdk deploy --parameters
 * ImageTag=<sha>`, #34); a deploy without it keeps the previous value.
 */
export const IMAGE_TAG_PARAMETER = "ImageTag";

/**
 * Everything one API environment needs to run (#33): a VPC with public
 * subnets only (no NAT gateway, ADR-020 D5), an ALB with HTTPS, the ECS
 * Fargate service, and the `api.` DNS record. The image repository is shared
 * by every environment and lives in FreshcastShared.
 */
export class ApiStack extends Stack {
  /**
   * The existing `freshcast.site` zone. Add only records this app owns;
   * Amplify manages the rest (ADR-021 §3).
   */
  public readonly hostedZone: route53.IHostedZone;

  /**
   * The AZs from config. Overriding this keeps the VPC from looking up the
   * Region's AZs, which would need AWS credentials at synth.
   */
  override get availabilityZones(): string[] {
    return [...config.availabilityZones];
  }

  /** The complete ARN of a secret, from its name and suffix in config. */
  private secretArn(secretId: string): string {
    return this.formatArn({
      service: "secretsmanager",
      resource: "secret",
      resourceName: secretId,
      arnFormat: ArnFormat.COLON_RESOURCE_NAME,
    });
  }

  constructor(scope: Construct, id: string, props: ApiStackProps) {
    super(scope, id, props);
    const { environment } = props;
    const settings = config.apiService;
    const domainName = `${environment.subdomain}.${config.domainName}`;

    this.hostedZone = route53.HostedZone.fromLookup(this, "HostedZone", {
      domainName: config.domainName,
    });

    // CDK owns the image tag (#33): it is a stack parameter rather than a
    // context value, so `cdk diff` on a pull request shows no image change,
    // and only the deploy job moves it. No default: the first deploy must
    // name an image that exists in ECR. The ID is a literal (the
    // no-variable-construct-id lint rule); the tests fail if it stops
    // matching IMAGE_TAG_PARAMETER.
    const imageTag = new CfnParameter(this, "ImageTag", {
      type: "String",
      description: "The freshcast-api image tag (git SHA) to run",
      allowedPattern: "^[0-9a-f]{7,40}$",
      constraintDescription: "must be a git SHA",
    }).valueAsString;

    // Public subnets only: tasks reach Neon, ECR, Secrets Manager and Claude
    // through the internet gateway, so no NAT gateway is needed (ADR-020 D5).
    // Security groups, not subnets, keep the tasks private.
    const vpc = new ec2.Vpc(this, "Vpc", {
      availabilityZones: [...config.availabilityZones],
      natGateways: 0,
      subnetConfiguration: [{ name: "Public", subnetType: ec2.SubnetType.PUBLIC, cidrMask: 24 }],
      flowLogs: {
        All: {
          destination: ec2.FlowLogDestination.toCloudWatchLogs(
            new logs.LogGroup(this, "VpcFlowLogs", {
              retention: logs.RetentionDays.ONE_MONTH,
              removalPolicy: RemovalPolicy.DESTROY,
            }),
          ),
        },
      },
    });

    const certificate = new acm.Certificate(this, "Certificate", {
      domainName,
      validation: acm.CertificateValidation.fromDns(this.hostedZone),
    });

    const albSecurityGroup = new ec2.SecurityGroup(this, "AlbSecurityGroup", {
      vpc,
      description: "API load balancer: HTTPS and HTTP (redirected) from anywhere",
      allowAllOutbound: false,
    });
    albSecurityGroup.addIngressRule(ec2.Peer.anyIpv4(), ec2.Port.tcp(443), "HTTPS");
    albSecurityGroup.addIngressRule(ec2.Peer.anyIpv4(), ec2.Port.tcp(80), "HTTP, redirected to HTTPS");
    Validations.of(albSecurityGroup).acknowledge({
      id: "AwsSolutions::AwsSolutions-EC23",
      reason: "The API is public: the load balancer accepts 443, and 80 only to redirect to 443.",
    });

    const alb = new elbv2.ApplicationLoadBalancer(this, "LoadBalancer", {
      vpc,
      internetFacing: true,
      securityGroup: albSecurityGroup,
      vpcSubnets: { subnetType: ec2.SubnetType.PUBLIC },
      dropInvalidHeaderFields: true,
    });
    Validations.of(alb).acknowledge({
      id: "AwsSolutions::AwsSolutions-ELB2",
      reason:
        "The API logs one structured line per request with its request ID (#14, #26). ALB access logs need an S3 bucket; revisit with Stage 7 hardening.",
    });
    alb.addRedirect({ sourcePort: 80, targetPort: 443 });
    const httpsListener = alb.addListener("Https", {
      port: 443,
      certificates: [certificate],
      sslPolicy: elbv2.SslPolicy.RECOMMENDED_TLS,
      // The ALB security group above already allows 443 from anywhere.
      open: false,
    });

    const cluster = new ecs.Cluster(this, "Cluster", { vpc });
    Validations.of(cluster).acknowledge({
      id: "AwsSolutions::AwsSolutions-ECS4",
      reason:
        "One task: ECS's free service metrics (CPU, memory) and the API's own logs are enough. Container Insights adds cost; revisit with Stage 7 hardening.",
    });

    // CloudFormation names the group. A fixed name plus RETAIN would make a
    // recreated stack fail: the retained group would already exist.
    const logGroup = new logs.LogGroup(this, "ApiLogs", {
      retention: settings.logRetentionDays,
      removalPolicy: RemovalPolicy.RETAIN,
    });

    const taskDefinition = new ecs.FargateTaskDefinition(this, "TaskDefinition", {
      cpu: settings.cpu,
      memoryLimitMiB: settings.memoryMiB,
      runtimePlatform: {
        cpuArchitecture: ecs.CpuArchitecture.ARM64,
        operatingSystemFamily: ecs.OperatingSystemFamily.LINUX,
      },
    });

    Validations.of(taskDefinition).acknowledge({
      id: "AwsSolutions::AwsSolutions-ECS2",
      reason:
        "The plain environment variables are non-secret config (port, version). Secrets come from Secrets Manager.",
    });

    // ECS reads these when a task starts, through the execution role.
    const startupSecrets = Object.fromEntries(
      Object.entries(environment.secrets.startup).map(([envName, secretId]) => [
        envName,
        ecs.Secret.fromSecretsManager(
          secretsmanager.Secret.fromSecretCompleteArn(this, `Secret-${envName}`, this.secretArn(secretId)),
        ),
      ]),
    );

    // The repository lives in FreshcastShared; referencing it by name keeps
    // the stacks independent of each other's exports.
    const repository = ecr.Repository.fromRepositoryName(
      this,
      "ApiRepository",
      config.apiImage.repositoryName,
    );

    taskDefinition.addContainer("Api", {
      image: ecs.ContainerImage.fromEcrRepository(repository, imageTag),
      portMappings: [{ containerPort: settings.containerPort }],
      environment: {
        // Fargate sets AWS_REGION itself.
        PORT: String(settings.containerPort),
        // /health/live reports the deployed commit (#28).
        APP_VERSION: imageTag,
      },
      secrets: startupSecrets,
      logging: ecs.LogDrivers.awsLogs({ logGroup, streamPrefix: "api" }),
      // The container must keep running; if it exits, the task stops and ECS
      // starts a new one.
      essential: true,
    });

    // Adding the container created the execution role (ECR pull, logs,
    // startup secrets).
    Validations.of(taskDefinition.obtainExecutionRole()).acknowledge({
      id: "AwsSolutions::AwsSolutions-IAM5[Resource::*]",
      reason: "ecr:GetAuthorizationToken has no resource-level permissions; it must be granted on *.",
    });

    // The API reads these itself, through the task role (least privilege:
    // S3, Textract and SES come with #40, #42 and #46).
    for (const [envName, secretId] of Object.entries(environment.secrets.runtime)) {
      secretsmanager.Secret.fromSecretCompleteArn(
        this,
        `Secret-${envName}`,
        this.secretArn(secretId),
      ).grantRead(taskDefinition.taskRole);
    }

    const serviceSecurityGroup = new ec2.SecurityGroup(this, "ServiceSecurityGroup", {
      vpc,
      description: "API tasks: the API port from the load balancer only",
      // Outbound to Neon, ECR, Secrets Manager and Claude.
      allowAllOutbound: true,
    });

    const service = new ecs.FargateService(this, "Service", {
      cluster,
      taskDefinition,
      desiredCount: 1,
      // Public subnets without NAT: a task needs a public IP to reach ECR and
      // Secrets Manager. The security group admits only the ALB.
      assignPublicIp: true,
      vpcSubnets: { subnetType: ec2.SubnetType.PUBLIC },
      securityGroups: [serviceSecurityGroup],
      // Rolling deploys: start the new task, wait for it to pass the health
      // check, then stop the old one.
      minHealthyPercent: 100,
      maxHealthyPercent: 200,
      // A task that can't start (e.g. a bad DATABASE_URL: the startup
      // database check exits the process) fails the deploy, and ECS rolls
      // back to the previous task definition.
      circuitBreaker: { enable: true, rollback: true },
      healthCheckGracePeriod: Duration.seconds(settings.healthCheckGracePeriodSeconds),
    });

    httpsListener.addTargets("Api", {
      port: settings.containerPort,
      protocol: elbv2.ApplicationProtocol.HTTP,
      targets: [service],
      deregistrationDelay: Duration.seconds(settings.deregistrationDelaySeconds),
      healthCheck: {
        path: settings.healthCheckPath,
        healthyHttpCodes: "200",
        interval: Duration.seconds(15),
        healthyThresholdCount: 2,
        unhealthyThresholdCount: 3,
      },
    });

    new route53.ARecord(this, "ApiRecord", {
      zone: this.hostedZone,
      recordName: domainName,
      target: route53.RecordTarget.fromAlias(new targets.LoadBalancerTarget(alb)),
    });

    new CfnOutput(this, "ApiUrl", { value: `https://${domainName}` });
    // For `aws ecs update-service --force-new-deployment` after a secret
    // changes, and for finding the logs.
    new CfnOutput(this, "ClusterName", { value: cluster.clusterName });
    new CfnOutput(this, "ServiceName", { value: service.serviceName });
    new CfnOutput(this, "LogGroupName", { value: logGroup.logGroupName });
  }
}
