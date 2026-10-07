import { NextResponse } from 'next/server';
import { updateUser, deleteUser } from '../../../../../lib/auth';

export async function PUT(request, { params }) {
  try {
    const { id } = params;
    const { username, password } = await request.json();
    const user = await updateUser(parseInt(id), username, password);
    return NextResponse.json({ user });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to update user' }, { status: 500 });
  }
}

export async function DELETE(request, { params }) {
  try {
    const { id } = params;
    await deleteUser(parseInt(id));
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to delete user' }, { status: 500 });
  }
}
