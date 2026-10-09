import { NextResponse } from 'next/server';
import { db } from '../../../../lib/db';

export async function PUT(request, { params }) {
  try {
    const { id } = params;
    const body = await request.json();
    const { sku, name, category, quantity, price, cost_price, notes } = body;

    const sets = [
      'sku=$1', 'name=$2', 'category=$3', 'quantity=$4', 'price=$5', 'cost_price=$6', 'notes=$7',
      'updated_at=NOW()',
      'sold_out_at = CASE WHEN $4 > 0 THEN NULL WHEN quantity > 0 THEN NOW() ELSE sold_out_at END',
    ];
    const values = [sku, name, category || '', quantity || 0, price || 0, cost_price || null, notes || ''];

    // image_url is written only when the client sends it explicitly:
    // a data URL replaces the stored photo, null removes it, and an
    // omitted field keeps the existing photo. This way an edit never
    // has to round-trip the heavy base64 or race with image uploads.
    if ('image_url' in body) {
      values.push(body.image_url || null);
      sets.push(`image_url=$${values.length}`);
    }

    values.push(id);
    const result = await db.query(
      `UPDATE items SET ${sets.join(', ')} WHERE id=$${values.length} RETURNING *`,
      values
    );

    if (result.rows.length === 0) {
      return NextResponse.json({ error: 'Item not found' }, { status: 404 });
    }

    return NextResponse.json({ item: result.rows[0] });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to update item' }, { status: 500 });
  }
}

export async function DELETE(request, { params }) {
  try {
    const { id } = params;
    await db.query('DELETE FROM items WHERE id = $1', [id]);
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to delete item' }, { status: 500 });
  }
}
