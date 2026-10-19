import React from 'react';
import {
  Clock,
  Flame,
  GitBranch,
  GitPullRequest,
  CheckCircle2,
  ArrowRight,
  Sparkles,
  UserCheck,
} from 'lucide-react';
import { Project, Task, TaskStatus } from '../types';
import { getDueTimeMeta, PRIORITY_CONFIG, STATUS_CONFIG } from '../utils';

interface FocusListViewProps {
  mode: 'up_next' | 'my_tasks';
  tasks: Task[];
  projects: Project[];
  isDark: boolean;
  onSelectTask: (task: Task) => void;
  onMoveStatus: (taskId: string, newStatus: TaskStatus) => void;
  onToggleUpNext: (taskId: string) => void;
  onToggleSubtask: (taskId: string, subtaskId: string) => void;
}

const NEXT_STAGE: Record<TaskStatus, TaskStatus> = {
  todo: 'in_progress',
  in_progress: 'in_review',
  in_review: 'done',
  done: 'done',
};

export const FocusListView: React.FC<FocusListViewProps> = ({
  mode,
  tasks,
  projects,
  isDark,
  onSelectTask,
  onMoveStatus,
  onToggleUpNext,
  onToggleSubtask,
}) => {
  const projectMap = new Map(projects.map((p) => [p.id, p]));

  const filteredTasks = tasks
    .filter((t) => (mode === 'up_next' ? t.upNext : t.assignedToMe))
    .sort((a, b) => {
      if (a.status === 'done' && b.status !== 'done') return 1;
      if (a.status !== 'done' && b.status === 'done') return -1;
      return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
    });

  return (
    <div className="h-full overflow-y-auto p-6 max-w-5xl mx-auto space-y-4">
      {/* Header Banner */}
      <div
        className={`p-5 rounded-3xl border flex items-center justify-between backdrop-blur-xl ${
          isDark
            ? 'bg-gradient-to-r from-blue-500/10 via-purple-500/10 to-transparent border-white/10'
            : 'bg-gradient-to-r from-blue-50 via-purple-50/60 to-white border-black/[0.07] shadow-2xs'
        }`}
      >
        <div className="flex items-center gap-3.5">
          <div
            className={`w-11 h-11 rounded-2xl flex items-center justify-center ${
              mode === 'up_next'
                ? 'bg-amber-500/15 text-amber-500'
                : 'bg-emerald-500/15 text-emerald-500'
            }`}
          >
            {mode === 'up_next' ? <Flame size={22} /> : <UserCheck size={22} />}
          </div>
          <div>
            <h2 className="text-base font-semibold tracking-tight">
              {mode === 'up_next'
                ? 'Up Next — High Velocity Queue'
                : 'My Tasks — Personal Execution Queue'}
            </h2>
            <p className="text-xs opacity-60">
              {mode === 'up_next'
                ? 'Starred tasks across all projects ordered by due time for uninterrupted deep work'
                : 'All tasks assigned to you with one-click progression through Code Review and Done'}
            </p>
          </div>
        </div>

        <div className="text-right font-mono">
          <span className="text-2xl font-bold">
            {filteredTasks.filter((t) => t.status !== 'done').length}
          </span>
          <span className="block text-[10px] uppercase tracking-wider opacity-50">
            Remaining
          </span>
        </div>
      </div>

      {/* Task Rows */}
      {filteredTasks.length === 0 ? (
        <div
          className={`p-12 rounded-3xl border border-dashed text-center ${
            isDark ? 'border-white/10 text-zinc-500' : 'border-black/10 text-zinc-400'
          }`}
        >
          <Sparkles size={24} className="mx-auto mb-2 opacity-50" />
          <p className="text-sm font-medium">Queue is clear!</p>
          <p className="text-xs opacity-70 mt-1">
            Click the flame icon on any Kanban card to pin it to Up Next.
          </p>
        </div>
      ) : (
        <div className="space-y-2.5">
          {filteredTasks.map((task) => {
            const project = projectMap.get(task.projectId);
            const dueMeta = getDueTimeMeta(task.dueDate, task.status);
            const statusCfg = STATUS_CONFIG[task.status];
            const priorityCfg = PRIORITY_CONFIG[task.priority];

            return (
              <div
                key={task.id}
                onClick={() => onSelectTask(task)}
                className={`group p-4 rounded-2xl border transition-all flex flex-col md:flex-row md:items-center justify-between gap-4 backdrop-blur-xl cursor-pointer ${
                  isDark
                    ? 'bg-zinc-900/75 hover:bg-zinc-800/80 border-white/[0.08] hover:border-white/20'
                    : 'bg-white/95 hover:bg-white border-black/[0.07] hover:border-black/15 shadow-2xs'
                }`}
              >
                <div className="space-y-1.5 min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono text-xs opacity-45">{task.id}</span>
                    <span
                      className={`text-[11px] font-semibold px-2.5 py-0.5 rounded-full border ${
                        isDark ? statusCfg.badgeBgDark : statusCfg.badgeBgLight
                      }`}
                    >
                      {statusCfg.label}
                    </span>
                    <span
                      className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${
                        isDark ? priorityCfg.badgeDark : priorityCfg.badgeLight
                      }`}
                    >
                      {priorityCfg.label}
                    </span>
                    {project && (
                      <span
                        className="text-[11px] font-medium px-2 py-0.5 rounded-full"
                        style={{
                          backgroundColor: `${project.color}18`,
                          color: project.color,
                        }}
                      >
                        {project.name}
                      </span>
                    )}
                    {task.prUrl && (
                      <span className="inline-flex items-center gap-1 text-[11px] font-mono px-2 py-0.5 rounded-md bg-purple-500/15 text-purple-400">
                        <GitPullRequest size={11} />
                        {task.prUrl}
                      </span>
                    )}
                    {task.branchName && (
                      <span className="inline-flex items-center gap-1 text-[11px] font-mono opacity-60">
                        <GitBranch size={11} />
                        {task.branchName}
                      </span>
                    )}
                  </div>

                  <h3
                    className={`text-sm font-semibold group-hover:text-blue-500 transition-colors ${
                      task.status === 'done' ? 'line-through opacity-50' : ''
                    }`}
                  >
                    {task.title}
                  </h3>
                  <p className="text-xs opacity-60 line-clamp-1">{task.description}</p>

                  {/* Inline subtasks */}
                  {task.subtasks.length > 0 && (
                    <div className="flex flex-wrap gap-2 pt-1">
                      {task.subtasks.map((s) => (
                        <button
                          key={s.id}
                          onClick={(e) => {
                            e.stopPropagation();
                            onToggleSubtask(task.id, s.id);
                          }}
                          className={`text-[11px] px-2 py-0.5 rounded-lg border flex items-center gap-1.5 transition cursor-pointer ${
                            s.completed
                              ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-500 line-through opacity-70'
                              : isDark
                              ? 'bg-white/5 border-white/10 text-zinc-300'
                              : 'bg-zinc-50 border-black/10 text-zinc-700'
                          }`}
                        >
                          <CheckCircle2 size={11} />
                          <span>{s.title}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Right Controls: Due Countdown + Quick Stage Advance */}
                <div className="flex items-center gap-2.5 shrink-0">
                  <div
                    className={`px-3 py-1.5 rounded-xl text-xs font-mono font-medium flex items-center gap-1.5 ${
                      dueMeta.isOverdue
                        ? 'bg-rose-500/15 text-rose-500 border border-rose-500/30'
                        : dueMeta.isDueSoon
                        ? 'bg-amber-500/15 text-amber-500 border border-amber-500/30'
                        : isDark
                        ? 'bg-white/5 text-zinc-300'
                        : 'bg-black/5 text-zinc-700'
                    }`}
                  >
                    <Clock size={13} />
                    <span>{dueMeta.label}</span>
                  </div>

                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onToggleUpNext(task.id);
                    }}
                    title="Toggle Up Next"
                    className={`p-2 rounded-xl border transition cursor-pointer ${
                      task.upNext
                        ? 'bg-amber-500/20 border-amber-500/40 text-amber-500'
                        : isDark
                        ? 'border-white/10 text-zinc-500 hover:text-amber-400'
                        : 'border-black/10 text-zinc-400 hover:text-amber-500'
                    }`}
                  >
                    <Flame size={15} fill={task.upNext ? 'currentColor' : 'none'} />
                  </button>

                  {task.status !== 'done' ? (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onMoveStatus(task.id, NEXT_STAGE[task.status]);
                      }}
                      className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold bg-[#0A84FF] hover:bg-[#0070E0] text-white shadow-sm transition cursor-pointer"
                    >
                      <span>Move to {STATUS_CONFIG[NEXT_STAGE[task.status]].label}</span>
                      <ArrowRight size={13} />
                    </button>
                  ) : (
                    <span className="px-3 py-2 rounded-xl text-xs font-semibold bg-emerald-500/15 text-emerald-500 flex items-center gap-1">
                      <CheckCircle2 size={14} />
                      Done
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
