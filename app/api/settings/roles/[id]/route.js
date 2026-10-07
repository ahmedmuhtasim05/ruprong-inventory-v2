import { NextResponse } from 'next/server';
import { getCurrentUserFromRequest, getRoleById, updateRole, deleteRole } from '../../../../../lib/auth';
import { TABS, parsePermissions } from '../../../../../lib/permissions';

async function requireSuper(request) {
  const me = await getCurrentUserFromRequest(request);
  if (!me) return { error: NextResponse.json({ error: 'Not authenticated' }, { status: 401 }) };
  if (!me.is_super) return { error: NextResponse.json({ error: 'Superadmin role required' }, { status: 403 }) };
  return { me };
}

export async function PUT(request, { params }) {
  const { error } = await requireSuper(request);
  if (error) return error;

  try {
    const { id } = params;
    const role = await getRoleById(parseInt(id));
    if (!role) return NextResponse.json({ error: 'Role not found' }, { status: 404 });
    if (role.is_super) {
      return NextResponse.json({ error: 'The Superadmin role cannot be edited' }, { status: 400 });
    }

    const { name, permissions } = await request.json();
    const validPerms = Array.isArray(permissions)
      ? permissions.filter((p) => TABS.some((t) => t.key === p))
      : role.permissions;
    const updated = await updateRole(parseInt(id), (name || '').trim() || role.name, validPerms);
    if (!updated) return NextResponse.json({ error: 'Failed to update role' }, { status: 500 });
    return NextResponse.json({ role: { ...updated, permissions: parsePermissions(updated.permissions) } });
  } catch (error) {
    if (error?.code === '23505') {
      return NextResponse.json({ error: 'Role name already exists' }, { status: 409 });
    }
    return NextResponse.json({ error: 'Failed to update role' }, { status: 500 });
  }
}

export async function DELETE(request, { params }) {
  const { error } = await requireSuper(request);
  if (error) return error;

  const { id } = params;
  const result = await deleteRole(parseInt(id));
  if (result.error) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }
  return NextResponse.json({ success: true });
}
