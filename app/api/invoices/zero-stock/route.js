import { NextResponse } from 'next/server';
import { db } from '../../../../lib/db';

const SAMPLE_CUSTOMER = 'Sample Customer';

// Creates (or refreshes) one invoice per item that is currently out of
// stock (quantity 0). Sample invoices record sales of sold-out products,
// so they never deduct stock.
export async function POST(request) {
  const client = await db.getClient();
  try {
    await client.query('BEGIN');

    // Replace any existing sample invoices. Sample invoices do not deduct
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

    // Invoice numbering (same logic as /api/invoices/next-number)
    const lastResult = await client.query(
      'SELECT invoice_no FROM invoices ORDER BY created_at DESC LIMIT 1'
    );
    let nextNum = 1;
    if (lastResult.rows.length > 0) {
      const match = lastResult.rows[0].invoice_no.match(/(\d+)/);
      if (match) nextNum = parseInt(match[1], 10) + 1;
    }

    const today = new Date().toISOString().slice(0, 10);
    const created = [];

    // One separate invoice per out-of-stock product
    for (const item of itemsResult.rows) {
      const invoiceNo = `INV-${String(nextNum).padStart(4, '0')}`;
      nextNum += 1;
      const lineTotal = parseFloat(item.price) || 0;

      const invResult = await client.query(
        `INSERT INTO invoices (invoice_no, invoice_date, customer_name, customer_phone, customer_address, parcel_id, discount_type, discount_value, delivery_charge, total)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING *`,
        [invoiceNo, today, SAMPLE_CUSTOMER, '', '', '', 'none', 0, 0, lineTotal]
      );
      const invoice = invResult.rows[0];

      await client.query(
        `INSERT INTO invoice_items (invoice_id, item_id, description, quantity, unit_price, line_total)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [invoice.id, item.id, item.name, 1, item.price, lineTotal]
      );

      created.push({ invoice_no: invoiceNo, description: item.name, total: lineTotal });
    }

    await client.query('COMMIT');
    return NextResponse.json({
      count: created.length,
      first: created[0].invoice_no,
      last: created[created.length - 1].invoice_no,
      invoices: created,
    }, { status: 201 });
  } catch (error) {
    await client.query('ROLLBACK');
    return NextResponse.json({ error: 'Failed to create invoices' }, { status: 500 });
  } finally {
    client.release();
  }
}
