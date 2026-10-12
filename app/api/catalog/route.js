import { NextResponse } from 'next/server';
import { db } from '../../../lib/db';
import { compareItemsBySku } from '../../../lib/sku';

// PUBLIC read-only product catalog used by the Home page, which is
// visible to anyone with the link. Only customer-facing fields are
// returned — internal data (cost price, notes) is never exposed.
export async function GET() {
  const CATALOG_COLUMNS = 'id, sku, name, category, quantity, price, (image_url IS NOT NULL) AS has_image, updated_at';
  const result = await db.query(`SELECT ${CATALOG_COLUMNS} FROM items`);
  const items = [...result.rows].sort(compareItemsBySku);
  return NextResponse.json({ items });
}
