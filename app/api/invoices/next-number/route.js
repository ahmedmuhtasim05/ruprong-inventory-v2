import { NextResponse } from 'next/server';
import { db } from '../../../../lib/db';

export async function GET() {
  const result = await db.query(
    "SELECT invoice_no FROM invoices ORDER BY created_at DESC LIMIT 1"
  );

  let nextNum = 1;
  if (result.rows.length > 0) {
    const match = result.rows[0].invoice_no.match(/(\d+)/);
    if (match) nextNum = parseInt(match[1]) + 1;
  }

  return NextResponse.json({ invoice_no: `INV-${String(nextNum).padStart(4, '0')}` });
}
