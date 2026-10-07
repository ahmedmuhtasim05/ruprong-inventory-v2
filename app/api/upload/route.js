import { NextResponse } from 'next/server';
import { optimizeImage } from '../../../lib/image-optimizer';
import { db } from '../../../lib/db';

export async function POST(request) {
  try {
    const formData = await request.formData();
    const file = formData.get('file');

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const optimized = await optimizeImage(buffer);

    // Store as base64 data URL
    const base64 = optimized.buffer.toString('base64');
    const dataUrl = `data:image/webp;base64,${base64}`;

    return NextResponse.json({
      url: dataUrl,
      sizeKB: optimized.sizeKB,
      quality: optimized.quality,
    });
  } catch (error) {
    return NextResponse.json({ error: 'Upload failed' }, { status: 500 });
  }
}
