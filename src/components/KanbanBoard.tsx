import React, { useState } from 'react';
import { Plus, GitPullRequest, Clock, Sparkles } from 'lucide-react';
import { Project, Task, TaskStatus } from '../types';
import { STATUS_CONFIG } from '../utils';
import { TaskCard } from './TaskCard';

interface KanbanBoardProps {
  tasks: Task[];
  projects: Project[];
  isDark: boolean;
  onSelectTask: (task: Task) => void;
  onMoveStatus: (taskId: string, newStatus: TaskStatus) => void;
  onToggleUpNext: (taskId: string) => void;
  onToggleSubtask: (taskId: string, subtaskId: string) => void;
  onDeleteTask: (taskId: string) => void;
  onOpenNewTaskWithStatus: (status: TaskStatus) => void;
}

const COLUMNS: TaskStatus[] = ['todo', 'in_progress', 'in_review', 'done'];

export const KanbanBoard: React.FC<KanbanBoardProps> = ({
  tasks,
  projects,
  isDark,
  onSelectTask,
  onMoveStatus,
  onToggleUpNext,
  onToggleSubtask,
  onDeleteTask,
  onOpenNewTaskWithStatus,
}) => {
  const [dragOverColumn, setDragOverColumn] = useState<TaskStatus | null>(null);
  const [draggedTaskId, setDraggedTaskId] = useState<string | null>(null);

  const projectMap = new Map(projects.map((p) => [p.id, p]));

  const handleDragStart = (e: React.DragEvent<HTMLDivElement>, taskId: string) => {
    setDraggedTaskId(taskId);
    e.dataTransfer.setData('text/plain', taskId);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>, status: TaskStatus) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (dragOverColumn !== status) {
      setDragOverColumn(status);
    }
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>, status: TaskStatus) => {
    e.preventDefault();
    const id = e.dataTransfer.getData('text/plain') || draggedTaskId;
    if (id) {
      onMoveStatus(id, status);
    }
    setDragOverColumn(null);
    setDraggedTaskId(null);
  };

  return (
    <div className="h-full flex gap-4 p-6 overflow-x-auto">
      {COLUMNS.map((status) => {
        const cfg = STATUS_CONFIG[status];
        const colTasks = tasks.filter((t) => t.status === status);
        const totalMinutes = colTasks.reduce((acc, t) => acc + (t.estimateMinutes || 0), 0);
        const hoursEst = (totalMinutes / 60).toFixed(1);
        const isOver = dragOverColumn === status;

        return (
          <div
            key={status}
            onDragOver={(e) => handleDragOver(e, status)}
            onDragLeave={() => setDragOverColumn(null)}
            onDrop={(e) => handleDrop(e, status)}
            className={`flex-1 min-w-[305px] max-w-[380px] h-full flex flex-col rounded-3xl border transition-all duration-200 ${
              isOver
                ? isDark
                  ? 'bg-blue-500/10 border-blue-500/50 ring-2 ring-blue-500/25'
                  : 'bg-blue-50/90 border-blue-400 ring-2 ring-blue-400/20'
                : isDark
                ? 'bg-zinc-900/45 border-white/[0.07]'
                : 'bg-zinc-100/75 border-black/[0.06]'
            } backdrop-blur-xl`}
          >
            {/* Column Header */}
            <div
              className={`p-4 border-b flex items-center justify-between ${
                isDark ? 'border-white/[0.06]' : 'border-black/[0.05]'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <span className={`w-2.5 h-2.5 rounded-full ${cfg.dotClass}`} />
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-sm font-semibold tracking-tight">{cfg.label}</h2>
                    {status === 'in_review' && (
                      <span className="inline-flex items-center gap-1 text-[10px] font-mono px-1.5 py-0.5 rounded-md bg-purple-500/15 text-purple-400 font-medium">
                        <GitPullRequest size={10} />
                        Code
                      </span>
                    )}
                    <span
                      className={`text-xs font-mono font-semibold px-2 py-0.5 rounded-full border ${
                        isDark ? cfg.badgeBgDark : cfg.badgeBgLight
                      }`}
                    >
                      {colTasks.length}
                    </span>
                  </div>
                  <p className="text-[11px] opacity-50 mt-0.5">{cfg.subtitle}</p>
                </div>
              </div>

              <div className="flex items-center gap-1.5">
                {totalMinutes > 0 && (
                  <span
                    title="Total estimated effort in this column"
                    className={`text-[10px] font-mono px-2 py-0.5 rounded-lg flex items-center gap-1 ${
                      isDark ? 'bg-white/5 text-zinc-400' : 'bg-black/5 text-zinc-600'
                    }`}
                  >
                    <Clock size={10} />
                    {hoursEst}h
                  </span>
                )}
                <button
                  onClick={() => onOpenNewTaskWithStatus(status)}
                  title={`Add task to ${cfg.label}`}
                  className={`p-1.5 rounded-xl border transition cursor-pointer ${
                    isDark
                      ? 'bg-white/5 border-white/10 hover:bg-white/15 text-zinc-300'
                      : 'bg-white border-black/10 hover:bg-zinc-50 text-zinc-700 shadow-2xs'
                  }`}
                >
                  <Plus size={14} />
                </button>
              </div>
            </div>

            {/* Cards Scroll Area */}
            <div className="flex-1 p-3 space-y-3 overflow-y-auto">
              {colTasks.length === 0 ? (
                <div
                  className={`h-44 rounded-2xl border border-dashed flex flex-col items-center justify-center p-4 text-center transition ${
                    isDark
                      ? 'border-white/10 text-zinc-500'
                      : 'border-black/10 text-zinc-400'
                  }`}
                >
                  <Sparkles size={18} className="mb-1.5 opacity-50" />
                  <p className="text-xs font-medium">No tasks in {cfg.label}</p>
                  <p className="text-[11px] opacity-70 mt-0.5">
                    Drag a card here or click + to create one
                  </p>
                </div>
              ) : (
                colTasks.map((task) => (
                  <TaskCard
                    key={task.id}
                    task={task}
                    project={projectMap.get(task.projectId)}
                    isDark={isDark}
                    onSelectTask={onSelectTask}
                    onMoveStatus={onMoveStatus}
                    onToggleUpNext={onToggleUpNext}
                    onToggleSubtask={onToggleSubtask}
                    onDeleteTask={onDeleteTask}
                    onDragStart={handleDragStart}
                  />
                ))
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
};
