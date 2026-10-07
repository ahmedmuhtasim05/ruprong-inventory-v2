import { NextResponse } from 'next/server';
import { db } from '../../../../../lib/db';

// Returns a single item's image. List endpoints intentionally exclude
// the heavy base64 image column; clients fetch images on demand with
// this route so listing pages stay fast.
export async function GET(request, { params }) {
  const { id } = params;
  const result = await db.query('SELECT image_url FROM items WHERE id = $1', [id]);
  if (result.rows.length === 0) {
    return NextResponse.json({ error: 'Item not found' }, { status: 404 });
  }
  return NextResponse.json({ image_url: result.rows[0].image_url });
}
