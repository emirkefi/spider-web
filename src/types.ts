export type TaskStatus = 'todo' | 'in_progress' | 'in_review' | 'done';

export type TaskPriority = 'low' | 'medium' | 'high' | 'urgent';

export interface Subtask {
  id: string;
  title: string;
  completed: boolean;
}

export interface Task {
  id: string;
  title: string;
  description: string;
  status: TaskStatus;
  priority: TaskPriority;
  projectId: string;
  dueDate: string; // ISO string
  createdAt: string;
  assignedToMe: boolean;
  assigneeId?: string;       // Assigned User ID
  assigneeGroupId?: string;  // Assigned Team/Group ID
  upNext: boolean;
  tags: string[];
  prUrl?: string;       // Specifically useful for "In Review (for code)"
  branchName?: string;  // Git branch reference
  estimateMinutes: number;
  subtasks: Subtask[];
}

export interface Project {
  id: string;
  name: string;
  color: string; // hex or tailwind accent
  icon: string;
  description: string;
  dueDate: string; // Project deadline ISO string
  workspaceId?: number; // Hyprland workspace binding hint (e.g., Workspace 1, 2, 3)
}

export type ActiveView = 'board' | 'up_next' | 'my_tasks' | 'analytics';

export type NotificationType = 'task_created' | 'task_moved' | 'task_completed' | 'due_soon' | 'overdue' | 'project_created';

export interface AppNotification {
  id: string;
  type: NotificationType;
  title: string;
  message: string;
  createdAt: string; // ISO string
  read: boolean;
  taskId?: string;
  projectId?: string;
}

export type PermissionCategory = 'tasks' | 'projects' | 'team' | 'system';

export interface Permission {
  id: string;
  name: string;
  description: string;
  category: PermissionCategory;
}

export interface Role {
  id: string;
  name: string;
  description: string;
  color: string;
  permissions: string[];
  isSystem?: boolean;
}

export interface Group {
  id: string;
  name: string;
  description: string;
  color: string;
  roleId?: string;
  memberIds: string[];
  createdAt: string;
}

export interface User {
  id: string;
  name: string;
  email: string;
  roleId: string;
  groupIds: string[];
  directPermissions?: string[];
  createdAt: string;
}
