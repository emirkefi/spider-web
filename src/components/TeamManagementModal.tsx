import React, { useState } from 'react';
import {
  X,
  Plus,
  Users,
  User as UserIcon,
  Shield,
  Trash2,
  Check,
  CheckCheck,
  ChevronDown,
  Edit2,
  Lock,
  Sparkles,
  UserCheck,
  ShieldAlert,
} from 'lucide-react';
import { Group, Permission, Role, User } from '../types';
import { STANDARD_PERMISSIONS } from '../rbac/rbacData';
import { UserAvatar } from './UserAvatar';
import { getUserRole } from '../rbac/rbacUtils';

interface TeamManagementModalProps {
  isOpen: boolean;
  onClose: () => void;
  isDark: boolean;
  users: User[];
  groups: Group[];
  roles: Role[];
  currentUserId: string;
  onSelectCurrentUser: (userId: string) => void;
  onCreateUser: (user: Omit<User, 'id' | 'createdAt'>) => void;
  onUpdateUser: (user: User) => void;
  onDeleteUser: (userId: string) => void;
  onCreateGroup: (group: Omit<Group, 'id' | 'createdAt'>) => void;
  onUpdateGroup: (group: Group) => void;
  onDeleteGroup: (groupId: string) => void;
  onCreateRole: (role: Omit<Role, 'id'>) => void;
  onUpdateRole: (role: Role) => void;
  onDeleteRole: (roleId: string) => void;
}

type TabType = 'users' | 'groups' | 'roles';

