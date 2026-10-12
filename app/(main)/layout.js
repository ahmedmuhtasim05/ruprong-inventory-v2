import { cookies } from 'next/headers';
import Nav from './Nav';
import { verifySessionToken, SESSION_COOKIE_NAME } from '../../lib/sessions';

// The layout verifies the session cookie on the server so the Nav can
// render correctly on the very first paint — anonymous visitors see
// only the public Home tab (no flash of hidden tabs), while signed-in
// users immediately see their role's tabs.
export default async function MainLayout({ children }) {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  const session = token ? await verifySessionToken(token) : null;

  return (
    <div>
      <Nav
        initialAuthed={!!session}
        initialPermissions={session && session.permissions ? session.permissions : []}
        initialIsSuper={session ? session.is_super === true : false}
      />
      <div className="page">{children}</div>
    </div>
  );
}
