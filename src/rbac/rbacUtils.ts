import { Role, User } from '../types';

export function getUserRole(user: User | undefined, roles: Role[]): Role | undefined {
  if (!user) return undefined;
  return roles.find((r) => r.id === user.roleId) || roles[0];
}

export function getUserPermissions(user: User | undefined, roles: Role[]): Set<string> {
  if (!user) return new Set();
  const perms = new Set<string>();

  const role = getUserRole(user, roles);
  if (role) {
    role.permissions.forEach((p) => perms.add(p));
  }

  if (user.directPermissions) {
    user.directPermissions.forEach((p) => perms.add(p));
  }

  return perms;
}

export function hasPermission(
  user: User | undefined,
  permissionId: string,
  roles: Role[]
): boolean {
  if (!user) return true; // Default fallback if no user system active
  const role = getUserRole(user, roles);
  // Admin role has blanket access
  if (role && role.id === 'role-admin') {
    return true;
  }

  const perms = getUserPermissions(user, roles);
  return perms.has(permissionId);
}

export function getUserInitials(name: string): string {
  if (!name) return 'U';
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}
