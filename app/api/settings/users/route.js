import { NextResponse } from 'next/server';
import { getUsers, createUser } from '../../../../lib/auth';

export async function GET() {
  const users = await getUsers();
  return NextResponse.json({ users });
}

export async function POST(request) {
  try {
    const { username, password } = await request.json();
    if (!username || !password) {
      return NextResponse.json({ error: 'Username and password required' }, { status: 400 });
    }
    const user = await createUser(username, password);
    return NextResponse.json({ user }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to create user' }, { status: 500 });
  }
}
