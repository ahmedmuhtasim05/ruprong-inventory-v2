import { NextResponse } from 'next/server';
import { verifySessionToken, SESSION_COOKIE_NAME } from './lib/sessions';
import { tabKeyForPath } from './lib/permissions';

export async function middleware(request) {
  const { pathname } = request.nextUrl;
  const isPublic =
    pathname === '/login' ||
    pathname.startsWith('/api/auth/login') ||
    pathname.startsWith('/_next') ||
    pathname.startsWith('/favicon');

  if (isPublic) return NextResponse.next();

  const token = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  const session = await verifySessionToken(token);

  if (!session) {
    if (pathname.startsWith('/api/')) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('next', pathname);
    return NextResponse.redirect(loginUrl);
  }

  // Role-based page access. Tokens issued before roles existed (no
  // permissions claim) keep full access until the user logs in again;
  // /api/auth/me still returns fresh DB-resolved permissions for the Nav.
  if (session.permissions) {
    const tabKey = tabKeyForPath(pathname);
    const allowed = session.is_super || (tabKey ? session.permissions.includes(tabKey) : true);
    if (!allowed) {
      if (pathname.startsWith('/api/')) {
        return NextResponse.json({ error: 'You do not have access to this section' }, { status: 403 });
      }
      const firstKey = session.permissions.length > 0 ? session.permissions[0] : null;
      return NextResponse.redirect(new URL(firstKey ? `/${firstKey}` : '/login', request.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
