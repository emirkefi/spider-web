import React from 'react';
import {
  Clock,
  Flame,
  GitBranch,
  GitPullRequest,
  CheckSquare,
  ArrowRight,
  ArrowLeft,
  Trash2,
  CheckCircle2,
  AlertTriangle,
} from 'lucide-react';
import { Project, Task, TaskStatus } from '../types';
import { getDueTimeMeta, PRIORITY_CONFIG, STATUS_CONFIG } from '../utils';

interface TaskCardProps {
  task: Task;
  project?: Project;
  isDark: boolean;
  onSelectTask: (task: Task) => void;
  onMoveStatus: (taskId: string, newStatus: TaskStatus) => void;
  onToggleUpNext: (taskId: string) => void;
  onToggleSubtask: (taskId: string, subtaskId: string) => void;
  onDeleteTask: (taskId: string) => void;
  onDragStart: (e: React.DragEvent<HTMLDivElement>, taskId: string) => void;
}

const STATUS_ORDER: TaskStatus[] = ['todo', 'in_progress', 'in_review', 'done'];

export const TaskCard: React.FC<TaskCardProps> = ({
  task,
  project,
  isDark,
  onSelectTask,
  onMoveStatus,
  onToggleUpNext,
  onToggleSubtask,
  onDeleteTask,
  onDragStart,
}) => {
  const dueMeta = getDueTimeMeta(task.dueDate, task.status);
  const priorityMeta = PRIORITY_CONFIG[task.priority];
  const currentIdx = STATUS_ORDER.indexOf(task.status);
  const prevStatus = currentIdx > 0 ? STATUS_ORDER[currentIdx - 1] : null;
  const nextStatus = currentIdx < STATUS_ORDER.length - 1 ? STATUS_ORDER[currentIdx + 1] : null;

  const completedSubtasks = task.subtasks.filter((s) => s.completed).length;

  return (
    <div
      draggable
      onDragStart={(e) => onDragStart(e, task.id)}
      onClick={() => onSelectTask(task)}
      className={`group relative rounded-2xl p-3.5 border transition-all duration-200 cursor-pointer active:cursor-grabbing ${
        isDark
          ? 'bg-zinc-900/80 hover:bg-zinc-800/90 border-white/[0.08] hover:border-white/20 shadow-lg shadow-black/25'
          : 'bg-white/95 hover:bg-white border-black/[0.07] hover:border-black/15 shadow-sm hover:shadow-md'
      }`}
    >
      {/* Top Row: ID, Project Pill, Priority & Quick UpNext Star */}
      <div className="flex items-center justify-between gap-2 mb-2">
        <div className="flex items-center gap-1.5 min-w-0">
          <span className="font-mono text-[10px] font-semibold opacity-45 shrink-0">
            {task.id}
          </span>
          {project && (
            <span
              className="text-[10px] font-semibold px-2 py-0.5 rounded-full truncate"
              style={{
                backgroundColor: `${project.color}18`,
                color: project.color,
              }}
            >
              {project.name}
            </span>
          )}
        </div>

        <div className="flex items-center gap-1 shrink-0">
          {/* Priority Badge */}
          <span
            className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${
              isDark ? priorityMeta.badgeDark : priorityMeta.badgeLight
            }`}
          >
            {priorityMeta.label}
          </span>

          {/* Toggle Up Next Flame */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              onToggleUpNext(task.id);
            }}
            title={task.upNext ? 'Pinned to Up Next Queue' : 'Add to Up Next Queue'}
            className={`p-1 rounded-lg transition cursor-pointer ${
              task.upNext
                ? 'bg-amber-500/20 text-amber-500'
                : 'opacity-30 hover:opacity-100 hover:bg-amber-500/10 hover:text-amber-500'
            }`}
          >
            <Flame size={13} fill={task.upNext ? 'currentColor' : 'none'} />
          </button>
        </div>
      </div>

      {/* Task Title & Description */}
      <h3
        className={`text-[13px] font-semibold leading-snug mb-1 group-hover:text-blue-500 transition-colors ${
          task.status === 'done' ? 'line-through opacity-55' : ''
        }`}
      >
        {task.title}
      </h3>
      {task.description && (
        <p className="text-xs opacity-60 line-clamp-2 leading-relaxed mb-2.5">
          {task.description}
        </p>
      )}

      {/* Code Review / Git Branch Box (Highlighted especially for In Review column) */}
      {(task.branchName || task.prUrl) && (
        <div
          className={`mb-2.5 px-2.5 py-1.5 rounded-xl border flex items-center justify-between text-[11px] font-mono ${
            task.status === 'in_review'
              ? isDark
                ? 'bg-purple-500/12 border-purple-500/30 text-purple-300'
                : 'bg-purple-50 border-purple-200 text-purple-800'
              : isDark
              ? 'bg-white/[0.03] border-white/[0.07] text-zinc-400'
              : 'bg-zinc-50 border-black/[0.06] text-zinc-600'
          }`}
        >
          {task.branchName && (
            <div className="flex items-center gap-1.5 truncate">
              <GitBranch size={12} className="shrink-0 text-purple-500" />
              <span className="truncate">{task.branchName}</span>
            </div>
          )}
          {task.prUrl && (
            <div className="flex items-center gap-1 shrink-0 font-semibold text-purple-500 ml-2">
              <GitPullRequest size={12} />
              <span>{task.prUrl}</span>
            </div>
          )}
        </div>
      )}

      {/* Interactive Subtasks Checklist */}
      {task.subtasks.length > 0 && (
        <div
          className={`mb-2.5 p-2 rounded-xl border space-y-1 ${
            isDark ? 'bg-black/25 border-white/[0.06]' : 'bg-zinc-50/80 border-black/[0.05]'
          }`}
        >
          <div className="flex items-center justify-between text-[10px] font-mono opacity-65 mb-1">
            <span className="flex items-center gap-1">
              <CheckSquare size={11} />
              Subtasks
            </span>
            <span>
              {completedSubtasks}/{task.subtasks.length}
            </span>
          </div>
          {task.subtasks.map((sub) => (
            <button
              key={sub.id}
              onClick={(e) => {
                e.stopPropagation();
                onToggleSubtask(task.id, sub.id);
              }}
              className="w-full flex items-center gap-2 text-left text-[11px] py-0.5 hover:opacity-100 transition cursor-pointer"
            >
              <span
                className={`w-3.5 h-3.5 rounded flex items-center justify-center border shrink-0 transition ${
                  sub.completed
                    ? 'bg-emerald-500 border-emerald-500 text-white'
                    : isDark
                    ? 'border-zinc-600'
                    : 'border-zinc-300'
                }`}
              >
                {sub.completed && <CheckCircle2 size={10} />}
              </span>
              <span className={`truncate ${sub.completed ? 'line-through opacity-45' : 'opacity-85'}`}>
                {sub.title}
              </span>
            </button>
          ))}
        </div>
      )}

      {/* Tags */}
      {task.tags.length > 0 && (
        <div className="flex flex-wrap gap-1 mb-2.5">
          {task.tags.map((tag) => (
            <span
              key={tag}
              className={`text-[10px] font-mono px-1.5 py-0.5 rounded-md ${
                isDark ? 'bg-white/[0.06] text-zinc-400' : 'bg-black/[0.05] text-zinc-600'
              }`}
            >
              #{tag}
            </span>
          ))}
        </div>
      )}

      {/* Footer: Due Time Countdown + Fast 1-Click Stage Progression */}
      <div
        className={`pt-2 border-t flex items-center justify-between gap-2 ${
          isDark ? 'border-white/[0.07]' : 'border-black/[0.06]'
        }`}
      >
        <div className="flex items-center gap-2 min-w-0">
          <span
            className={`inline-flex items-center gap-1 text-[11px] font-mono font-medium px-2 py-0.5 rounded-lg ${
              dueMeta.urgencyLevel === 'overdue'
                ? 'bg-rose-500/15 text-rose-500 border border-rose-500/30'
                : dueMeta.urgencyLevel === 'critical'
                ? 'bg-amber-500/15 text-amber-500 border border-amber-500/30'
                : dueMeta.urgencyLevel === 'completed'
                ? 'bg-emerald-500/15 text-emerald-500'
                : isDark
                ? 'bg-white/[0.05] text-zinc-400'
                : 'bg-black/[0.05] text-zinc-600'
            }`}
          >
            {dueMeta.urgencyLevel === 'overdue' ? (
              <AlertTriangle size={11} />
            ) : (
              <Clock size={11} />
            )}
            <span>{dueMeta.label}</span>
          </span>

          {task.assignedToMe && (
            <span
              title="Assigned to Me"
              className={`text-[10px] px-1.5 py-0.5 rounded-md font-medium ${
                isDark ? 'bg-emerald-500/15 text-emerald-300' : 'bg-emerald-50 text-emerald-700'
              }`}
            >
              Me
            </span>
          )}
        </div>

        {/* Fast Stage Transition Controls */}
        <div className="flex items-center gap-1 opacity-70 group-hover:opacity-100 transition">
          {prevStatus && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onMoveStatus(task.id, prevStatus);
              }}
              title={`Move back to ${STATUS_CONFIG[prevStatus].label}`}
              className={`p-1 rounded-lg border transition cursor-pointer ${
                isDark
                  ? 'border-white/10 hover:bg-white/10 text-zinc-300'
                  : 'border-black/10 hover:bg-black/5 text-zinc-700'
              }`}
            >
              <ArrowLeft size={12} />
            </button>
          )}
          {nextStatus && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onMoveStatus(task.id, nextStatus);
              }}
              title={`Advance to ${STATUS_CONFIG[nextStatus].label}`}
              className="flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-semibold bg-blue-500/15 text-blue-500 hover:bg-blue-500 hover:text-white transition cursor-pointer"
            >
              <span>{STATUS_CONFIG[nextStatus].label}</span>
              <ArrowRight size={11} />
            </button>
          )}
          <button
            onClick={(e) => {
              e.stopPropagation();
              onDeleteTask(task.id);
            }}
            title="Delete Task"
            className="p-1 rounded-lg opacity-40 hover:opacity-100 hover:bg-rose-500/15 hover:text-rose-500 transition cursor-pointer"
          >
            <Trash2 size={12} />
          </button>
        </div>
      </div>
    </div>
  );
};
