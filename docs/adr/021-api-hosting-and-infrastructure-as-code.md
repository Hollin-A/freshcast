# ADR-021: API Hosting on ECS Fargate, Infrastructure as Code with AWS CDK

## Status
Accepted. Refines [ADR-020](020-dedicated-nestjs-backend.md): confirms D5 (Fargate hosting) after a comparison of alternatives, moves D9 (infrastructure as code) from Stage 7 to Stage 3, and defers the staging decision from D5 to Stage 4.

## Date
2026-10-07

## Context

Stage 3 of ADR-020 deploys a minimal NestJS API, a walking skeleton that serves `/health`, through every production layer: container image, registry, compute, load balancer, TLS, DNS and CI/CD. Before creating AWS resources, three questions needed a deliberate answer:

1. **Where the API runs.** ADR-020 D5 chose ECS Fargate without comparing alternatives in detail.
2. **How the infrastructure is created and changed.** ADR-020 D9 left infrastructure as code optional until Stage 7.
3. **How DNS for `api.freshcast.site` (and later email authentication, #51) is managed.**

Two observations from Stage 2 shaped the answers:
- **A console-configured schedule failed silently for months.** The legacy EventBridge rule for the weekly email had a deauthorized connection holding a pre-rotation secret. Nobody could tell how it had been configured, and no record or review existed (#74).
- **Runtime environment differences caused production failures twice** (#65, #67), even though local checks passed. Reproducibility and fast, safe rollback matter as much as the initial setup.

### Workload characteristics

- **A stateless HTTP API:** JSON over HTTPS, with all state in Neon Postgres.
- **Steady, low traffic** from a mobile-first web app, with latency-sensitive interactive requests (dashboard, logging sales, chat).
- **A future background worker:** the weekly summary rebuild consumes an SQS queue (#42).
- **Database access through Prisma** with the `pg` driver adapter, which benefits from a long-lived connection pool.
- **NestJS startup cost:** dependency-injection container construction and module initialization run on every cold start.

## Decision

### 1. Hosting: Amazon ECS on Fargate behind an Application Load Balancer

The API runs as a container on ECS Fargate in `ap-southeast-2`, behind an ALB with an ACM certificate for `api.freshcast.site`:
- **One task to start,** on ARM64 (Graviton) for cost.
- **Public subnets** with a restrictive security group; no NAT gateway (ADR-020 D5).
- **Rolling deployments** with ALB health checks against `/health` and the ECS deployment circuit breaker, which rolls back automatically.
- **Secrets** come from AWS Secrets Manager at runtime through the task definition; none are baked into the image.
- **IAM roles:** separate execution and task roles (least privilege).

### 2. Infrastructure as code: AWS CDK (TypeScript), starting in Stage 3

All API infrastructure is defined with AWS CDK in a new `infra/` workspace package:
- ECR, the ECS cluster/service/task definition, the ALB and target group, security groups, IAM roles, log groups, the ACM certificate and DNS records, and the GitHub OIDC deploy role.
- **Changes go through pull requests,** with `cdk diff` output reviewed before deployment.
- **Deployment goes through CloudFormation,** which provides AWS-managed state and automatic rollback of failed updates.

### 3. DNS: reference the existing Route 53 hosted zone

`freshcast.site` is registered at Namecheap and delegated to a Route 53 hosted zone, which also serves the Amplify-managed frontend records.
- **CDK looks up the existing zone** rather than creating a new one, and owns only the records it creates: `api.freshcast.site`, ACM validation records, and later the SES DKIM, MAIL FROM/SPF and DMARC records (#51).
- **Records managed by Amplify are never modified.**

### 4. Staging: deferred to the start of Stage 4

During Stage 3 the API serves only `/health`. A staging environment (a second stack from the same CDK code with a dev Neon branch) starts paying off when business endpoints move in Stage 4, and is decided there.

## Rationale

### Hosting alternatives considered

| Option | Why not chosen |
|---|---|
| **EC2 (a single virtual machine)** | The lowest fixed cost, but OS patching, process supervision, TLS, deploy scripts and rollback are all owned by the application team. A single instance is a single point of failure, and redundancy requires Auto Scaling Groups and AMI management. Fargate gives the same container-level control without host management. |
| **ECS on EC2 capacity** | Cost-efficient when packing many containers onto shared instances. For one small service it combines EC2's operational burden with ECS's concepts. |
| **AWS App Runner** | The simplest container platform, but it offers less control over networking, task configuration and worker processes. |
| **AWS Lambda** (NestJS via an adapter) | Scale-to-zero pricing is attractive, but NestJS bootstrap adds cold-start latency to interactive requests, and short-lived instances churn database connections. Lambda remains a good fit for the queue worker (#42), which is event-driven. |
| **Amazon EKS** | Kubernetes adds a control-plane cost and substantial operational complexity that a single service doesn't need. |
| **AWS Elastic Beanstalk** | An older abstraction over EC2 with less control and transparency than ECS. |

**Why Fargate fits this workload:**
- It suits a stateless containerized API with steady traffic.
- No hosts to manage.
- Health-checked rolling deployments with automatic rollback.
- The same image runs locally, in CI and in production.
- The same platform can run the future queue worker as a second service.

### Infrastructure-as-code alternatives considered

| Option | Why not chosen |
|---|---|
| **Console configuration** | Not reviewable or reproducible, and drifts silently. This is the failure mode behind #74. |
| **AWS CLI scripts** | Repeatable, but not declarative: re-runs, ordering and cleanup must be hand-written. |
| **CloudFormation templates directly** | Native, with rollback and managed state, but verbose and without abstraction or reuse. CDK compiles to it. |
| **Terraform / OpenTofu** | Widely adopted and multi-cloud, but it adds a second language (HCL) and requires managing remote state with locking. For an AWS-only stack written in TypeScript, CDK provides the same declarative model with type-checked, higher-level constructs and CloudFormation-managed state. Terraform would be preferred for multi-cloud infrastructure or an existing team standard. |

Moving infrastructure as code from Stage 7 to Stage 3 costs little: the resources are new, so nothing needs importing. It avoids building the stack twice, makes a Stage 4 staging environment a parameterized second stack, and gives every infrastructure change the same review as application code.

## Consequences

- **Fixed monthly cost:** roughly USD 38–47 in `ap-southeast-2`, mainly the ALB's hourly charge and public IPv4 address charges, plus the Fargate task. That's higher than a single EC2 instance; it's accepted for operability. The estimate should be re-checked with the AWS Pricing Calculator, and an AWS Budget alert set. At higher scale, Compute Savings Plans or ECS on EC2 capacity would reduce cost.
- **New tooling:**
  - CDK must be bootstrapped once per account and region.
  - CI gains a `cdk diff` step on pull requests and a deploy step on `main`, using GitHub OIDC (no stored AWS keys).
- **Abstraction:** CDK's high-level constructs hide some defaults. Generated resources are reviewed in `cdk diff` and the AWS console, and overridden explicitly where needed.
- **Ownership boundary:**
  - CDK owns only the resources and DNS records it creates.
  - The Amplify frontend, its records and the existing Secrets Manager secrets stay managed as today; CDK references them rather than recreating them.
- **Issue changes:**
  - #32, #33, #34 and #51 are implemented in CDK.
  - #50 (optional CDK in Stage 7) is superseded by this ADR.

## References

- [ADR-020: Dedicated NestJS Backend](020-dedicated-nestjs-backend.md) (D5 hosting, D9 infrastructure as code)
- [ADR-018: Secrets in AWS Secrets Manager](018-secrets-manager.md)
- [ADR-008: Business Data Isolation & Privacy Model](008-data-isolation-privacy.md)
- #74: weekly summary email paused (the console-configured scheduler failure)
