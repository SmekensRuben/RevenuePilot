// Tier logic with range support and per-article unit conversion
// Works stand-alone. Import the functions you need in your DetailPage.

// ---- Public API ----
// normalizeTiers(tiers)
// tierIndexFor(value, tiers)
// nextTierProgress(value, tiers)
// computeEligibleTierUnits(agreement, orderedByArticle)
// computeRebateTotal(eligibleTierUnits, tiers, method)

export function normalizeTiers(tiers = []) {
  // Accept legacy {threshold, rate|rebate} → map to ranges
  const mapped = tiers.map((t) => ({
    from: num(t.from ?? t.threshold ?? 0),
    to: t.to == null || t.to === '' ? null : num(t.to),
    rebate: num(t.rebate ?? t.rate ?? 0),
  }));

  // Sort by 'from'
  mapped.sort((a, b) => a.from - b.from);

  // Make them non-overlapping & ascending (cap previous if needed)
  const out = [];
  for (const t of mapped) {
    if (!out.length) { out.push({ ...t }); continue; }
    const prev = out[out.length - 1];
    if (prev.to == null) {
      // previous open-ended → close at this 'from'
      prev.to = Math.max(prev.from, t.from);
      out.push({ ...t });
    } else if (t.from < prev.to) {
      // overlap → shift current.from to prev.to
      out.push({ ...t, from: prev.to });
    } else {
      out.push({ ...t });
    }
  }

  // Ensure interior tiers are closed; last may stay open (null)
  for (let i = 0; i < out.length - 1; i++) {
    if (out[i].to == null) out[i].to = out[i + 1].from;
  }
  return out;
}

export function tierIndexFor(value, tiers) {
  return tiers.findIndex((t) => value >= t.from && (t.to == null || value < t.to));
}

export function nextTierProgress(value, tiers) {
  if (!tiers.length) return { label: 'No tiers', percent: 0, needed: 0 };

  const idx = tierIndexFor(value, tiers);
  if (idx === -1) {
    // before first tier
    const to = tiers[0].from;
    const needed = Math.max(0, to - value);
    const span = Math.max(1, to); // avoid /0
    const percent = Math.round((value / span) * 100);
    return { label: `${fmt(needed)} units to first tier`, percent, needed };
  }

  const current = tiers[idx];
  const next = tiers[idx + 1];
  if (!next) return { label: 'Max tier reached', percent: 100, needed: 0 };

  const span = next.from - current.from;
  const progressed = Math.min(value, next.from) - current.from;
  const percent = span ? Math.round((progressed / span) * 100) : 0;
  const needed = Math.max(0, next.from - value);
  return { label: `${fmt(needed)} units to next tier`, percent, needed };
}

// Sum ordered units per article, converted to "tier units" by factor unitsPerTierUnit.
export function computeEligibleTierUnits(agreement, orderedByArticle = {}) {
  const articles = agreement.articles || [];
  if (!articles.length) return 0;

  return articles.reduce((acc, a) => {
    const id = a?.id || a;
    const ordered = num(orderedByArticle[id] || 0);
    const factor = num(a?.unitsPerTierUnit || 1);
    return acc + (factor > 0 ? ordered / factor : 0);
  }, 0);
}

// method: 'RETROACTIVE' | 'INCREMENTAL'
// rebate is €/tier-unit for each tier
export function computeRebateTotal(eligibleTierUnits, tiers, method = 'RETROACTIVE') {
  if (!tiers.length || eligibleTierUnits <= 0) return 0;

  if (method === 'RETROACTIVE') {
    const idx = tierIndexFor(eligibleTierUnits, tiers);
    if (idx < 0) return 0;
    return eligibleTierUnits * tiers[idx].rebate;
  }

  // INCREMENTAL
  let total = 0;
  for (let i = 0; i < tiers.length; i++) {
    const t = tiers[i];
    const lower = t.from;
    const upper = t.to ?? eligibleTierUnits; // open-ended → cap at actual
    const segment = clamp(eligibleTierUnits, lower, upper) - lower;
    if (segment > 0) total += segment * t.rebate;
    if (t.to == null || eligibleTierUnits < (t.to ?? Infinity)) break;
  }
  return total;
}

// ---- utils ----
const num = (v) => Number(v || 0);
const fmt = (n) => Number(n).toLocaleString();
const clamp = (x, min, max) => Math.max(min, Math.min(x, max));
