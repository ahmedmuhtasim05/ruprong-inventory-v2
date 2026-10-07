import { NextResponse } from 'next/server';
import { getCurrentUserFromRequest } from '../../../../lib/auth';

// Returns the caller's resolved role/permissions (always fresh from the DB).
export async function GET(request) {
  const user = await getCurrentUserFromRequest(request);
  if (!user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }
  return NextResponse.json({
    username: user.username,
    role_id: user.role_id,
    role_name: user.role_name,
    permissions: user.permissions,
    is_super: user.is_super,
  });
}
