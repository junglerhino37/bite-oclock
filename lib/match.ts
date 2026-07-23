/** Fuzzy restaurant-name matching, shared by the Ask bar, the submit flow,
 * and the server. Menus often print a different name than our listing
 * ("Boheme" vs "Bar Boheme") — near-matches should update the existing spot,
 * not spawn a duplicate. */

export function normalizeName(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFKD")
    .replace(/\b(happy hour|menu|page)\b/g, "")
    .replace(/^(the|a)\s+/, "")
    .replace(/[^a-z0-9]+/g, "");
}

export function levenshtein(a: string, b: string): number {
  const dp = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    let prev = dp[0];
    dp[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const cur = dp[j];
      dp[j] = Math.min(dp[j] + 1, dp[j - 1] + 1, prev + (a[i - 1] === b[j - 1] ? 0 : 1));
      prev = cur;
    }
  }
  return dp[b.length];
}

/** Best fuzzy match for a typed/extracted restaurant name.
 * Score 0 = exact (after normalizing), 1 = prefix/substring ("Boheme" ↔
 * "Bar Boheme"), 2+ = small edit distance ("Marno" → "Marmo").
 * maxScore restricts how loose a match may be (1 = exact/substring only —
 * the right bar for silent server-side attachment). */
export function bestNameMatch<T extends { name: string }>(
  name: string,
  candidates: T[],
  maxScore = Infinity,
): T | null {
  const n = normalizeName(name);
  if (!n) return null;
  let best: T | null = null;
  let bestScore = Infinity;
  for (const c of candidates) {
    const cn = normalizeName(c.name);
    let score: number;
    if (cn === n) score = 0;
    else if (cn.startsWith(n) || n.startsWith(cn) || cn.includes(n) || n.includes(cn)) score = 1;
    else {
      const d = levenshtein(n, cn);
      score = d <= Math.max(2, Math.floor(n.length / 4)) ? 2 + d : Infinity;
    }
    if (score < bestScore) {
      bestScore = score;
      best = c;
    }
  }
  return bestScore <= maxScore ? best : null;
}

/** "307 Fairview St, Houston, TX 77006" → "307fairview" — enough to say two
 * addresses are the same building without a geocoder. */
export function normalizeAddress(s: string): string | null {
  const m = s
    .toLowerCase()
    .replace(/\b(suite|ste|unit|#)\s*[\w-]+/g, "")
    .match(/(\d+)\s+([a-z]+)/);
  return m ? `${m[1]}${m[2]}` : null;
}

/** One listing per physical address: match an extracted address against known
 * spots regardless of what name is printed on the menu. */
export function bestAddressMatch<T extends { address: string }>(
  address: string,
  candidates: T[],
): T | null {
  const a = normalizeAddress(address);
  if (!a) return null;
  return candidates.find((c) => c.address && normalizeAddress(c.address) === a) ?? null;
}