export const TeamManagementModal: React.FC<TeamManagementModalProps> = ({
  isOpen,
  onClose,
  isDark,
  users,
  groups,
  roles,
  currentUserId,
  onSelectCurrentUser,
  onCreateUser,
  onUpdateUser,
  onDeleteUser,
  onCreateGroup,
  onUpdateGroup,
  onDeleteGroup,
  onCreateRole,
  onUpdateRole,
  onDeleteRole,
}) => {
  const [activeTab, setActiveTab] = useState<TabType>('users');

  // Form states for adding items
  const [isAddingUser, setIsAddingUser] = useState(false);
  const [newUserName, setNewUserName] = useState('');
  const [newUserEmail, setNewUserEmail] = useState('');
  const [newUserRoleId, setNewUserRoleId] = useState(roles[0]?.id || 'role-dev');
  const [newUserGroupIds, setNewUserGroupIds] = useState<string[]>([]);

  const [isAddingGroup, setIsAddingGroup] = useState(false);
  const [newGroupName, setNewGroupName] = useState('');
  const [newGroupDesc, setNewGroupDesc] = useState('');
  const [newGroupColor, setNewGroupColor] = useState('#0A84FF');
  const [newGroupRoleId, setNewGroupRoleId] = useState(roles[0]?.id || 'role-dev');

  const [isAddingRole, setIsAddingRole] = useState(false);
  const [newRoleName, setNewRoleName] = useState('');
  const [newRoleDesc, setNewRoleDesc] = useState('');
  const [newRoleColor, setNewRoleColor] = useState('#BF5AF2');
  const [newRolePerms, setNewRolePerms] = useState<string[]>([]);

  // Selected role for inspecting & editing permissions
  const [selectedRoleId, setSelectedRoleId] = useState<string>(roles[0]?.id || 'role-admin');

  if (!isOpen) return null;

  const selectedRole = roles.find((r) => r.id === selectedRoleId) || roles[0];

  const handleToggleRolePermission = (role: Role, permId: string) => {
    if (role.isSystem && role.id === 'role-admin') return; // Admin keeps all permissions
    const exists = role.permissions.includes(permId);
    const updatedPerms = exists
      ? role.permissions.filter((p) => p !== permId)
      : [...role.permissions, permId];
    onUpdateRole({
      ...role,
      permissions: updatedPerms,
    });
  };

  const handleCreateUserSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUserName.trim() || !newUserEmail.trim()) return;
    onCreateUser({
      name: newUserName.trim(),
      email: newUserEmail.trim(),
      roleId: newUserRoleId,
      groupIds: newUserGroupIds,
      directPermissions: [],
    });
    setNewUserName('');
    setNewUserEmail('');
    setNewUserGroupIds([]);
    setIsAddingUser(false);
  };

  const handleCreateGroupSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newGroupName.trim()) return;
    onCreateGroup({
      name: newGroupName.trim(),
      description: newGroupDesc.trim(),
      color: newGroupColor,
      roleId: newGroupRoleId,
      memberIds: [],
    });
    setNewGroupName('');
    setNewGroupDesc('');
    setIsAddingGroup(false);
  };

  const handleCreateRoleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newRoleName.trim()) return;
    onCreateRole({
      name: newRoleName.trim(),
      description: newRoleDesc.trim(),
      color: newRoleColor,
      permissions: newRolePerms,
    });
    setNewRoleName('');
    setNewRoleDesc('');
    setNewRolePerms([]);
    setIsAddingRole(false);
  };

  const categories: { key: Permission['category']; label: string }[] = [
    { key: 'tasks', label: 'Task Permissions' },
    { key: 'projects', label: 'Project Permissions' },
    { key: 'team', label: 'Team & User Permissions' },
    { key: 'system', label: 'System & RBAC Permissions' },
  ];

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className={`w-full max-w-3xl rounded-3xl border shadow-2xl overflow-hidden flex flex-col transition-all max-h-[88vh] ${
          isDark
            ? 'bg-zinc-900/95 border-white/15 text-zinc-100 shadow-black/70'
            : 'bg-white/95 border-black/10 text-zinc-900 shadow-black/20'
        } backdrop-blur-2xl`}
      >
        {/* Header */}
        <div
          className={`px-6 py-4 border-b flex items-center justify-between gap-3 shrink-0 ${
            isDark ? 'border-white/10 bg-white/[0.02]' : 'border-black/5 bg-zinc-50/70'
          }`}
        >
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-2xl bg-blue-500/15 text-blue-500">
              <Users size={20} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-semibold tracking-tight">Team, Roles &amp; Permissions</h3>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-blue-500/15 text-blue-500 font-bold">
                  RBAC
                </span>
              </div>
              <p className="text-xs opacity-55 mt-0.5">
                Manage workspace members, groups, and granular access rights
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-xl opacity-60 hover:opacity-100 transition cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        {/* Tab Switcher */}
        <div
          className={`px-6 pt-3 pb-2 border-b flex items-center gap-2 shrink-0 ${
            isDark ? 'border-white/10 bg-black/20' : 'border-black/[0.06] bg-zinc-100/60'
          }`}
        >
          <button
            onClick={() => setActiveTab('users')}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-semibold transition cursor-pointer ${
              activeTab === 'users'
                ? 'bg-blue-500 text-white shadow-xs'
                : isDark
                ? 'text-zinc-400 hover:text-white hover:bg-white/5'
                : 'text-zinc-600 hover:text-zinc-900 hover:bg-black/5'
            }`}
          >
            <UserIcon size={14} />
            <span>Users</span>
            <span className="text-[10px] font-mono opacity-80">({users.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('groups')}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-semibold transition cursor-pointer ${
              activeTab === 'groups'
                ? 'bg-blue-500 text-white shadow-xs'
                : isDark
                ? 'text-zinc-400 hover:text-white hover:bg-white/5'
                : 'text-zinc-600 hover:text-zinc-900 hover:bg-black/5'
            }`}
          >
            <Users size={14} />
            <span>Groups &amp; Teams</span>
            <span className="text-[10px] font-mono opacity-80">({groups.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('roles')}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-semibold transition cursor-pointer ${
              activeTab === 'roles'
                ? 'bg-blue-500 text-white shadow-xs'
                : isDark
                ? 'text-zinc-400 hover:text-white hover:bg-white/5'
                : 'text-zinc-600 hover:text-zinc-900 hover:bg-black/5'
            }`}
          >
            <Shield size={14} />
            <span>Roles &amp; Permissions</span>
            <span className="text-[10px] font-mono opacity-80">({roles.length})</span>
          </button>
        </div>

        {/* Tab Content Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {/* =========================================================================
              TAB: USERS
             ========================================================================= */}
          {activeTab === 'users' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-sm font-semibold">Workspace Users</h4>
                  <p className="text-xs opacity-50">Assign roles and switch active user context</p>
                </div>
                <button
                  onClick={() => setIsAddingUser(!isAddingUser)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-blue-500 hover:bg-blue-600 text-white transition cursor-pointer"
                >
                  <Plus size={14} />
                  <span>Add User</span>
                </button>
              </div>

              {/* Add User Form */}
              {isAddingUser && (
                <form
                  onSubmit={handleCreateUserSubmit}
                  className={`p-4 rounded-2xl border space-y-3 ${
                    isDark ? 'bg-white/[0.04] border-white/10' : 'bg-zinc-50 border-black/10'
                  }`}
                >
                  <h5 className="text-xs font-semibold">Create New User</h5>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="text-[11px] opacity-70 block mb-1">Full Name</label>
                      <input
                        type="text"
                        required
                        value={newUserName}
                        onChange={(e) => setNewUserName(e.target.value)}
                        placeholder="e.g. Alex Mercer"
                        className={`w-full px-3 py-1.5 rounded-xl text-xs border outline-none ${
                          isDark
                            ? 'bg-zinc-800 border-white/10 text-white focus:border-blue-500'
                            : 'bg-white border-black/10 text-zinc-900 focus:border-blue-500'
                        }`}
                      />
                    </div>
                    <div>
                      <label className="text-[11px] opacity-70 block mb-1">Email Address</label>
                      <input
                        type="email"
                        required
                        value={newUserEmail}
                        onChange={(e) => setNewUserEmail(e.target.value)}
                        placeholder="e.g. alex@spiderweb.local"
                        className={`w-full px-3 py-1.5 rounded-xl text-xs border outline-none ${
                          isDark
                            ? 'bg-zinc-800 border-white/10 text-white focus:border-blue-500'
                            : 'bg-white border-black/10 text-zinc-900 focus:border-blue-500'
                        }`}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="text-[11px] opacity-70 block mb-1">Assigned Role</label>
                      <select
                        value={newUserRoleId}
                        onChange={(e) => setNewUserRoleId(e.target.value)}
                        className={`w-full px-3 py-1.5 rounded-xl text-xs border outline-none ${
                          isDark
                            ? 'bg-zinc-800 border-white/10 text-white'
                            : 'bg-white border-black/10 text-zinc-900'
                        }`}
                      >
                        {roles.map((r) => (
                          <option key={r.id} value={r.id}>
                            {r.name}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="text-[11px] opacity-70 block mb-1">Teams / Groups</label>
                      <div className="flex flex-wrap gap-1.5 pt-0.5">
                        {groups.map((g) => {
                          const isSelected = newUserGroupIds.includes(g.id);
                          return (
                            <button
                              key={g.id}
                              type="button"
                              onClick={() => {
                                setNewUserGroupIds((prev) =>
                                  isSelected ? prev.filter((id) => id !== g.id) : [...prev, g.id]
                                );
                              }}
                              className={`text-[10px] font-medium px-2 py-0.5 rounded-lg border transition cursor-pointer ${
                                isSelected
                                  ? 'bg-blue-500 text-white border-blue-600'
                                  : isDark
                                  ? 'border-white/10 text-zinc-400 hover:text-white'
                                  : 'border-black/10 text-zinc-600 hover:text-zinc-900'
                              }`}
                            >
                              {g.name}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </div>

                  <div className="flex justify-end gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => setIsAddingUser(false)}
                      className="px-3 py-1 rounded-xl text-xs border opacity-70 hover:opacity-100 cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="px-3.5 py-1 rounded-xl text-xs font-semibold bg-blue-500 text-white hover:bg-blue-600 cursor-pointer"
                    >
                      Save User
                    </button>
                  </div>
                </form>
              )}

              {/* Users List */}
              <div className="space-y-2">
                {users.map((user) => {
                  const role = getUserRole(user, roles);
                  const isCurrent = user.id === currentUserId;
                  const userGroups = groups.filter((g) => user.groupIds?.includes(g.id));

                  return (
                    <div
                      key={user.id}
                      className={`p-3.5 rounded-2xl border flex items-center justify-between gap-3 transition ${
                        isCurrent
                          ? isDark
                            ? 'bg-blue-500/10 border-blue-500/40 shadow-xs'
                            : 'bg-blue-50 border-blue-200 shadow-xs'
                          : isDark
                          ? 'bg-white/[0.02] border-white/10 hover:bg-white/[0.05]'
                          : 'bg-white border-black/10 hover:bg-zinc-50'
                      }`}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <UserAvatar user={user} roles={roles} size={36} showBadge={true} />
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-semibold truncate">{user.name}</span>
                            {isCurrent && (
                              <span className="text-[10px] font-bold px-1.5 py-0.2 rounded-full bg-blue-500 text-white">
                                Active You
                              </span>
                            )}
                            {role && (
                              <span
                                className="text-[10px] font-medium px-2 py-0.2 rounded-full border truncate"
                                style={{
                                  backgroundColor: `${role.color}15`,
                                  borderColor: `${role.color}35`,
                                  color: role.color,
                                }}
                              >
                                {role.name}
                              </span>
                            )}
                          </div>
                          <p className="text-[11px] opacity-50 truncate">{user.email}</p>
                          {userGroups.length > 0 && (
                            <div className="flex items-center gap-1 mt-1">
                              {userGroups.map((g) => (
                                <span
                                  key={g.id}
                                  className="text-[9px] font-mono px-1.5 py-0.2 rounded bg-black/10 dark:bg-white/10 opacity-70"
                                >
                                  {g.name}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        {/* Switch Active User */}
                        {!isCurrent && (
                          <button
                            onClick={() => onSelectCurrentUser(user.id)}
                            title="Switch to this user profile"
                            className="px-2.5 py-1 rounded-xl text-xs font-medium border border-blue-500/30 text-blue-500 hover:bg-blue-500 hover:text-white transition cursor-pointer"
                          >
                            Switch
                          </button>
                        )}

                        {/* Role Selector inline */}
                        <select
                          value={user.roleId}
                          onChange={(e) => onUpdateUser({ ...user, roleId: e.target.value })}
                          className={`text-xs px-2 py-1 rounded-xl border outline-none cursor-pointer ${
                            isDark
                              ? 'bg-zinc-800 border-white/10 text-white'
                              : 'bg-white border-black/10 text-zinc-900'
                          }`}
                        >
                          {roles.map((r) => (
                            <option key={r.id} value={r.id}>
                              {r.name}
                            </option>
                          ))}
                        </select>

                        {/* Delete user button (except admin) */}
                        {user.id !== 'user-admin' && (
                          <button
                            onClick={() => onDeleteUser(user.id)}
                            title="Delete User"
                            className="p-1.5 rounded-lg opacity-50 hover:opacity-100 hover:text-rose-500 transition cursor-pointer"
                          >
                            <Trash2 size={13} />
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* =========================================================================
              TAB: GROUPS & TEAMS
             ========================================================================= */}
          {activeTab === 'groups' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-sm font-semibold">Teams &amp; Groups</h4>
                  <p className="text-xs opacity-50">
                    Group users to assign entire teams to tasks and apply role policies
                  </p>
                </div>
                <button
                  onClick={() => setIsAddingGroup(!isAddingGroup)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-blue-500 hover:bg-blue-600 text-white transition cursor-pointer"
                >
                  <Plus size={14} />
                  <span>New Group</span>
                </button>
              </div>

              {/* Add Group Form */}
              {isAddingGroup && (
                <form
                  onSubmit={handleCreateGroupSubmit}
                  className={`p-4 rounded-2xl border space-y-3 ${
                    isDark ? 'bg-white/[0.04] border-white/10' : 'bg-zinc-50 border-black/10'
                  }`}
                >
                  <h5 className="text-xs font-semibold">Create New Team / Group</h5>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="text-[11px] opacity-70 block mb-1">Group Name</label>
                      <input
                        type="text"
                        required
                        value={newGroupName}
                        onChange={(e) => setNewGroupName(e.target.value)}
                        placeholder="e.g. Frontend Team"
                        className={`w-full px-3 py-1.5 rounded-xl text-xs border outline-none ${
                          isDark
                            ? 'bg-zinc-800 border-white/10 text-white focus:border-blue-500'
                            : 'bg-white border-black/10 text-zinc-900 focus:border-blue-500'
                        }`}
                      />
                    </div>
                    <div>
                      <label className="text-[11px] opacity-70 block mb-1">Badge Color</label>
                      <div className="flex items-center gap-2">
                        {['#0A84FF', '#30D158', '#BF5AF2', '#FF9F0A', '#FF453A', '#64D2FF'].map(
                          (c) => (
                            <button
                              key={c}
                              type="button"
                              onClick={() => setNewGroupColor(c)}
                              className={`w-6 h-6 rounded-full transition-transform cursor-pointer ${
                                newGroupColor === c ? 'scale-125 ring-2 ring-white' : 'opacity-70'
                              }`}
                              style={{ backgroundColor: c }}
                            />
                          )
                        )}
                      </div>
                    </div>
                  </div>

                  <div>
                    <label className="text-[11px] opacity-70 block mb-1">Description</label>
                    <input
                      type="text"
                      value={newGroupDesc}
                      onChange={(e) => setNewGroupDesc(e.target.value)}
                      placeholder="e.g. Responsible for React, UI components and client logic"
                      className={`w-full px-3 py-1.5 rounded-xl text-xs border outline-none ${
                        isDark
                          ? 'bg-zinc-800 border-white/10 text-white focus:border-blue-500'
                          : 'bg-white border-black/10 text-zinc-900 focus:border-blue-500'
                      }`}
                    />
                  </div>

                  <div className="flex justify-end gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => setIsAddingGroup(false)}
                      className="px-3 py-1 rounded-xl text-xs border opacity-70 hover:opacity-100 cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="px-3.5 py-1 rounded-xl text-xs font-semibold bg-blue-500 text-white hover:bg-blue-600 cursor-pointer"
                    >
                      Create Group
                    </button>
                  </div>
                </form>
              )}

              {/* Groups List */}
              <div className="space-y-2">
                {groups.map((group) => {
                  const members = users.filter((u) => u.groupIds?.includes(group.id));

                  return (
                    <div
                      key={group.id}
                      className={`p-3.5 rounded-2xl border transition ${
                        isDark
                          ? 'bg-white/[0.02] border-white/10 hover:bg-white/[0.05]'
                          : 'bg-white border-black/10 hover:bg-zinc-50'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-3 min-w-0">
                          <span
                            className="w-8 h-8 rounded-xl flex items-center justify-center font-bold text-white shrink-0 shadow-xs"
                            style={{ backgroundColor: group.color }}
                          >
                            <Users size={16} />
                          </span>
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <h5 className="text-xs font-semibold truncate">{group.name}</h5>
                              <span className="text-[10px] font-mono px-2 py-0.2 rounded-full bg-black/10 dark:bg-white/10">
                                {members.length} members
                              </span>
                            </div>
                            <p className="text-[11px] opacity-60 truncate mt-0.5">
                              {group.description || 'No description provided.'}
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          {/* Member avatars */}
                          <div className="flex items-center -space-x-1.5">
                            {members.slice(0, 4).map((m) => (
                              <UserAvatar key={m.id} user={m} roles={roles} size={22} />
                            ))}
                          </div>

                          <button
                            onClick={() => onDeleteGroup(group.id)}
                            title="Delete Group"
                            className="p-1.5 rounded-lg opacity-50 hover:opacity-100 hover:text-rose-500 transition cursor-pointer"
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* =========================================================================
              TAB: ROLES & PERMISSIONS (Laratrust Matrix)
             ========================================================================= */}
          {activeTab === 'roles' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-sm font-semibold">Roles &amp; Access Control Matrix</h4>
                  <p className="text-xs opacity-50">
                    Laratrust-style granular permissions assigned per role
                  </p>
                </div>
                <button
                  onClick={() => setIsAddingRole(!isAddingRole)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-blue-500 hover:bg-blue-600 text-white transition cursor-pointer"
                >
                  <Plus size={14} />
                  <span>New Role</span>
                </button>
              </div>

              {/* Add Role Form */}
              {isAddingRole && (
                <form
                  onSubmit={handleCreateRoleSubmit}
                  className={`p-4 rounded-2xl border space-y-3 ${
                    isDark ? 'bg-white/[0.04] border-white/10' : 'bg-zinc-50 border-black/10'
                  }`}
                >
                  <h5 className="text-xs font-semibold">Create Custom Role</h5>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="text-[11px] opacity-70 block mb-1">Role Name</label>
                      <input
                        type="text"
                        required
                        value={newRoleName}
                        onChange={(e) => setNewRoleName(e.target.value)}
                        placeholder="e.g. Release Manager"
                        className={`w-full px-3 py-1.5 rounded-xl text-xs border outline-none ${
                          isDark
                            ? 'bg-zinc-800 border-white/10 text-white focus:border-blue-500'
                            : 'bg-white border-black/10 text-zinc-900 focus:border-blue-500'
                        }`}
                      />
                    </div>
                    <div>
                      <label className="text-[11px] opacity-70 block mb-1">Color</label>
                      <div className="flex items-center gap-2">
                        {['#BF5AF2', '#0A84FF', '#30D158', '#FF9F0A', '#FF453A', '#64D2FF'].map(
                          (c) => (
                            <button
                              key={c}
                              type="button"
                              onClick={() => setNewRoleColor(c)}
                              className={`w-6 h-6 rounded-full transition-transform cursor-pointer ${
                                newRoleColor === c ? 'scale-125 ring-2 ring-white' : 'opacity-70'
                              }`}
                              style={{ backgroundColor: c }}
                            />
                          )
                        )}
                      </div>
                    </div>
                  </div>

                  <div>
                    <label className="text-[11px] opacity-70 block mb-1">Description</label>
                    <input
                      type="text"
                      value={newRoleDesc}
                      onChange={(e) => setNewRoleDesc(e.target.value)}
                      placeholder="e.g. Manages release branches and code reviews"
                      className={`w-full px-3 py-1.5 rounded-xl text-xs border outline-none ${
                        isDark
                          ? 'bg-zinc-800 border-white/10 text-white focus:border-blue-500'
                          : 'bg-white border-black/10 text-zinc-900 focus:border-blue-500'
                      }`}
                    />
                  </div>

                  <div className="flex justify-end gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => setIsAddingRole(false)}
                      className="px-3 py-1 rounded-xl text-xs border opacity-70 hover:opacity-100 cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="px-3.5 py-1 rounded-xl text-xs font-semibold bg-blue-500 text-white hover:bg-blue-600 cursor-pointer"
                    >
                      Save Role
                    </button>
                  </div>
                </form>
              )}

              {/* Role Select Pills */}
              <div className="flex items-center gap-2 overflow-x-auto pb-1">
                {roles.map((r) => {
                  const isSelected = r.id === selectedRoleId;
                  return (
                    <button
                      key={r.id}
                      onClick={() => setSelectedRoleId(r.id)}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border transition cursor-pointer ${
                        isSelected
                          ? 'bg-blue-500 text-white border-blue-600 shadow-xs'
                          : isDark
                          ? 'bg-white/5 border-white/10 text-zinc-300 hover:bg-white/10'
                          : 'bg-white border-black/10 text-zinc-700 hover:bg-zinc-100'
                      }`}
                    >
                      <span
                        className="w-2 h-2 rounded-full"
                        style={{ backgroundColor: r.color }}
                      />
                      <span>{r.name}</span>
                      {r.isSystem && <Lock size={10} className="opacity-60" />}
                    </button>
                  );
                })}
              </div>

              {/* Inspected Role Details & Permissions Toggle */}
              {selectedRole && (
                <div
                  className={`p-4 rounded-2xl border space-y-4 ${
                    isDark ? 'bg-white/[0.03] border-white/10' : 'bg-white border-black/10'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <h5 className="text-sm font-semibold">{selectedRole.name} Role</h5>
                        {selectedRole.isSystem && (
                          <span className="text-[10px] font-mono px-2 py-0.2 rounded-full bg-blue-500/15 text-blue-500 font-bold">
                            System Default
                          </span>
                        )}
                      </div>
                      <p className="text-xs opacity-60 mt-0.5">{selectedRole.description}</p>
                    </div>

                    {!selectedRole.isSystem && (
                      <button
                        onClick={() => onDeleteRole(selectedRole.id)}
                        title="Delete Role"
                        className="p-1.5 rounded-lg opacity-60 hover:opacity-100 hover:text-rose-500 transition cursor-pointer"
                      >
                        <Trash2 size={14} />
                      </button>
                    )}
                  </div>

                  {/* Permissions by Category */}
                  <div className="space-y-4 pt-2">
                    {categories.map((cat) => {
                      const catPerms = STANDARD_PERMISSIONS.filter((p) => p.category === cat.key);

                      return (
                        <div key={cat.key} className="space-y-2">
                          <h6 className="text-[11px] font-semibold uppercase tracking-wider opacity-50">
                            {cat.label}
                          </h6>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            {catPerms.map((perm) => {
                              const hasPerm =
                                selectedRole.permissions.includes(perm.id) ||
                                (selectedRole.isSystem && selectedRole.id === 'role-admin');
                              const isLocked = selectedRole.isSystem && selectedRole.id === 'role-admin';

                              return (
                                <div
                                  key={perm.id}
                                  onClick={() => {
                                    if (!isLocked) {
                                      handleToggleRolePermission(selectedRole, perm.id);
                                    }
                                  }}
                                  className={`p-2.5 rounded-xl border flex items-center justify-between gap-2 transition select-none ${
                                    isLocked
                                      ? 'opacity-80 cursor-default'
                                      : 'cursor-pointer hover:border-blue-500/50'
                                  } ${
                                    hasPerm
                                      ? isDark
                                        ? 'bg-blue-500/10 border-blue-500/30 text-white'
                                        : 'bg-blue-50 border-blue-200 text-zinc-900'
                                      : isDark
                                      ? 'bg-white/[0.01] border-white/5 opacity-40'
                                      : 'bg-zinc-50 border-black/5 opacity-40'
                                  }`}
                                >
                                  <div>
                                    <div className="flex items-center gap-1.5">
                                      <span className="text-xs font-medium">{perm.name}</span>
                                    </div>
                                    <p className="text-[10px] opacity-60 mt-0.5 font-mono">
                                      {perm.id}
                                    </p>
                                  </div>

                                  <div
                                    className={`w-5 h-5 rounded-lg border flex items-center justify-center transition ${
                                      hasPerm
                                        ? 'bg-blue-500 border-blue-600 text-white'
                                        : 'border-zinc-400 dark:border-zinc-600'
                                    }`}
                                  >
                                    {hasPerm && <Check size={12} strokeWidth={3} />}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
