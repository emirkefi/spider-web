import React from 'react';
import {
  CheckCircle2,
  Clock,
  Flame,
  FolderKanban,
  GitPullRequest,
  TrendingUp,
  AlertTriangle,
  Zap,
  CalendarClock,
} from 'lucide-react';
import { Project, Task, TaskStatus } from '../types';
import { getDueTimeMeta, STATUS_CONFIG } from '../utils';

interface AnalyticsViewProps {
  tasks: Task[];
  projects: Project[];
  isDark: boolean;
}

export const AnalyticsView: React.FC<AnalyticsViewProps> = ({ tasks, projects, isDark }) => {
  const total = tasks.length;
  const doneCount = tasks.filter((t) => t.status === 'done').length;
  const inReviewCount = tasks.filter((t) => t.status === 'in_review').length;
  const inProgressCount = tasks.filter((t) => t.status === 'in_progress').length;
  const todoCount = tasks.filter((t) => t.status === 'todo').length;

  const completionPct = total > 0 ? Math.round((doneCount / total) * 100) : 0;
  const activeReviewOrDonePct =
    total > 0 ? Math.round(((doneCount + inReviewCount) / total) * 100) : 0;

  // Subtasks completion metric
  const allSubtasks = tasks.flatMap((t) => t.subtasks);
  const doneSubtasks = allSubtasks.filter((s) => s.completed).length;
  const subtaskPct =
    allSubtasks.length > 0 ? Math.round((doneSubtasks / allSubtasks.length) * 100) : 0;

  // Estimate hours metrics
  const totalMinutes = tasks.reduce((acc, t) => acc + t.estimateMinutes, 0);
  const doneMinutes = tasks
    .filter((t) => t.status === 'done')
    .reduce((acc, t) => acc + t.estimateMinutes, 0);

  // SVG Donut Ring calculations
  const radius = 64;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (completionPct / 100) * circumference;

  const statusDistribution: { status: TaskStatus; count: number; pct: number }[] = (
    ['done', 'in_review', 'in_progress', 'todo'] as TaskStatus[]
  ).map((status) => {
    const count = tasks.filter((t) => t.status === status).length;
    return {
      status,
      count,
      pct: total > 0 ? Math.round((count / total) * 100) : 0,
    };
  });

  // Upcoming tasks sorted by due time
  const upcomingDeadlines = [...tasks]
    .filter((t) => t.status !== 'done')
    .sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime())
    .slice(0, 5);

  return (
    <div className="h-full overflow-y-auto p-6 space-y-6">
      {/* Top KPI Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div
          className={`p-5 rounded-3xl border backdrop-blur-xl ${
            isDark
              ? 'bg-zinc-900/70 border-white/10'
              : 'bg-white/90 border-black/[0.07] shadow-sm'
          }`}
        >
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-medium opacity-60">Overall Completion</span>
            <span className="p-2 rounded-xl bg-emerald-500/15 text-emerald-500">
              <CheckCircle2 size={16} />
            </span>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-bold tracking-tight font-mono">{completionPct}%</span>
            <span className="text-xs text-emerald-500 font-medium">
              {doneCount} of {total} tasks done
            </span>
          </div>
          <p className="text-[11px] opacity-50 mt-2">
            {(doneMinutes / 60).toFixed(1)}h of {(totalMinutes / 60).toFixed(1)}h estimated work shipped
          </p>
        </div>

        <div
          className={`p-5 rounded-3xl border backdrop-blur-xl ${
            isDark
              ? 'bg-zinc-900/70 border-white/10'
              : 'bg-white/90 border-black/[0.07] shadow-sm'
          }`}
        >
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-medium opacity-60">In Code Review (PRs)</span>
            <span className="p-2 rounded-xl bg-purple-500/15 text-purple-500">
              <GitPullRequest size={16} />
            </span>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-bold tracking-tight font-mono">{inReviewCount}</span>
            <span className="text-xs text-purple-400 font-medium">
              {activeReviewOrDonePct}% pipeline ready
            </span>
          </div>
          <p className="text-[11px] opacity-50 mt-2">
            Awaiting code verification & merge to main
          </p>
        </div>

        <div
          className={`p-5 rounded-3xl border backdrop-blur-xl ${
            isDark
              ? 'bg-zinc-900/70 border-white/10'
              : 'bg-white/90 border-black/[0.07] shadow-sm'
          }`}
        >
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-medium opacity-60">Active Projects</span>
            <span className="p-2 rounded-xl bg-blue-500/15 text-blue-500">
              <FolderKanban size={16} />
            </span>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-bold tracking-tight font-mono">{projects.length}</span>
            <span className="text-xs text-blue-400 font-medium">
              {inProgressCount} tasks in Doing
            </span>
          </div>
          <p className="text-[11px] opacity-50 mt-2">
            Mapped across Hyprland workspaces 1–{projects.length}
          </p>
        </div>

        <div
          className={`p-5 rounded-3xl border backdrop-blur-xl ${
            isDark
              ? 'bg-zinc-900/70 border-white/10'
              : 'bg-white/90 border-black/[0.07] shadow-sm'
          }`}
        >
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-medium opacity-60">Checklist Velocity</span>
            <span className="p-2 rounded-xl bg-amber-500/15 text-amber-500">
              <Zap size={16} />
            </span>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-bold tracking-tight font-mono">{subtaskPct}%</span>
            <span className="text-xs text-amber-500 font-medium">
              {doneSubtasks}/{allSubtasks.length} subtasks
            </span>
          </div>
          <p className="text-[11px] opacity-50 mt-2">
            Granular atomic steps completed across cards
          </p>
        </div>
      </div>

      {/* Middle Row: Apple Activity Ring + Stage Breakdown Bar Chart */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Completion Ring Chart */}
        <div
          className={`lg:col-span-5 p-6 rounded-3xl border flex flex-col justify-between backdrop-blur-xl ${
            isDark
              ? 'bg-zinc-900/70 border-white/10'
              : 'bg-white/90 border-black/[0.07] shadow-sm'
          }`}
        >
          <div>
            <h3 className="text-sm font-semibold tracking-tight">Workflow Completion Ring</h3>
            <p className="text-xs opacity-55 mt-0.5">
              Visual ratio of Done vs In Review, Doing, and To Do
            </p>
          </div>

          <div className="my-6 flex items-center justify-center gap-8">
            <div className="relative w-40 h-40 flex items-center justify-center">
              <svg className="w-full h-full -rotate-90" viewBox="0 0 160 160">
                <circle
                  cx="80"
                  cy="80"
                  r={radius}
                  fill="transparent"
                  stroke={isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.07)'}
                  strokeWidth="16"
                />
                <circle
                  cx="80"
                  cy="80"
                  r={radius}
                  fill="transparent"
                  stroke="url(#appleRingGrad)"
                  strokeWidth="16"
                  strokeDasharray={circumference}
                  strokeDashoffset={strokeDashoffset}
                  strokeLinecap="round"
                  className="transition-all duration-700 ease-out"
                />
                <defs>
                  <linearGradient id="appleRingGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#30D158" />
                    <stop offset="50%" stopColor="#0A84FF" />
                    <stop offset="100%" stopColor="#BF5AF2" />
                  </linearGradient>
                </defs>
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
                <span className="text-3xl font-bold font-mono tracking-tight">
                  {completionPct}%
                </span>
                <span className="text-[11px] uppercase tracking-wider opacity-50 font-semibold">
                  Complete
                </span>
              </div>
            </div>

            <div className="space-y-3">
              {statusDistribution.map(({ status, count, pct }) => {
                const cfg = STATUS_CONFIG[status];
                return (
                  <div key={status} className="flex items-center gap-2.5 text-xs">
                    <span
                      className="w-3 h-3 rounded-full shrink-0"
                      style={{ backgroundColor: cfg.color }}
                    />
                    <div className="w-24 font-medium">{cfg.label}</div>
                    <span className="font-mono font-semibold">{count}</span>
                    <span className="font-mono opacity-45">({pct}%)</span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Multi-segment Horizontal Stacked Bar */}
          <div className="space-y-2">
            <div className="flex justify-between text-[11px] opacity-60">
              <span>Pipeline Distribution</span>
              <span className="font-mono">{total} total tasks</span>
            </div>
            <div className="w-full h-3 rounded-full overflow-hidden flex bg-zinc-500/15 p-0.5 gap-0.5">
              {statusDistribution.map(({ status, pct }) =>
                pct > 0 ? (
                  <div
                    key={status}
                    style={{
                      width: `${pct}%`,
                      backgroundColor: STATUS_CONFIG[status].color,
                    }}
                    className="h-full first:rounded-l-full last:rounded-r-full transition-all duration-500"
                    title={`${STATUS_CONFIG[status].label}: ${pct}%`}
                  />
                ) : null
              )}
            </div>
          </div>
        </div>

        {/* Project Progress & Due Countdown Matrix */}
        <div
          className={`lg:col-span-7 p-6 rounded-3xl border flex flex-col justify-between backdrop-blur-xl ${
            isDark
              ? 'bg-zinc-900/70 border-white/10'
              : 'bg-white/90 border-black/[0.07] shadow-sm'
          }`}
        >
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-semibold tracking-tight">
                Project Progress & Due Deadlines ({projects.length} Projects)
              </h3>
              <p className="text-xs opacity-55 mt-0.5">
                How much is done per project alongside remaining time until deadline
              </p>
            </div>
            <TrendingUp size={18} className="text-blue-500" />
          </div>

          <div className="space-y-4 my-auto">
            {projects.map((project) => {
              const pTasks = tasks.filter((t) => t.projectId === project.id);
              const pDone = pTasks.filter((t) => t.status === 'done').length;
              const pReview = pTasks.filter((t) => t.status === 'in_review').length;
              const pDoing = pTasks.filter((t) => t.status === 'in_progress').length;
              const pPct = pTasks.length > 0 ? Math.round((pDone / pTasks.length) * 100) : 0;
              const dueMeta = getDueTimeMeta(project.dueDate);

              return (
                <div
                  key={project.id}
                  className={`p-3.5 rounded-2xl border ${
                    isDark
                      ? 'bg-white/[0.03] border-white/[0.07]'
                      : 'bg-zinc-50/80 border-black/[0.05]'
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2.5">
                      <span
                        className="w-3 h-3 rounded-full"
                        style={{ backgroundColor: project.color }}
                      />
                      <span className="text-xs font-semibold">{project.name}</span>
                      {project.workspaceId && (
                        <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-500">
                          Hypr WS {project.workspaceId}
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-3">
                      <span
                        className={`text-[11px] font-mono px-2 py-0.5 rounded-lg flex items-center gap-1 ${
                          dueMeta.isOverdue
                            ? 'bg-rose-500/15 text-rose-500'
                            : dueMeta.isDueSoon
                            ? 'bg-amber-500/15 text-amber-500'
                            : isDark
                            ? 'bg-white/5 text-zinc-400'
                            : 'bg-black/5 text-zinc-600'
                        }`}
                      >
                        <CalendarClock size={11} />
                        {dueMeta.label}
                      </span>
                      <span className="text-xs font-mono font-bold" style={{ color: project.color }}>
                        {pPct}%
                      </span>
                    </div>
                  </div>

                  {/* Progress bar */}
                  <div
                    className={`w-full h-2 rounded-full overflow-hidden mb-2 ${
                      isDark ? 'bg-zinc-800' : 'bg-zinc-200'
                    }`}
                  >
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{
                        width: `${pPct}%`,
                        backgroundColor: project.color,
                      }}
                    />
                  </div>

                  <div className="flex items-center justify-between text-[11px] opacity-65 font-mono">
                    <span>
                      {pDone}/{pTasks.length} Done
                    </span>
                    <div className="flex items-center gap-3">
                      <span>{pDoing} Doing</span>
                      <span className="text-purple-400">{pReview} In Review</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Bottom Row: Upcoming Due Time Radar */}
      <div
        className={`p-6 rounded-3xl border backdrop-blur-xl ${
          isDark
            ? 'bg-zinc-900/70 border-white/10'
            : 'bg-white/90 border-black/[0.07] shadow-sm'
        }`}
      >
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-sm font-semibold tracking-tight">
              Due Time Countdown Radar
            </h3>
            <p className="text-xs opacity-55 mt-0.5">
              Unfinished tasks ordered by strictest approaching deadline
            </p>
          </div>
          <Clock size={16} className="text-amber-500" />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
          {upcomingDeadlines.map((task) => {
            const due = getDueTimeMeta(task.dueDate, task.status);
            const cfg = STATUS_CONFIG[task.status];
            return (
              <div
                key={task.id}
                className={`p-3.5 rounded-2xl border flex flex-col justify-between ${
                  isDark
                    ? 'bg-white/[0.03] border-white/[0.07]'
                    : 'bg-zinc-50/90 border-black/[0.06]'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between text-[10px] font-mono mb-1.5">
                    <span className="opacity-50">{task.id}</span>
                    <span
                      className="px-1.5 py-0.5 rounded font-semibold"
                      style={{ backgroundColor: `${cfg.color}20`, color: cfg.color }}
                    >
                      {cfg.label}
                    </span>
                  </div>
                  <p className="text-xs font-semibold line-clamp-2 mb-3">{task.title}</p>
                </div>

                <div
                  className={`text-[11px] font-mono font-semibold px-2.5 py-1 rounded-xl flex items-center justify-between ${
                    due.isOverdue
                      ? 'bg-rose-500/15 text-rose-500'
                      : due.isDueSoon
                      ? 'bg-amber-500/15 text-amber-500'
                      : 'bg-blue-500/10 text-blue-500'
                  }`}
                >
                  <span>{due.label}</span>
                  {due.isOverdue && <AlertTriangle size={12} />}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
