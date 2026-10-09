import { NextResponse } from 'next/server';
import { db } from '../../../../../lib/db';
import crypto from 'crypto';

// Product image delivery.
//   default        -> raw image bytes (image/*), cacheable, ETag-aware
//   ?format=data   -> JSON { image_url: dataURL }
// List endpoints intentionally exclude the heavy base64 column; clients load
// thumbnails directly from this route so listing pages stay fast even with
// hundreds of product photos. Thumbnails carry a ?v=updated_at cache-buster
// so a replaced photo is visible immediately.
export async function GET(request, { params }) {
  const { id } = params;
  const { searchParams } = new URL(request.url);

  const result = await db.query('SELECT image_url FROM items WHERE id = $1', [id]);
  if (result.rows.length === 0) {
    return NextResponse.json({ error: 'Item not found' }, { status: 404 });
  }
  const dataUrl = result.rows[0].image_url;
  if (!dataUrl) {
    return NextResponse.json({ error: 'Item has no image' }, { status: 404 });
  }

  if (searchParams.get('format') === 'data') {
    return NextResponse.json({ image_url: dataUrl });
  }

  const etag = '"' + crypto.createHash('sha1').update(dataUrl).digest('hex').slice(0, 16) + '"';
  const ifNoneMatch = request.headers.get('if-none-match');
  if (ifNoneMatch === etag) {
    return new NextResponse(null, {
      status: 304,
      headers: { 'Cache-Control': 'public, max-age=3600', ETag: etag },
    });
  }

  const comma = dataUrl.indexOf(',');
  const mime = dataUrl.slice(0, comma).match(/data:(.*?);/)?.[1] || 'image/webp';
  const buffer = Buffer.from(dataUrl.slice(comma + 1), 'base64');

  return new NextResponse(buffer, {
    headers: {
      'Content-Type': mime,
      'Cache-Control': 'public, max-age=3600',
      ETag: etag,
    },
  });
}
