import { NextResponse } from 'next/server';
import { getReportSummary } from '../../../../lib/reports';

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const start = searchParams.get('start');
  const end = searchParams.get('end');

  if (!start || !end) {
    return NextResponse.json({ error: 'Start and end dates required' }, { status: 400 });
  }

  const summary = await getReportSummary(start, end);
  return NextResponse.json({ summary });
}
