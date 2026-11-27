import { Duration, RemovalPolicy, Stack, type StackProps } from "aws-cdk-lib";
import * as ecr from "aws-cdk-lib/aws-ecr";
import type { Construct } from "constructs";
import { config } from "./config";

/**
 * Resources that every API environment shares. Today that is the image
 * repository: CI builds each commit's image once, and staging and then
 * production run that same image ("build once, deploy many").
 */
export class SharedStack extends Stack {
  public readonly apiRepository: ecr.IRepository;

  constructor(scope: Construct, id: string, props: StackProps) {
    super(scope, id, { ...props, terminationProtection: true });

    // Holds state: don't rename or move this construct without checking
    // `cdk diff`. A new construct ID replaces the repository and deletes its
    // images.
    this.apiRepository = new ecr.Repository(this, "ApiRepository", {
      repositoryName: config.apiImage.repositoryName,
      // An image's tag is its git SHA (#34), so a tag must always name the
      // same image. A push that reuses a tag fails.
      imageTagMutability: ecr.TagMutability.IMMUTABLE,
      // Basic scanning for known CVEs, which is free. Enhanced scanning
      // (Inspector) costs extra.
      imageScanOnPush: true,
      // Deleting the stack leaves the repository and its images; remove
      // them by hand if that is really meant.
      removalPolicy: RemovalPolicy.RETAIN,
      lifecycleRules: [
        {
          description: "Remove untagged images (failed or replaced pushes)",
          tagStatus: ecr.TagStatus.UNTAGGED,
          maxImageAge: Duration.days(1),
        },
        {
          description: `Keep the last ${config.apiImage.imagesToKeep} images for rollback`,
          tagStatus: ecr.TagStatus.ANY,
          maxImageCount: config.apiImage.imagesToKeep,
        },
      ],
    });
  }
}
