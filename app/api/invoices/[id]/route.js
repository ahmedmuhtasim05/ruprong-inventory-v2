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
        await client.query('UPDATE items SET quantity = quantity + $1, updated_at = NOW(), sold_out_at = NULL WHERE id = $2', [item.quantity, item.item_id]);
      }
    }

    // Delete old line items
    await client.query('DELETE FROM invoice_items WHERE invoice_id = $1', [id]);

    // Validate quantities and total up requested stock per inventory item
    const requestedByItem = new Map();
    for (const li of line_items) {
      const qty = parseInt(li.quantity, 10);
      if (!Number.isFinite(qty) || qty <= 0) {
        await client.query('ROLLBACK');
        return NextResponse.json({ error: 'Line item quantity must be a positive number' }, { status: 400 });
      }
      if (li.item_id) {
        const key = String(li.item_id);
        requestedByItem.set(key, (requestedByItem.get(key) || 0) + qty);
      }
    }

    // Server-side stock validation (original stock was restored above)
    if (requestedByItem.size > 0) {
      const ids = [...requestedByItem.keys()].map(Number);
      const stockResult = await client.query(
        'SELECT id, name, quantity FROM items WHERE id = ANY($1)',
        [ids]
      );
      const insufficient = [];
      for (const row of stockResult.rows) {
        const requested = requestedByItem.get(String(row.id)) || 0;
        if (requested > row.quantity) {
          insufficient.push(`${row.name}: ${requested} requested, only ${row.quantity} in stock`);
        }
      }
      if (insufficient.length > 0) {
        await client.query('ROLLBACK');
        return NextResponse.json({ error: 'Insufficient stock', details: insufficient }, { status: 400 });
      }
    }

    // Calculate new total
    let subtotal = 0;
    for (const li of line_items) {
      subtotal += parseFloat(li.line_total) || 0;
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
        await client.query(
          `UPDATE items SET quantity = quantity - $1, updated_at = NOW(),
           sold_out_at = CASE WHEN quantity - $1 <= 0 THEN NOW() ELSE NULL END
           WHERE id = $2`,
          [li.quantity, li.item_id]
        );
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
        await client.query('UPDATE items SET quantity = quantity + $1, updated_at = NOW(), sold_out_at = NULL WHERE id = $2', [item.quantity, item.item_id]);
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
