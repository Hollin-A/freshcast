import { Stack, type StackProps } from "aws-cdk-lib";
import * as route53 from "aws-cdk-lib/aws-route53";
import type { Construct } from "constructs";
import { config } from "./config";

/**
 * Everything one API environment needs to run: the ECS service, load
 * balancer, certificate and the `api.` DNS record (#33). It starts empty
 * apart from the hosted zone lookup. The image repository is shared by every
 * environment and lives in FreshcastShared.
 */
export class ApiStack extends Stack {
  /**
   * The existing `freshcast.site` zone. Add only records this app owns;
   * Amplify manages the rest (ADR-021 §3).
   */
  public readonly hostedZone: route53.IHostedZone;

  constructor(scope: Construct, id: string, props: StackProps) {
    super(scope, id, props);

    this.hostedZone = route53.HostedZone.fromLookup(this, "HostedZone", {
      domainName: config.domainName,
    });
  }
}
