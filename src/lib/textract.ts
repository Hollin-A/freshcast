import {
  DetectDocumentTextCommand,
  TextractClient,
} from "@aws-sdk/client-textract";
import { getAwsRuntimeConfig } from "./aws-config";

let client: TextractClient | null = null;

function getTextractClient(): TextractClient {
  if (!client) {
    client = new TextractClient(getAwsRuntimeConfig());
  }
  return client;
}

export async function extractReceiptTextFromS3(
  bucket: string,
  key: string
): Promise<string> {
  const textract = getTextractClient();
  const response = await textract.send(
    new DetectDocumentTextCommand({
      Document: {
        S3Object: {
          Bucket: bucket,
          Name: key,
        },
      },
    })
  );

  const lines =
    response.Blocks?.filter((b) => b.BlockType === "LINE")
      .map((b) => b.Text?.trim())
      .filter((t): t is string => Boolean(t)) ?? [];

  return lines.join(", ");
}
