import { NextResponse } from 'next/server';
import { destroySession, SESSION_COOKIE_NAME } from '../../../../lib/auth';

export async function POST(request) {
  const token = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  if (token) await destroySession(token);

  const response = NextResponse.json({ success: true });
  response.cookies.set(SESSION_COOKIE_NAME, '', { maxAge: 0, path: '/' });
  return response;
}
