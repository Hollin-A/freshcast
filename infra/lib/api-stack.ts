import { Stack, type StackProps } from "aws-cdk-lib";
import * as route53 from "aws-cdk-lib/aws-route53";
import type { Construct } from "constructs";
import { config } from "./config";

/**
 * Everything the API needs to run: the image registry, ECS service, load
 * balancer, certificate and the `api.` DNS record (#32, #33). It starts
 * empty apart from the hosted zone lookup.
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
