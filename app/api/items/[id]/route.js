import { NextResponse } from 'next/server';
import { db } from '../../../../lib/db';

export async function PUT(request, { params }) {
  try {
    const { id } = params;
    const body = await request.json();
    const { sku, name, category, quantity, price, cost_price, notes, image_url } = body;

    const result = await db.query(
      `UPDATE items SET sku=$1, name=$2, category=$3, quantity=$4, price=$5, cost_price=$6, notes=$7, image_url=$8, updated_at=NOW()
       WHERE id=$9 RETURNING *`,
      [sku, name, category || '', quantity || 0, price || 0, cost_price || null, notes || '', image_url || null, id]
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
