import { NextResponse } from 'next/server';
import { db } from '../../../../lib/db';

export async function GET(request, { params }) {
  const { id } = params;
  const invResult = await db.query('SELECT * FROM invoices WHERE id = $1', [id]);
  if (invResult.rows.length === 0) {
    return NextResponse.json({ error: 'Invoice not found' }, { status: 404 });
  }

  const itemsResult = await db.query('SELECT * FROM invoice_items WHERE invoice_id = $1', [id]);

  return NextResponse.json({ invoice: invResult.rows[0], items: itemsResult.rows });
}

export async function PUT(request, { params }) {
  const client = await db.getClient();
  try {
    await client.query('BEGIN');

    const { id } = params;
    const body = await request.json();
    const { customer_name, customer_phone, customer_address, parcel_id, invoice_date, discount_type, discount_value, delivery_charge, line_items } = body;

    // Get original invoice items to restore stock
    const origItems = await client.query('SELECT * FROM invoice_items WHERE invoice_id = $1', [id]);
    for (const item of origItems.rows) {
      if (item.item_id) {
        await client.query('UPDATE items SET quantity = quantity + $1 WHERE id = $2', [item.quantity, item.item_id]);
      }
    }

    // Delete old line items
    await client.query('DELETE FROM invoice_items WHERE invoice_id = $1', [id]);

    // Calculate new total
    let subtotal = 0;
    for (const li of line_items) {
      subtotal += li.line_total;
    }
    const dVal = parseFloat(discount_value) || 0;
    let discountAmount = discount_type === 'percent' ? subtotal * (dVal / 100) : dVal;
    discountAmount = Math.max(0, Math.min(discountAmount, subtotal));
    const delivery = parseFloat(delivery_charge) || 0;
    const total = subtotal - discountAmount + delivery;

    // Update invoice
    await client.query(
      `UPDATE invoices SET customer_name=$1, customer_phone=$2, customer_address=$3, parcel_id=$4, invoice_date=$5, discount_type=$6, discount_value=$7, delivery_charge=$8, total=$9
       WHERE id=$10`,
      [customer_name, customer_phone || '', customer_address || '', parcel_id || '', invoice_date, discount_type || 'none', dVal, delivery, total, id]
    );

    // Insert new line items and deduct stock
    for (const li of line_items) {
      await client.query(
        `INSERT INTO invoice_items (invoice_id, item_id, description, quantity, unit_price, line_total)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [id, li.item_id, li.description, li.quantity, li.unit_price, li.line_total]
      );

      if (li.item_id) {
        await client.query('UPDATE items SET quantity = quantity - $1, updated_at = NOW() WHERE id = $2', [li.quantity, li.item_id]);
      }
    }

    await client.query('COMMIT');
    return NextResponse.json({ success: true });
  } catch (error) {
    await client.query('ROLLBACK');
    return NextResponse.json({ error: 'Failed to update invoice' }, { status: 500 });
  } finally {
    client.release();
  }
}

export async function DELETE(request, { params }) {
  const client = await db.getClient();
  try {
    await client.query('BEGIN');

    const { id } = params;

    // Restore stock
    const items = await client.query('SELECT * FROM invoice_items WHERE invoice_id = $1', [id]);
    for (const item of items.rows) {
      if (item.item_id) {
        await client.query('UPDATE items SET quantity = quantity + $1, updated_at = NOW() WHERE id = $2', [item.quantity, item.item_id]);
      }
    }

    await client.query('DELETE FROM invoices WHERE id = $1', [id]);

    await client.query('COMMIT');
    return NextResponse.json({ success: true });
  } catch (error) {
    await client.query('ROLLBACK');
    return NextResponse.json({ error: 'Failed to delete invoice' }, { status: 500 });
  } finally {
    client.release();
  }
}
