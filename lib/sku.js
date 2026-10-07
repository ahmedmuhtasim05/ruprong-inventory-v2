// Serial SKU helpers. Auto-generated SKUs follow BN1, BN2, BN3, ...

const SERIAL_SKU_PATTERN = /^([A-Za-z]*)(\d+)$/;
const BN_SERIAL_PATTERN = /^BN(\d+)$/;

// Natural (serial) comparison of two SKU strings:
// BN1 < BN2 < ... < BN10 < BR1 < C1 ...
export function compareSkus(a, b) {
  const sa = (a || '').trim();
  const sb = (b || '').trim();
  const ma = SERIAL_SKU_PATTERN.exec(sa);
  const mb = SERIAL_SKU_PATTERN.exec(sb);
  if (ma && mb) {
    if (ma[1] !== mb[1]) return ma[1].localeCompare(mb[1]);
    return parseInt(ma[2], 10) - parseInt(mb[2], 10);
  }
  return sa.localeCompare(sb);
}

// Comparator for item objects returned by the API
export function compareItemsBySku(a, b) {
  return compareSkus(a.sku, b.sku);
}

// Next BN serial given a list of existing SKU strings.
// Ignores any SKU that is not exactly BN<digits>, so odd
// entries (e.g. "BN-test") never break numbering.
export function nextSerialSku(existingSkus) {
  let max = 0;
  for (const sku of existingSkus || []) {
    const m = BN_SERIAL_PATTERN.exec((sku || '').trim());
    if (m) {
      const n = parseInt(m[1], 10);
      if (n > max) max = n;
    }
  }
  return `BN${max + 1}`;
}

// Next BN serial straight from the database
export async function getNextSerialSku(db) {
  const result = await db.query("SELECT sku FROM items WHERE sku LIKE 'BN%'");
  return nextSerialSku(result.rows.map((r) => r.sku));
}
