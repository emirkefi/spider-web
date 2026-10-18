import React, { useRef, useEffect } from 'react';
import {
  Search,
  Sun,
  Moon,
  Plus,
  FolderKanban,
  Clock,
  X,
  Keyboard,
  Trash2,
} from 'lucide-react';
import { ActiveView, Project, Task, TaskPriority } from '../types';
import { getDueTimeMeta } from '../utils';

interface TopBarProps {
  isDark: boolean;
  setIsDark: (v: boolean) => void;
  searchQuery: string;
  setSearchQuery: (q: string) => void;
  priorityFilter: TaskPriority | 'all';
  setPriorityFilter: (p: TaskPriority | 'all') => void;
  activeView: ActiveView;
  selectedProject: Project | undefined;
  projectsCount: number;
  tasks: Task[];
  onOpenNewTask: () => void;
  onOpenNewProject: () => void;
  onDeleteProject: (projectId: string) => void;
  onOpenKeybindsModal: () => void;
}

export const TopBar: React.FC<TopBarProps> = ({
  isDark,
  setIsDark,
  searchQuery,
  setSearchQuery,
  priorityFilter,
  setPriorityFilter,
  activeView,
  selectedProject,
  projectsCount,
  tasks,
  onOpenNewTask,
  onDeleteProject,
  onOpenKeybindsModal,
}) => {
  const searchInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        e.key === '/' &&
        document.activeElement?.tagName !== 'INPUT' &&
        document.activeElement?.tagName !== 'TEXTAREA'
      ) {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const viewTitles: Record<ActiveView, { title: string; subtitle: string }> = {
    board: {
      title: selectedProject ? selectedProject.name : 'Workflow Kanban',
      subtitle: selectedProject
        ? selectedProject.description
        : 'Arrange tasks across To Do, Doing, Code Review, and Done',
    },
    up_next: {
      title: 'Up Next Focus Queue',
      subtitle: 'High-leverage tasks queued for immediate execution',
    },
    my_tasks: {
      title: 'My Assigned Tasks',
      subtitle: 'Personal execution queue sorted by due time & priority',
    },
    analytics: {
      title: 'Velocity & Completion Analytics',
      subtitle: 'Real-time visual breakdown of completed work, PR reviews, and deadlines',
    },
  };

  // Calculate nearest due task & overdue count
  const activeTasks = tasks.filter((t) => t.status !== 'done');
  const dueSoonCount = activeTasks.filter((t) => {
    const meta = getDueTimeMeta(t.dueDate, t.status);
    return meta.isDueSoon || meta.isOverdue;
  }).length;

  const projectDueMeta = selectedProject ? getDueTimeMeta(selectedProject.dueDate) : null;

  return (
    <header
      className={`h-16 px-6 shrink-0 flex items-center justify-between border-b transition-colors duration-200 ${
        isDark
          ? 'bg-zinc-900/60 border-white/10 text-zinc-100'
          : 'bg-white/70 border-black/[0.08] text-zinc-900'
      } backdrop-blur-2xl`}
    >
      {/* Left: Active View Title + Project Count & Due Time Pills */}
      <div className="flex items-center gap-4 min-w-0">
        <div className="min-w-0">
          <div className="flex items-center gap-2.5">
            {selectedProject && (
              <span
                className="w-3 h-3 rounded-full shrink-0"
                style={{ backgroundColor: selectedProject.color }}
              />
            )}
            <h1 className="text-base font-semibold tracking-tight truncate">
              {viewTitles[activeView].title}
            </h1>

            {/* If a specific project is selected, show quick Remove Project button */}
            {selectedProject && (
              <button
                onClick={() => onDeleteProject(selectedProject.id)}
                title={`Delete project "${selectedProject.name}"`}
                className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full border border-rose-500/30 bg-rose-500/10 text-rose-500 hover:bg-rose-500 hover:text-white transition cursor-pointer"
              >
                <Trash2 size={11} />
                <span>Remove Project</span>
              </button>
            )}

            {/* Project count badge */}
            <div
              className={`hidden sm:flex items-center gap-1.5 text-xs font-medium px-2.5 py-0.5 rounded-full border ${
                isDark
                  ? 'bg-white/[0.06] border-white/10 text-zinc-300'
                  : 'bg-black/[0.04] border-black/10 text-zinc-700'
              }`}
            >
              <FolderKanban size={12} className="text-blue-500" />
              <span>{projectsCount} Projects</span>
            </div>

            {/* Due time showcase pill */}
            {projectDueMeta ? (
              <div
                className={`hidden md:flex items-center gap-1.5 text-xs font-mono px-2.5 py-0.5 rounded-full border ${
                  projectDueMeta.isOverdue
                    ? 'bg-rose-500/15 border-rose-500/30 text-rose-400'
                    : 'bg-amber-500/15 border-amber-500/30 text-amber-500'
                }`}
              >
                <Clock size={12} />
                <span>Project {projectDueMeta.label}</span>
              </div>
            ) : (
              dueSoonCount > 0 && (
                <div
                  className={`hidden md:flex items-center gap-1.5 text-xs font-mono px-2.5 py-0.5 rounded-full border ${
                    isDark
                      ? 'bg-amber-500/15 border-amber-500/30 text-amber-300'
                      : 'bg-amber-500/10 border-amber-500/30 text-amber-700'
                  }`}
                >
                  <Clock size={12} className="text-amber-500" />
                  <span>{dueSoonCount} due within 24h</span>
                </div>
              )
            )}
          </div>
          <p className="text-xs opacity-55 truncate mt-0.5">{viewTitles[activeView].subtitle}</p>
        </div>
      </div>

      {/* Top Right Bar: Search + Priority Filter + Keybinds + Light/Dark Mode Toggle + Create New Task */}
      <div className="flex items-center gap-2.5">
        {/* Spotlight-style Search Input */}
        <div className="relative flex items-center">
          <Search
            size={14}
            className="absolute left-3 pointer-events-none opacity-45"
          />
          <input
            ref={searchInputRef}
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search tasks, PRs, tags... (/)"
            className={`w-44 lg:w-60 pl-8 pr-7 py-1.5 text-xs rounded-xl border outline-none transition-all ${
              isDark
                ? 'bg-white/[0.06] border-white/10 text-zinc-100 placeholder:text-zinc-500 focus:bg-white/10 focus:border-blue-500/60 focus:w-68'
                : 'bg-black/[0.04] border-black/10 text-zinc-900 placeholder:text-zinc-400 focus:bg-white focus:border-blue-500/60 focus:w-68 shadow-2xs'
            }`}
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-2 opacity-50 hover:opacity-100"
            >
              <X size={13} />
            </button>
          )}
        </div>

        {/* Priority Quick Filter */}
        <div
          className={`hidden xl:flex items-center p-0.5 rounded-xl border text-xs ${
            isDark
              ? 'bg-white/[0.04] border-white/10'
              : 'bg-black/[0.04] border-black/[0.08]'
          }`}
        >
          {(['all', 'urgent', 'high', 'medium', 'low'] as const).map((p) => (
            <button
              key={p}
              onClick={() => setPriorityFilter(p)}
              className={`px-2 py-1 rounded-lg capitalize font-medium transition-all cursor-pointer ${
                priorityFilter === p
                  ? isDark
                    ? 'bg-white/15 text-white shadow-2xs'
                    : 'bg-white text-zinc-900 shadow-2xs'
                  : 'opacity-55 hover:opacity-90'
              }`}
            >
              {p}
            </button>
          ))}
        </div>

        {/* Keybinds Showcase Popup Button */}
        <button
          onClick={onOpenKeybindsModal}
          title="Show Kanban & Hyprland Keybinds (?)"
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-medium transition-all active:scale-95 cursor-pointer ${
            isDark
              ? 'bg-white/[0.07] border-white/10 text-zinc-200 hover:bg-white/12'
              : 'bg-black/[0.05] border-black/10 text-zinc-700 hover:bg-black/10'
          }`}
        >
          <Keyboard size={14} className="text-blue-500" />
          <span className="hidden md:inline">Keybinds</span>
          <kbd className="text-[10px] font-mono opacity-65 px-1 rounded border border-current/20">
            ?
          </kbd>
        </button>

        {/* Light / Dark Mode Apple Toggle Button */}
        <button
          onClick={() => setIsDark(!isDark)}
          title={isDark ? 'Switch to Apple Light Mode (T)' : 'Switch to Apple Dark Mode (T)'}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-medium transition-all active:scale-95 cursor-pointer ${
            isDark
              ? 'bg-white/[0.07] border-white/10 text-amber-300 hover:bg-white/12'
              : 'bg-black/[0.05] border-black/10 text-zinc-700 hover:bg-black/10'
          }`}
        >
          {isDark ? (
            <>
              <Sun size={14} className="text-amber-400" />
              <span className="hidden sm:inline">Light</span>
            </>
          ) : (
            <>
              <Moon size={14} className="text-indigo-600" />
              <span className="hidden sm:inline">Dark</span>
            </>
          )}
        </button>

        {/* Create New Task Primary Button */}
        <button
          onClick={onOpenNewTask}
          className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-semibold bg-[#0A84FF] hover:bg-[#0070E0] text-white shadow-md shadow-blue-500/25 transition-all active:scale-95 cursor-pointer"
        >
          <Plus size={15} strokeWidth={2.5} />
          <span>New Task</span>
          <kbd className="hidden sm:inline-block ml-1 text-[10px] font-mono bg-white/20 px-1.5 py-0.2 rounded">
            N
          </kbd>
        </button>
      </div>
    </header>
  );
};
