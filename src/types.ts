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
