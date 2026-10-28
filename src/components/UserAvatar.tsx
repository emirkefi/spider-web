import React from 'react';
import { Users as GroupIcon, ShieldCheck } from 'lucide-react';
import { Group, Role, User } from '../types';
import { getUserInitials, getUserRole } from '../rbac/rbacUtils';

interface UserAvatarProps {
  user?: User;
  group?: Group;
  roles?: Role[];
  size?: number; // size in px, default 26
  showBadge?: boolean;
  className?: string;
}

export const UserAvatar: React.FC<UserAvatarProps> = ({
  user,
  group,
  roles = [],
  size = 26,
  showBadge = false,
  className = '',
}) => {
  // If representing a Group / Team
  if (group) {
    return (
      <div
        title={`Team: ${group.name}`}
        className={`relative inline-flex items-center justify-center rounded-full font-bold select-none text-white shadow-xs shrink-0 ${className}`}
        style={{
          width: size,
          height: size,
          backgroundColor: group.color || '#0A84FF',
          fontSize: Math.max(10, Math.floor(size * 0.42)),
        }}
      >
        <GroupIcon size={Math.floor(size * 0.55)} />
      </div>
    );
  }

  // If representing an Individual User
  if (!user) {
    return (
      <div
        title="Unassigned"
        className={`inline-flex items-center justify-center rounded-full bg-zinc-200 dark:bg-zinc-800 text-zinc-500 font-medium select-none shrink-0 ${className}`}
        style={{
          width: size,
          height: size,
          fontSize: Math.max(10, Math.floor(size * 0.4)),
        }}
      >
        ?
      </div>
    );
  }

  const role = getUserRole(user, roles);
  const initials = getUserInitials(user.name);
  const roleColor = role?.color || '#0A84FF';

  return (
    <div
      title={`${user.name} (${role?.name || 'Member'}) — ${user.email}`}
      className={`relative inline-flex items-center justify-center rounded-full font-semibold select-none text-white shadow-xs shrink-0 ${className}`}
      style={{
        width: size,
        height: size,
        backgroundColor: roleColor,
        fontSize: Math.max(10, Math.floor(size * 0.42)),
      }}
    >
      <span>{initials}</span>

      {showBadge && role?.id === 'role-admin' && (
        <span
          title="Admin"
          className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full bg-blue-600 text-white flex items-center justify-center ring-1 ring-white dark:ring-zinc-900"
        >
          <ShieldCheck size={9} />
        </span>
      )}
    </div>
  );
};
