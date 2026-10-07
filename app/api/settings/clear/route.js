import { NextResponse } from 'next/server';
import { db } from '../../../../lib/db';

export async function POST(request) {
  try {
    const { confirm } = await request.json();
    if (confirm !== 'DELETE') {
      return NextResponse.json({ error: 'Type DELETE to confirm' }, { status: 400 });
    }

    await db.query('DELETE FROM invoice_items');
    await db.query('DELETE FROM invoices');
    await db.query('DELETE FROM items');

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to clear data' }, { status: 500 });
  }
}
