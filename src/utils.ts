import { TaskPriority, TaskStatus } from './types';

export interface DueTimeMeta {
  label: string;
  shortLabel: string;
  isOverdue: boolean;
  isDueSoon: boolean; // < 12 hours
  urgencyLevel: 'overdue' | 'critical' | 'soon' | 'normal' | 'completed';
}

export function getDueTimeMeta(dueDateIso: string, status?: TaskStatus): DueTimeMeta {
  if (status === 'done') {
    return {
      label: 'Completed',
      shortLabel: 'Done',
      isOverdue: false,
      isDueSoon: false,
      urgencyLevel: 'completed',
    };
  }

  const now = Date.now();
  const due = new Date(dueDateIso).getTime();
  const diffMs = due - now;
  const absMs = Math.abs(diffMs);

  const minutes = Math.floor(absMs / (1000 * 60));
  const hours = Math.floor(absMs / (1000 * 60 * 60));
  const days = Math.floor(hours / 24);
  const remHours = hours % 24;

  if (diffMs < 0) {
    const timeStr = days > 0 ? `${days}d ${remHours}h` : hours > 0 ? `${hours}h` : `${minutes}m`;
    return {
      label: `Overdue by ${timeStr}`,
      shortLabel: `-${timeStr}`,
      isOverdue: true,
      isDueSoon: false,
      urgencyLevel: 'overdue',
    };
  }

  if (hours < 6) {
    const timeStr = hours > 0 ? `${hours}h ${minutes % 60}m` : `${minutes}m`;
    return {
      label: `Due in ${timeStr}`,
      shortLabel: timeStr,
      isOverdue: false,
      isDueSoon: true,
      urgencyLevel: 'critical',
    };
  }

  if (hours < 24) {
    return {
      label: `Due in ${hours}h`,
      shortLabel: `${hours}h left`,
      isOverdue: false,
      isDueSoon: true,
      urgencyLevel: 'soon',
    };
  }

  return {
    label: `Due in ${days}d ${remHours}h`,
    shortLabel: `${days}d ${remHours}h`,
    isOverdue: false,
    isDueSoon: false,
    urgencyLevel: 'normal',
  };
}

export const STATUS_CONFIG: Record<
  TaskStatus,
  {
    label: string;
    subtitle: string;
    color: string;
    dotClass: string;
    badgeBgLight: string;
    badgeBgDark: string;
    shortcut: string;
  }
> = {
  todo: {
    label: 'To Do',
    subtitle: 'Planned & queued',
    color: '#8E8E93',
    dotClass: 'bg-zinc-400 dark:bg-zinc-400',
    badgeBgLight: 'bg-zinc-100 text-zinc-700 border-zinc-200/80',
    badgeBgDark: 'bg-zinc-800/80 text-zinc-300 border-zinc-700/60',
    shortcut: '1',
  },
  in_progress: {
    label: 'In Progress',
    subtitle: 'Doing right now',
    color: '#0A84FF',
    dotClass: 'bg-blue-500 shadow-[0_0_8px_rgba(10,132,255,0.65)]',
    badgeBgLight: 'bg-blue-50 text-blue-700 border-blue-200/80',
    badgeBgDark: 'bg-blue-500/15 text-blue-300 border-blue-500/30',
    shortcut: '2',
  },
  in_review: {
    label: 'In Review',
    subtitle: 'Code & PR verification',
    color: '#BF5AF2',
    dotClass: 'bg-purple-500 shadow-[0_0_8px_rgba(191,90,242,0.65)]',
    badgeBgLight: 'bg-purple-50 text-purple-700 border-purple-200/80',
    badgeBgDark: 'bg-purple-500/15 text-purple-300 border-purple-500/30',
    shortcut: '3',
  },
  done: {
    label: 'Done',
    subtitle: 'Shipped & verified',
    color: '#30D158',
    dotClass: 'bg-emerald-500 shadow-[0_0_8px_rgba(48,209,88,0.6)]',
    badgeBgLight: 'bg-emerald-50 text-emerald-700 border-emerald-200/80',
    badgeBgDark: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
    shortcut: '4',
  },
};

export const PRIORITY_CONFIG: Record<
  TaskPriority,
  {
    label: string;
    color: string;
    badgeLight: string;
    badgeDark: string;
  }
> = {
  low: {
    label: 'Low',
    color: '#8E8E93',
    badgeLight: 'bg-slate-100 text-slate-600 border-slate-200',
    badgeDark: 'bg-zinc-800/70 text-zinc-400 border-zinc-700/60',
  },
  medium: {
    label: 'Medium',
    color: '#0A84FF',
    badgeLight: 'bg-sky-50 text-sky-700 border-sky-200',
    badgeDark: 'bg-sky-500/15 text-sky-300 border-sky-500/30',
  },
  high: {
    label: 'High',
    color: '#FF9F0A',
    badgeLight: 'bg-amber-50 text-amber-700 border-amber-200',
    badgeDark: 'bg-amber-500/15 text-amber-300 border-amber-500/30',
  },
  urgent: {
    label: 'Urgent',
    color: '#FF453A',
    badgeLight: 'bg-rose-50 text-rose-700 border-rose-200',
    badgeDark: 'bg-rose-500/15 text-rose-300 border-rose-500/30',
  },
};
