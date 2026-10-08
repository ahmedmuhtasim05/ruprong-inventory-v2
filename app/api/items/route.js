import { NextResponse } from 'next/server';
import { db } from '../../../lib/db';
import { compareItemsBySku, getNextSerialSku } from '../../../lib/sku';

// List views must stay fast: the heavy base64 image_url column is
// excluded here and fetched per item via /api/items/[id]/image.
const LIST_COLUMNS = 'id, sku, name, category, quantity, price, cost_price, notes, (image_url IS NOT NULL) AS has_image, created_at, updated_at, sold_out_at';

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const search = searchParams.get('search') || '';

  let result;
  if (search) {
    result = await db.query(
      `SELECT ${LIST_COLUMNS} FROM items WHERE name ILIKE $1 OR sku ILIKE $2 OR category ILIKE $3`,
      [`%${search}%`, `%${search}%`, `%${search}%`]
    );
  } else {
    result = await db.query(`SELECT ${LIST_COLUMNS} FROM items`);
  }

  // Show SKUs in serial order: BN1, BN2, BN3, ...
  const items = [...result.rows].sort(compareItemsBySku);

  return NextResponse.json({ items });
}

export async function POST(request) {
  try {
    const body = await request.json();
    const { sku, name, category, quantity, price, cost_price, notes, image_url } = body;

    if (!name) return NextResponse.json({ error: 'Name is required' }, { status: 400 });

    // Generate a serial SKU (BN1, BN2, ...) when none is provided
    const autoSku = !sku || !String(sku).trim();
    let finalSku = autoSku ? null : String(sku).trim();
    let attempts = 0;

    while (attempts <= 5) {
      if (!finalSku) finalSku = await getNextSerialSku(db);
      try {
        const result = await db.query(
          `INSERT INTO items (sku, name, category, quantity, price, cost_price, notes, image_url, sold_out_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, CASE WHEN $4 <= 0 THEN NOW() ELSE NULL END) RETURNING *`,
          [finalSku, name, category || '', quantity || 0, price || 0, cost_price || null, notes || '', image_url || null]
        );
        return NextResponse.json({ item: result.rows[0] }, { status: 201 });
      } catch (err) {
        if (err.code === '23505') {
          if (autoSku && attempts < 5) {
            // Another request just took this serial number — retry with the next one
            attempts++;
            finalSku = null;
            continue;
          }
          return NextResponse.json({ error: `SKU ${finalSku} already exists` }, { status: 409 });
        }
        throw err;
      }
    }

    return NextResponse.json({ error: 'Failed to create item' }, { status: 500 });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to create item' }, { status: 500 });
  }
}
