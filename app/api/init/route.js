import { NextResponse } from 'next/server';
import { ensureInit } from '../../../lib/init';

export async function GET() {
  await ensureInit();
  return NextResponse.json({ success: true, message: 'Database initialized' });
}
