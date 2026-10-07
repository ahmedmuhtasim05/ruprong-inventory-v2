import { NextResponse } from 'next/server';
import { updateUser, deleteUser, getCurrentUserFromRequest } from '../../../../../lib/auth';

export async function PUT(request, { params }) {
  try {
    const { id } = params;
    const { username, password, role_id } = await request.json();
    // Only superadmins may change a user's role
    if (role_id !== undefined && role_id !== null) {
      const me = await getCurrentUserFromRequest(request);
      if (!me?.is_super) {
        return NextResponse.json({ error: 'Superadmin role required to assign roles' }, { status: 403 });
      }
    }
    const user = await updateUser(parseInt(id), username, password, role_id);
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
