import { NextResponse } from 'next/server';
import { db } from '../../../../lib/db';

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const ids = searchParams.get('ids');

  let result;
  if (ids) {
    const idArray = ids.split(',').map(Number);
    result = await db.query('SELECT * FROM items WHERE id = ANY($1) ORDER BY name', [idArray]);
  } else {
    result = await db.query('SELECT * FROM items ORDER BY name');
  }

  const items = result.rows;
  const headers = ['SKU', 'Name', 'Category', 'Quantity', 'Selling Price', 'Cost Price', 'Notes'];
  const rows = items.map(i => [i.sku, i.name, i.category, i.quantity, i.price, i.cost_price || '', i.notes]);

  const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');

  return new NextResponse(csv, {
    headers: { 'Content-Type': 'text/csv', 'Content-Disposition': 'attachment; filename=inventory.csv' },
  });
}
