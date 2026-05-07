import "server-only";
import {
  AnalyzeExpenseCommand,
  TextractClient,
  type ExpenseField,
  type LineItemFields,
} from "@aws-sdk/client-textract";
import { getAwsRuntimeConfig } from "./aws-config";

let client: TextractClient | null = null;

function getTextractClient(): TextractClient {
  if (!client) {
    client = new TextractClient(getAwsRuntimeConfig());
  }
  return client;
}

/**
 * A single line item extracted from a receipt by AWS Textract AnalyzeExpense.
 * Pre-structured by AWS — `description` and `quantity` are separated rather
 * than buried in raw OCR text. See ADR-019.
 */
export type ReceiptLineItem = {
  description: string;
  quantity: number | null;
  unit: string | null;
  unitPrice: number | null;
  total: number | null;
  rawRow: string | null;
};

export type ReceiptExtraction = {
  lineItems: ReceiptLineItem[];
  rawText: string;
};

function getFieldValue(
  fields: ExpenseField[] | undefined,
  typeText: string
): string | null {
  if (!fields) return null;
  for (const field of fields) {
    if (field.Type?.Text === typeText) {
      const value = field.ValueDetection?.Text?.trim();
      if (value) return value;
    }
  }
  return null;
}

function parseNumeric(value: string | null): number | null {
  if (!value) return null;
  const cleaned = value.replace(/[^\d.\-]/g, "");
  if (!cleaned) return null;
  const num = parseFloat(cleaned);
  return Number.isFinite(num) ? num : null;
}

function mapLineItem(item: LineItemFields): ReceiptLineItem | null {
  const fields = item.LineItemExpenseFields;
  const description = getFieldValue(fields, "ITEM");
  if (!description) return null;

  const quantityRaw = getFieldValue(fields, "QUANTITY");
  const unitPriceRaw = getFieldValue(fields, "UNIT_PRICE");
  const totalRaw = getFieldValue(fields, "PRICE");
  const rawRow = getFieldValue(fields, "EXPENSE_ROW");

  return {
    description,
    quantity: parseNumeric(quantityRaw),
    unit: null,
    unitPrice: parseNumeric(unitPriceRaw),
    total: parseNumeric(totalRaw),
    rawRow,
  };
}

/**
 * Run AnalyzeExpense on an S3-hosted receipt image and return structured
 * line items plus a flat text rendering for display fallback.
 *
 * The text rendering preserves layout via `\n` joins so the LLM (or any
 * future text-based consumer) sees semantic line breaks rather than the
 * comma-collapsed shape the previous DetectDocumentText path produced.
 */
export async function extractReceiptFromS3(
  bucket: string,
  key: string
): Promise<ReceiptExtraction> {
  const textract = getTextractClient();
  const response = await textract.send(
    new AnalyzeExpenseCommand({
      Document: {
        S3Object: {
          Bucket: bucket,
          Name: key,
        },
      },
    })
  );

  const lineItems: ReceiptLineItem[] = [];
  for (const doc of response.ExpenseDocuments ?? []) {
    for (const group of doc.LineItemGroups ?? []) {
      for (const item of group.LineItems ?? []) {
        const mapped = mapLineItem(item);
        if (mapped) lineItems.push(mapped);
      }
    }
  }

  const rawTextLines = lineItems.map((item) => item.rawRow ?? item.description);
  const rawText = rawTextLines.join("\n");

  return { lineItems, rawText };
}

// Exported for unit tests — pure mapping over an AWS response object.
export function mapAnalyzeExpenseResponse(response: {
  ExpenseDocuments?: Array<{
    LineItemGroups?: Array<{ LineItems?: LineItemFields[] }>;
  }>;
}): ReceiptLineItem[] {
  const lineItems: ReceiptLineItem[] = [];
  for (const doc of response.ExpenseDocuments ?? []) {
    for (const group of doc.LineItemGroups ?? []) {
      for (const item of group.LineItems ?? []) {
        const mapped = mapLineItem(item);
        if (mapped) lineItems.push(mapped);
      }
    }
  }
  return lineItems;
}
