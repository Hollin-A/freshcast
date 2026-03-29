// Extend NextAuth session types
declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      email: string;
      name?: string | null;
      image?: string | null;
    };
  }
}

// Parsed sales item from NL parser
export type ParsedSalesItem = {
  rawText: string;
  product: string;
  productId: string | null;
  quantity: number;
  unit: string | null;
  matched: boolean;
};

// API response types
export type ParseResponse = {
  parsed: ParsedSalesItem[];
  unmatched: string[];
};
