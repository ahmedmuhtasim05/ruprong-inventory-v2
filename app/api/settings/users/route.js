import { NextResponse } from 'next/server';
import { getUsers, createUser, getCurrentUserFromRequest } from '../../../../lib/auth';

export async function GET() {
  const users = await getUsers();
  return NextResponse.json({ users });
}

export async function POST(request) {
  try {
    const { username, password, role_id } = await request.json();
    if (!username || !password) {
      return NextResponse.json({ error: 'Username and password required' }, { status: 400 });
    }
    // Only superadmins may assign roles
    if (role_id != null) {
      const me = await getCurrentUserFromRequest(request);
      if (!me?.is_super) {
        return NextResponse.json({ error: 'Superadmin role required to assign roles' }, { status: 403 });
      }
    }
    const user = await createUser(username, password, role_id ?? null);
    return NextResponse.json({ user }, { status: 201 });
  } catch (error) {
    if (error?.code === '23505') {
      return NextResponse.json({ error: 'Username already exists' }, { status: 409 });
    }
    return NextResponse.json({ error: 'Failed to create user' }, { status: 500 });
  }
}
