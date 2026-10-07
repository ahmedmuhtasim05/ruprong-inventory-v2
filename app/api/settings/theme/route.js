import { NextResponse } from 'next/server';
import { getThemeColor, setThemeColor } from '../../../../lib/theme';

export async function GET() {
  const color = await getThemeColor();
  return NextResponse.json({ color });
}

export async function PUT(request) {
  try {
    const { color } = await request.json();
    if (!color) {
      return NextResponse.json({ error: 'Color is required' }, { status: 400 });
    }
    await setThemeColor(color);
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to update theme' }, { status: 500 });
  }
}
