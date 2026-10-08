import { NextResponse } from 'next/server';
import { db } from '../../../lib/db';

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const search = searchParams.get('search') || '';

  let result;
  if (search) {
    result = await db.query(
      `SELECT * FROM invoices WHERE invoice_no ILIKE $1 OR customer_name ILIKE $2 OR customer_phone ILIKE $3 OR parcel_id ILIKE $4 ORDER BY created_at DESC`,
      [`%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`]
    );
  } else {
    result = await db.query('SELECT * FROM invoices ORDER BY created_at DESC');
  }

  return NextResponse.json({ invoices: result.rows });
}

export async function POST(request) {
  const client = await db.getClient();
  try {
    await client.query('BEGIN');

    const body = await request.json();
    const { invoice_no, invoice_date, customer_name, customer_phone, customer_address, parcel_id, discount_type, discount_value, delivery_charge, line_items } = body;

    if (!customer_name) {
      await client.query('ROLLBACK');
      return NextResponse.json({ error: 'Customer name is required' }, { status: 400 });
    }
    if (!line_items || line_items.length === 0) {
      await client.query('ROLLBACK');
      return NextResponse.json({ error: 'At least one item is required' }, { status: 400 });
    }

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

    // Server-side stock validation (the UI already enforces this)
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

    // Calculate total
    let subtotal = 0;
    for (const li of line_items) {
      subtotal += li.line_total;
    }
    const dVal = parseFloat(discount_value) || 0;
    let discountAmount = discount_type === 'percent' ? subtotal * (dVal / 100) : dVal;
    discountAmount = Math.max(0, Math.min(discountAmount, subtotal));
    const delivery = parseFloat(delivery_charge) || 0;
    const total = subtotal - discountAmount + delivery;

    // Insert invoice
    const invResult = await client.query(
      `INSERT INTO invoices (invoice_no, invoice_date, customer_name, customer_phone, customer_address, parcel_id, discount_type, discount_value, delivery_charge, total)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING *`,
      [invoice_no, invoice_date, customer_name, customer_phone || '', customer_address || '', parcel_id || '', discount_type || 'none', dVal, delivery, total]
    );
    const invoice = invResult.rows[0];

    // Insert line items and deduct stock
    for (const li of line_items) {
      await client.query(
        `INSERT INTO invoice_items (invoice_id, item_id, description, quantity, unit_price, line_total)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [invoice.id, li.item_id, li.description, li.quantity, li.unit_price, li.line_total]
      );

      // Deduct stock; freeze the aging clock when it sells out
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
    return NextResponse.json({ invoice }, { status: 201 });
  } catch (error) {
    await client.query('ROLLBACK');
    return NextResponse.json({ error: 'Failed to create invoice' }, { status: 500 });
  } finally {
    client.release();
  }
}
