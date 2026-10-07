import { NextResponse } from 'next/server';
import { db } from '../../../../lib/db';

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const search = searchParams.get('search') || '';

  let result;
  if (search) {
    result = await db.query(
      `SELECT * FROM items WHERE name ILIKE $1 OR sku ILIKE $2 OR category ILIKE $3 ORDER BY name`,
      [`%${search}%`, `%${search}%`, `%${search}%`]
    );
  } else {
    result = await db.query('SELECT * FROM items ORDER BY name');
  }

  return NextResponse.json({ items: result.rows });
}

export async function POST(request) {
  try {
    const body = await request.json();
    const { sku, name, category, quantity, price, cost_price, notes, image_url } = body;

    if (!name) return NextResponse.json({ error: 'Name is required' }, { status: 400 });

    // Generate SKU if not provided
    let finalSku = sku;
    if (!finalSku) {
      const maxResult = await db.query(
        "SELECT MAX(CAST(SUBSTRING(sku FROM 3) AS INTEGER)) as max_num FROM items WHERE sku LIKE 'BN%'"
      );
      const nextNum = (maxResult.rows[0]?.max_num || 0) + 1;
      finalSku = `BN${nextNum}`;
    }

    const result = await db.query(
      `INSERT INTO items (sku, name, category, quantity, price, cost_price, notes, image_url)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
      [finalSku, name, category || '', quantity || 0, price || 0, cost_price || null, notes || '', image_url || null]
    );

    return NextResponse.json({ item: result.rows[0] }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to create item' }, { status: 500 });
  }
}
