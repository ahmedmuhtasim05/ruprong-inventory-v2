import { NextResponse } from 'next/server';
import { getCurrentUserFromRequest, getRoles, createRole } from '../../../../lib/auth';
import { TABS, parsePermissions } from '../../../../lib/permissions';

export async function GET(request) {
  const me = await getCurrentUserFromRequest(request);
  if (!me) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  const roles = await getRoles();
  return NextResponse.json({ roles });
}

export async function POST(request) {
  const me = await getCurrentUserFromRequest(request);
  if (!me) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  if (!me.is_super) return NextResponse.json({ error: 'Superadmin role required' }, { status: 403 });

  try {
    const { name, permissions } = await request.json();
    const trimmed = (name || '').trim();
    if (!trimmed) {
      return NextResponse.json({ error: 'Role name is required' }, { status: 400 });
    }
    const validPerms = Array.isArray(permissions)
      ? permissions.filter((p) => TABS.some((t) => t.key === p))
      : [];
    const role = await createRole(trimmed, validPerms);
    return NextResponse.json({ role: { ...role, permissions: parsePermissions(role.permissions) } }, { status: 201 });
  } catch (error) {
    if (error?.code === '23505') {
      return NextResponse.json({ error: 'Role name already exists' }, { status: 409 });
    }
    return NextResponse.json({ error: 'Failed to create role' }, { status: 500 });
  }
}
