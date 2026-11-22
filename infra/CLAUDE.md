# infra: AWS infrastructure (CDK)

The API's AWS resources as AWS CDK code (ADR-021). [Architecture §12](../docs/ARCHITECTURE.md#12-infrastructure) describes the stacks; [CONTRIBUTING](../CONTRIBUTING.md#infrastructure-aws-cdk) covers access, diff and the one-time setup.

## Conventions

- CommonJS TypeScript run by `tsx` (no build step). Relative imports have no extension.
- Build stacks only in `lib/app.ts` (`buildApp`), which the CLI entry point and the tests share.
- Fixed values (AWS Region, domain, GitHub repo and OIDC host, budget) live in `lib/config.ts`; the account ID lives in `cdk.json` (`freshcast:awsAccountId`).
- The `freshcast.site` hosted zone is looked up, never created. Add only records the app owns; never touch Amplify's records.
- Commit `cdk.context.json` after adding a lookup. CI synthesizes before it signs in to AWS, so lookups can't run there.
- No secrets or personal data in code: the repo is public. Read them at deploy time (SSM parameters, Secrets Manager references).
- Don't rename or move a construct holding state (repository, log group, certificate) without checking `cdk diff`: a new construct ID replaces the resource.
- cdk-nag and CloudFormation validation fail synth on any violation. Acknowledge a finding with `Validations.of(construct).acknowledge({ id, reason })` on the narrowest construct, never app-wide.
- Never run `cdk deploy`, `--hotswap` or `--express` against the account without the owner's go-ahead.

## Tests

`test/` asserts on synthesized templates with cached lookup values and never calls AWS. See [docs/TESTING.md](../docs/TESTING.md#infrastructure-tests).
