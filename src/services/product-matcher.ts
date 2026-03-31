type ProductRecord = {
  id: string;
  name: string;
  defaultUnit: string | null;
};

type MatchResult = {
  productId: string;
  productName: string;
  confidence: number;
  matchType: "exact" | "normalized" | "substring" | "fuzzy";
} | null;

function normalize(s: string): string {
  return s.toLowerCase().trim().replace(/s$/, "");
}

function levenshtein(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  const dp: number[][] = Array.from({ length: m + 1 }, () =>
    Array(n + 1).fill(0)
  );
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] =
        a[i - 1] === b[j - 1]
          ? dp[i - 1][j - 1]
          : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
    }
  }
  return dp[m][n];
}

export function matchProduct(
  input: string,
  products: ProductRecord[]
): MatchResult {
  const inputLower = input.toLowerCase().trim();
  const inputNorm = normalize(input);

  // 1. Exact match (case-insensitive)
  for (const p of products) {
    if (p.name.toLowerCase() === inputLower) {
      return { productId: p.id, productName: p.name, confidence: 1, matchType: "exact" };
    }
  }

  // 2. Normalized match (strip trailing 's')
  for (const p of products) {
    if (normalize(p.name) === inputNorm) {
      return { productId: p.id, productName: p.name, confidence: 0.95, matchType: "normalized" };
    }
  }

  // 3. Substring match
  for (const p of products) {
    const pLower = p.name.toLowerCase();
    if (pLower.includes(inputLower) || inputLower.includes(pLower)) {
      return { productId: p.id, productName: p.name, confidence: 0.8, matchType: "substring" };
    }
  }

  // 4. Levenshtein distance <= 2
  for (const p of products) {
    if (levenshtein(inputNorm, normalize(p.name)) <= 2) {
      return { productId: p.id, productName: p.name, confidence: 0.6, matchType: "fuzzy" };
    }
  }

  return null;
}
