import { Group, Permission, Role, User } from '../types';

export const STANDARD_PERMISSIONS: Permission[] = [
  {
    id: 'tasks:create',
    name: 'Create Tasks',
    description: 'Create new tasks in any project',
    category: 'tasks',
  },
  {
    id: 'tasks:edit',
    name: 'Edit Tasks',
    description: 'Update titles, descriptions, due dates, and tags',
    category: 'tasks',
  },
  {
    id: 'tasks:move',
    name: 'Move Tasks',
    description: 'Transition tasks across To Do, In Progress, In Review, and Done',
    category: 'tasks',
  },
  {
    id: 'tasks:assign',
    name: 'Assign Tasks',
    description: 'Assign tasks to users or groups',
    category: 'tasks',
  },
  {
    id: 'tasks:delete',
    name: 'Delete Tasks',
    description: 'Permanently remove tasks from the board',
    category: 'tasks',
  },
  {
    id: 'projects:create',
    name: 'Create Projects',
    description: 'Create new projects and configure workspaces',
    category: 'projects',
  },
  {
    id: 'projects:edit',
    name: 'Edit Projects',
    description: 'Update project settings, deadline dates, and details',
    category: 'projects',
  },
  {
    id: 'projects:delete',
    name: 'Delete Projects',
    description: 'Remove projects and associated tasks',
    category: 'projects',
  },
  {
    id: 'team:manage',
    name: 'Manage Users & Groups',
    description: 'Create, modify, and manage team members and groups',
    category: 'team',
  },
  {
    id: 'roles:manage',
    name: 'Manage Roles & RBAC',
    description: 'Configure custom roles and assign granular permissions',
    category: 'system',
  },
];

export const INITIAL_ROLES: Role[] = [
  {
    id: 'role-admin',
    name: 'Admin',
    description: 'Full administrative control over all workspace features, users, and roles.',
    color: '#0A84FF',
    permissions: STANDARD_PERMISSIONS.map((p) => p.id),
    isSystem: true,
  },
  {
    id: 'role-lead',
    name: 'Team Lead',
    description: 'Can manage tasks, projects, assignments, and group memberships.',
    color: '#BF5AF2',
    permissions: [
      'tasks:create',
      'tasks:edit',
      'tasks:move',
      'tasks:assign',
      'tasks:delete',
      'projects:create',
      'projects:edit',
      'team:manage',
    ],
  },
  {
    id: 'role-dev',
    name: 'Developer',
    description: 'Can create, edit, move, and assign tasks across workflow columns.',
    color: '#30D158',
    permissions: ['tasks:create', 'tasks:edit', 'tasks:move', 'tasks:assign'],
  },
  {
    id: 'role-viewer',
    name: 'Viewer',
    description: 'Read-only access to view boards, velocity analytics, and tasks.',
    color: '#8E8E93',
    permissions: [],
  },
];

export const INITIAL_GROUPS: Group[] = [
  {
    id: 'group-core',
    name: 'Core Engineering',
    description: 'Primary product development and architecture team',
    color: '#0A84FF',
    roleId: 'role-dev',
    memberIds: ['user-admin'],
    createdAt: '2026-10-20T00:00:00.000Z',
  },
  {
    id: 'group-qa',
    name: 'QA & Reviewers',
    description: 'Quality assurance and code review validation team',
    color: '#BF5AF2',
    roleId: 'role-dev',
    memberIds: [],
    createdAt: '2026-10-20T00:00:00.000Z',
  },
];

export const INITIAL_USERS: User[] = [
  {
    id: 'user-admin',
    name: 'Admin User',
    email: 'admin@spiderweb.local',
    roleId: 'role-admin',
    groupIds: ['group-core'],
    directPermissions: [],
    createdAt: '2026-10-20T00:00:00.000Z',
  },
];
