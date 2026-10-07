import { NextResponse } from 'next/server';
import { db } from '../../../../lib/db';

const SAMPLE_CUSTOMER = 'Sample Customer';

// Creates (or refreshes) an invoice covering every item that is currently
// out of stock (quantity 0). Sample invoices record sales of sold-out
// products, so they never deduct stock.
export async function POST(request) {
  const client = await db.getClient();
  try {
    await client.query('BEGIN');

    // Replace any existing sample invoice. Sample invoices do not deduct
    // stock, so no stock restoration is needed when removing them.
    const oldResult = await client.query('SELECT id FROM invoices WHERE customer_name = $1', [SAMPLE_CUSTOMER]);
    for (const inv of oldResult.rows) {
      await client.query('DELETE FROM invoice_items WHERE invoice_id = $1', [inv.id]);
      await client.query('DELETE FROM invoices WHERE id = $1', [inv.id]);
    }

    // All items that are currently out of stock
    const itemsResult = await client.query(
      'SELECT id, name, price FROM items WHERE quantity = 0 ORDER BY sku'
    );
    if (itemsResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return NextResponse.json({ error: 'No out-of-stock items found' }, { status: 400 });
    }

    // Next invoice number (same logic as /api/invoices/next-number)
    const lastResult = await client.query(
      'SELECT invoice_no FROM invoices ORDER BY created_at DESC LIMIT 1'
    );
    let nextNum = 1;
    if (lastResult.rows.length > 0) {
      const match = lastResult.rows[0].invoice_no.match(/(\d+)/);
      if (match) nextNum = parseInt(match[1], 10) + 1;
    }
    const invoiceNo = `INV-${String(nextNum).padStart(4, '0')}`;

    const today = new Date().toISOString().slice(0, 10);
    let total = 0;
    const lineItems = itemsResult.rows.map((it) => {
      const lineTotal = parseFloat(it.price) || 0;
      total += lineTotal;
      return { item_id: it.id, description: it.name, quantity: 1, unit_price: it.price, line_total: lineTotal };
    });

    const invResult = await client.query(
      `INSERT INTO invoices (invoice_no, invoice_date, customer_name, customer_phone, customer_address, parcel_id, discount_type, discount_value, delivery_charge, total)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING *`,
      [invoiceNo, today, SAMPLE_CUSTOMER, '', '', '', 'none', 0, 0, total]
    );

    for (const li of lineItems) {
      await client.query(
        `INSERT INTO invoice_items (invoice_id, item_id, description, quantity, unit_price, line_total)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [invResult.rows[0].id, li.item_id, li.description, li.quantity, li.unit_price, li.line_total]
      );
    }

    await client.query('COMMIT');
    return NextResponse.json({ invoice: invResult.rows[0], itemCount: lineItems.length }, { status: 201 });
  } catch (error) {
    await client.query('ROLLBACK');
    return NextResponse.json({ error: 'Failed to create invoice' }, { status: 500 });
  } finally {
    client.release();
  }
}
