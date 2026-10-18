import React from 'react';
import {
  Clock,
  Flame,
  FolderPlus,
  GitPullRequest,
  Layers,
  LayoutGrid,
  BarChart3,
  Sparkles,
  Terminal,
  Cpu,
  Shield,
  UserCheck,
  CalendarClock,
  Command,
  Trash2,
  Keyboard,
  PanelLeftClose,
  PanelLeftOpen,
} from 'lucide-react';
import { ActiveView, Project, Task } from '../types';
import { getDueTimeMeta } from '../utils';
import { SpiderLogo } from './SpiderLogo';

interface SidebarProps {
  isDark: boolean;
  isCollapsed: boolean;
  setIsCollapsed: (v: boolean) => void;
  activeView: ActiveView;
  setActiveView: (v: ActiveView) => void;
  projects: Project[];
  selectedProjectId: string | 'all';
  setSelectedProjectId: (id: string | 'all') => void;
  tasks: Task[];
  onOpenNewProject: () => void;
  onDeleteProject: (projectId: string) => void;
  onOpenCommandPalette: () => void;
  onOpenKeybindsModal: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  isDark,
  isCollapsed,
  setIsCollapsed,
  activeView,
  setActiveView,
  projects,
  selectedProjectId,
  setSelectedProjectId,
  tasks,
  onOpenNewProject,
  onDeleteProject,
  onOpenCommandPalette,
  onOpenKeybindsModal,
}) => {
  const totalTasks = tasks.length;
  const doneTasks = tasks.filter((t) => t.status === 'done').length;
  const completionPct = totalTasks > 0 ? Math.round((doneTasks / totalTasks) * 100) : 0;

  const upNextCount = tasks.filter((t) => t.upNext && t.status !== 'done').length;
  const myTasksCount = tasks.filter((t) => t.assignedToMe && t.status !== 'done').length;
  const inReviewCount = tasks.filter((t) => t.status === 'in_review').length;

  const getProjectIcon = (iconName: string, color: string, size = 15) => {
    const props = { size, style: { color } };
    switch (iconName) {
      case 'Terminal':
        return <Terminal {...props} />;
      case 'Cpu':
        return <Cpu {...props} />;
      case 'Shield':
        return <Shield {...props} />;
      default:
        return <Layers {...props} />;
    }
  };

  // Next urgent task across workspace
  const nextUrgentTask = [...tasks]
    .filter((t) => t.status !== 'done')
    .sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime())[0];

  const nextDueMeta = nextUrgentTask
    ? getDueTimeMeta(nextUrgentTask.dueDate, nextUrgentTask.status)
    : null;

  /* ============================================================================
     COLLAPSED ICON-ONLY DOCK MODE (No scroll, pure icons + tooltips)
     ============================================================================ */
  if (isCollapsed) {
    return (
      <aside
        className={`w-[68px] shrink-0 h-full flex flex-col items-center justify-between py-3.5 px-2 border-r select-none transition-all duration-300 overflow-hidden ${
          isDark
            ? 'bg-zinc-900/80 border-white/10 text-zinc-100'
            : 'bg-white/80 border-black/[0.08] text-zinc-900'
        } backdrop-blur-2xl`}
      >
        {/* Top: Spider Logo + Expand Button + Quick Views */}
        <div className="flex flex-col items-center gap-3 w-full">
          <div className="flex flex-col items-center gap-2">
            <button
              onClick={() => setIsCollapsed(false)}
              title="Expand Sidebar ([)"
              className="group relative flex items-center justify-center cursor-pointer"
            >
              <SpiderLogo size={34} className="shadow-md rounded-xl transition-transform group-hover:scale-105" />
            </button>

            <button
              onClick={() => setIsCollapsed(false)}
              title="Expand Sidebar ([)"
              className={`p-1.5 rounded-xl border transition cursor-pointer ${
                isDark
                  ? 'bg-white/5 border-white/10 text-zinc-400 hover:text-white hover:bg-white/10'
                  : 'bg-black/[0.04] border-black/10 text-zinc-600 hover:text-zinc-900 hover:bg-black/10'
              }`}
            >
              <PanelLeftOpen size={15} />
            </button>
          </div>

          <div className={`w-8 h-[1px] ${isDark ? 'bg-white/10' : 'bg-black/10'}`} />

          {/* Quick Access Icons */}
          <div className="flex flex-col items-center gap-1.5 w-full">
            <button
              onClick={() => setActiveView('board')}
              title={`Kanban Board (${tasks.length} tasks) — Alt+1`}
              className={`relative w-10 h-10 rounded-2xl flex items-center justify-center transition-all cursor-pointer ${
                activeView === 'board'
                  ? 'bg-blue-500 text-white shadow-md shadow-blue-500/25'
                  : isDark
                  ? 'text-zinc-400 hover:bg-white/[0.08] hover:text-white'
                  : 'text-zinc-600 hover:bg-black/[0.06] hover:text-zinc-900'
              }`}
            >
              <LayoutGrid size={18} />
              {inReviewCount > 0 && (
                <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-purple-500 ring-2 ring-zinc-900" />
              )}
            </button>

            <button
              onClick={() => setActiveView('up_next')}
              title={`Up Next Queue (${upNextCount}) — Alt+2`}
              className={`relative w-10 h-10 rounded-2xl flex items-center justify-center transition-all cursor-pointer ${
                activeView === 'up_next'
                  ? 'bg-blue-500 text-white shadow-md shadow-blue-500/25'
                  : isDark
                  ? 'text-zinc-400 hover:bg-white/[0.08] hover:text-amber-400'
                  : 'text-zinc-600 hover:bg-black/[0.06] hover:text-amber-500'
              }`}
            >
              <Flame size={18} className={activeView === 'up_next' ? 'text-white' : 'text-amber-500'} />
              {upNextCount > 0 && (
                <span className="absolute -top-1 -right-1 text-[9px] font-mono font-bold px-1 rounded-full bg-amber-500 text-black">
                  {upNextCount}
                </span>
              )}
            </button>

            <button
              onClick={() => setActiveView('my_tasks')}
              title={`My Tasks (${myTasksCount}) — Alt+3`}
              className={`relative w-10 h-10 rounded-2xl flex items-center justify-center transition-all cursor-pointer ${
                activeView === 'my_tasks'
                  ? 'bg-blue-500 text-white shadow-md shadow-blue-500/25'
                  : isDark
                  ? 'text-zinc-400 hover:bg-white/[0.08] hover:text-emerald-400'
                  : 'text-zinc-600 hover:bg-black/[0.06] hover:text-emerald-600'
              }`}
            >
              <UserCheck size={18} className={activeView === 'my_tasks' ? 'text-white' : 'text-emerald-500'} />
            </button>

            <button
              onClick={() => setActiveView('analytics')}
              title={`Progress & Charts (${completionPct}% Done) — Alt+4`}
              className={`relative w-10 h-10 rounded-2xl flex items-center justify-center transition-all cursor-pointer ${
                activeView === 'analytics'
                  ? 'bg-blue-500 text-white shadow-md shadow-blue-500/25'
                  : isDark
                  ? 'text-zinc-400 hover:bg-white/[0.08] hover:text-purple-400'
                  : 'text-zinc-600 hover:bg-black/[0.06] hover:text-purple-600'
              }`}
            >
              <BarChart3 size={18} className={activeView === 'analytics' ? 'text-white' : 'text-purple-500'} />
            </button>
          </div>

          <div className={`w-8 h-[1px] ${isDark ? 'bg-white/10' : 'bg-black/10'}`} />

          {/* Project Icons List */}
          <div className="flex flex-col items-center gap-1.5 w-full">
            <button
              onClick={() => setSelectedProjectId('all')}
              title={`All Projects (${projects.length})`}
              className={`w-10 h-10 rounded-2xl flex items-center justify-center border transition-all cursor-pointer ${
                selectedProjectId === 'all'
                  ? isDark
                    ? 'bg-white/15 border-white/25 text-white shadow-sm'
                    : 'bg-black/10 border-black/20 text-zinc-900 shadow-sm'
                  : 'border-transparent opacity-60 hover:opacity-100'
              }`}
            >
              <Sparkles size={16} className="text-blue-500" />
            </button>

            {projects.slice(0, 6).map((project) => {
              const isSelected = selectedProjectId === project.id;
              const projDue = getDueTimeMeta(project.dueDate);
              return (
                <button
                  key={project.id}
                  onClick={() => setSelectedProjectId(project.id)}
                  title={`${project.name} (${projDue.label})`}
                  className={`relative w-10 h-10 rounded-2xl flex items-center justify-center border transition-all cursor-pointer ${
                    isSelected
                      ? isDark
                        ? 'bg-white/15 border-white/30 scale-105 shadow-md'
                        : 'bg-white border-black/20 scale-105 shadow-md'
                      : 'border-transparent opacity-75 hover:opacity-100 hover:scale-105'
                  }`}
                  style={{
                    backgroundColor: isSelected ? `${project.color}28` : `${project.color}14`,
                  }}
                >
                  {getProjectIcon(project.icon, project.color, 17)}
                  <span
                    className="absolute bottom-1 right-1 w-1.5 h-1.5 rounded-full"
                    style={{ backgroundColor: project.color }}
                  />
                </button>
              );
            })}

            <button
              onClick={onOpenNewProject}
              title="Create New Project (P)"
              className={`w-9 h-9 rounded-xl flex items-center justify-center border border-dashed transition cursor-pointer ${
                isDark
                  ? 'border-white/15 text-zinc-400 hover:text-blue-400 hover:border-blue-400/40'
                  : 'border-black/15 text-zinc-500 hover:text-blue-600 hover:border-blue-500/40'
              }`}
            >
              <FolderPlus size={15} />
            </button>
          </div>
        </div>

        {/* Bottom Dock Icons: Command Palette & Keybinds */}
        <div className="flex flex-col items-center gap-2">
          <button
            onClick={onOpenCommandPalette}
            title="Command Palette (Ctrl+K)"
            className={`w-10 h-10 rounded-2xl flex items-center justify-center border transition cursor-pointer ${
              isDark
                ? 'bg-white/5 border-white/10 text-zinc-300 hover:bg-white/10'
                : 'bg-black/[0.04] border-black/10 text-zinc-700 hover:bg-black/10'
            }`}
          >
            <Command size={16} />
          </button>
          <button
            onClick={onOpenKeybindsModal}
            title="Keyboard Shortcuts (?)"
            className={`w-10 h-10 rounded-2xl flex items-center justify-center border transition cursor-pointer ${
              isDark
                ? 'bg-white/5 border-white/10 text-blue-400 hover:bg-white/10'
                : 'bg-black/[0.04] border-black/10 text-blue-600 hover:bg-black/10'
            }`}
          >
            <Keyboard size={16} />
          </button>
        </div>
      </aside>
    );
  }

  /* ============================================================================
     EXPANDED FULL SIDEBAR MODE (Compact fit, zero scrollbar, collapsible)
     ============================================================================ */
  return (
    <aside
      className={`w-68 shrink-0 h-full flex flex-col justify-between border-r select-none transition-all duration-300 overflow-hidden ${
        isDark
          ? 'bg-zinc-900/75 border-white/10 text-zinc-100'
          : 'bg-white/75 border-black/[0.08] text-zinc-900'
      } backdrop-blur-2xl`}
    >
      {/* Top & Middle Content fit cleanly without scrolling */}
      <div className="p-3.5 space-y-3.5 flex-1 flex flex-col min-h-0 overflow-hidden">
        {/* Brand + Collapse Sidebar Button */}
        <div className="flex items-center justify-between px-1">
          <div className="flex items-center gap-2">
            <SpiderLogo size={28} className="shadow-sm rounded-lg" />
            <div>
              <div className="flex items-center gap-1.5">
                <span className="font-semibold tracking-tight text-sm">SpiderWeb</span>
                <span
                  className={`text-[9px] font-mono px-1.5 py-0.5 rounded font-semibold ${
                    isDark
                      ? 'bg-blue-500/20 text-blue-300 border border-blue-400/20'
                      : 'bg-blue-500/10 text-blue-600 border border-blue-500/20'
                  }`}
                >
                  HYPR
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-1">
            <button
              onClick={onOpenCommandPalette}
              title="Command Palette (Ctrl+K)"
              className={`flex items-center gap-0.5 text-[10px] font-mono px-1.5 py-1 rounded-lg border transition cursor-pointer ${
                isDark
                  ? 'bg-white/5 border-white/10 text-zinc-400 hover:text-zinc-200 hover:bg-white/10'
                  : 'bg-black/[0.04] border-black/10 text-zinc-600 hover:text-zinc-900 hover:bg-black/[0.08]'
              }`}
            >
              <Command size={11} />
              <span>K</span>
            </button>
            <button
              onClick={() => setIsCollapsed(true)}
              title="Collapse Sidebar to Icons ([)"
              className={`p-1.5 rounded-lg border transition cursor-pointer ${
                isDark
                  ? 'bg-white/5 border-white/10 text-zinc-400 hover:text-zinc-100 hover:bg-white/10'
                  : 'bg-black/[0.04] border-black/10 text-zinc-600 hover:text-zinc-900 hover:bg-black/[0.08]'
              }`}
            >
              <PanelLeftClose size={14} />
            </button>
          </div>
        </div>

        {/* Compact Active Projects & Due Countdown Card */}
        <div
          className={`p-2.5 rounded-2xl border transition-all shrink-0 ${
            isDark
              ? 'bg-gradient-to-br from-white/[0.06] to-white/[0.02] border-white/10 shadow-inner'
              : 'bg-gradient-to-br from-white/90 to-zinc-100/80 border-black/[0.07] shadow-2xs'
          }`}
        >
          <div className="flex items-center justify-between mb-1.5">
            <div className="flex items-center gap-1.5">
              <Layers size={12} className="text-blue-500" />
              <span className="text-[11px] font-medium opacity-80">Projects</span>
              <span className="text-[10px] font-bold font-mono px-1.5 py-0.2 rounded-full bg-blue-500/15 text-blue-500">
                {projects.length}
              </span>
            </div>
            <span className="text-[11px] font-mono font-semibold text-emerald-500">
              {doneTasks}/{totalTasks} ({completionPct}%)
            </span>
          </div>

          <div
            className={`w-full h-1.5 rounded-full overflow-hidden ${
              isDark ? 'bg-zinc-800' : 'bg-zinc-200'
            }`}
          >
            <div
              className="h-full rounded-full bg-gradient-to-r from-blue-500 via-purple-500 to-emerald-500 transition-all duration-500"
              style={{ width: `${completionPct}%` }}
            />
          </div>

          {nextUrgentTask && nextDueMeta && (
            <div
              className={`mt-2 pt-1.5 border-t flex items-center justify-between text-[10px] ${
                isDark ? 'border-white/10' : 'border-black/[0.06]'
              }`}
            >
              <div className="flex items-center gap-1 truncate pr-2">
                <CalendarClock
                  size={11}
                  className={
                    nextDueMeta.isOverdue
                      ? 'text-rose-500 shrink-0'
                      : nextDueMeta.isDueSoon
                      ? 'text-amber-500 shrink-0'
                      : 'text-blue-500 shrink-0'
                  }
                />
                <span className="truncate opacity-75">Next: {nextUrgentTask.id}</span>
              </div>
              <span
                className={`font-mono font-semibold shrink-0 px-1.5 py-0.2 rounded ${
                  nextDueMeta.isOverdue
                    ? 'bg-rose-500/15 text-rose-500'
                    : nextDueMeta.isDueSoon
                    ? 'bg-amber-500/15 text-amber-500'
                    : 'bg-blue-500/15 text-blue-500'
                }`}
              >
                {nextDueMeta.shortLabel}
              </span>
            </div>
          )}
        </div>

        {/* Quick Access Navigation */}
        <div className="space-y-0.5 shrink-0">
          <div className="px-2 pb-1 flex items-center justify-between">
            <span className="text-[10px] font-semibold uppercase tracking-wider opacity-45">
              Quick Access
            </span>
            <span className="text-[9px] font-mono opacity-40">Alt+1..4</span>
          </div>

          <button
            onClick={() => setActiveView('board')}
            className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-xl text-xs font-medium transition-all cursor-pointer ${
              activeView === 'board'
                ? 'bg-blue-500 text-white shadow-sm shadow-blue-500/25'
                : isDark
                ? 'text-zinc-300 hover:bg-white/[0.06]'
                : 'text-zinc-700 hover:bg-black/[0.05]'
            }`}
          >
            <div className="flex items-center gap-2">
              <LayoutGrid size={15} />
              <span>Kanban Board</span>
            </div>
            <div className="flex items-center gap-1">
              {inReviewCount > 0 && (
                <span
                  className={`text-[9px] font-mono px-1.5 py-0.2 rounded ${
                    activeView === 'board'
                      ? 'bg-white/20 text-white'
                      : 'bg-purple-500/15 text-purple-400'
                  }`}
                >
                  {inReviewCount} PR
                </span>
              )}
              <span className={`text-[11px] font-mono ${activeView === 'board' ? 'text-white/90' : 'opacity-50'}`}>
                {tasks.length}
              </span>
            </div>
          </button>

          <button
            onClick={() => setActiveView('up_next')}
            className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-xl text-xs font-medium transition-all cursor-pointer ${
              activeView === 'up_next'
                ? 'bg-blue-500 text-white shadow-sm shadow-blue-500/25'
                : isDark
                ? 'text-zinc-300 hover:bg-white/[0.06]'
                : 'text-zinc-700 hover:bg-black/[0.05]'
            }`}
          >
            <div className="flex items-center gap-2">
              <Flame size={15} className={activeView === 'up_next' ? 'text-white' : 'text-amber-500'} />
              <span>Up Next Queue</span>
            </div>
            <span
              className={`text-[11px] font-mono px-1.5 py-0.2 rounded ${
                activeView === 'up_next'
                  ? 'bg-white/20 text-white'
                  : 'bg-amber-500/15 text-amber-500 font-semibold'
              }`}
            >
              {upNextCount}
            </span>
          </button>

          <button
            onClick={() => setActiveView('my_tasks')}
            className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-xl text-xs font-medium transition-all cursor-pointer ${
              activeView === 'my_tasks'
                ? 'bg-blue-500 text-white shadow-sm shadow-blue-500/25'
                : isDark
                ? 'text-zinc-300 hover:bg-white/[0.06]'
                : 'text-zinc-700 hover:bg-black/[0.05]'
            }`}
          >
            <div className="flex items-center gap-2">
              <UserCheck size={15} className={activeView === 'my_tasks' ? 'text-white' : 'text-emerald-500'} />
              <span>My Tasks</span>
            </div>
            <span
              className={`text-[11px] font-mono px-1.5 py-0.2 rounded ${
                activeView === 'my_tasks'
                  ? 'bg-white/20 text-white'
                  : isDark
                  ? 'bg-white/10 text-zinc-300'
                  : 'bg-black/[0.06] text-zinc-700'
              }`}
            >
              {myTasksCount}
            </span>
          </button>

          <button
            onClick={() => setActiveView('analytics')}
            className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-xl text-xs font-medium transition-all cursor-pointer ${
              activeView === 'analytics'
                ? 'bg-blue-500 text-white shadow-sm shadow-blue-500/25'
                : isDark
                ? 'text-zinc-300 hover:bg-white/[0.06]'
                : 'text-zinc-700 hover:bg-black/[0.05]'
            }`}
          >
            <div className="flex items-center gap-2">
              <BarChart3 size={15} className={activeView === 'analytics' ? 'text-white' : 'text-purple-500'} />
              <span>Progress & Charts</span>
            </div>
            <span
              className={`text-[10px] font-mono px-1.5 py-0.2 rounded ${
                activeView === 'analytics'
                  ? 'bg-white/20 text-white'
                  : 'bg-emerald-500/15 text-emerald-500 font-semibold'
              }`}
            >
              {completionPct}%
            </span>
          </button>
        </div>

        {/* Projects List (Compact single-card rows so no scrollbar is needed) */}
        <div className="flex-1 flex flex-col min-h-0 space-y-1">
          <div className="px-2 flex items-center justify-between shrink-0">
            <span className="text-[10px] font-semibold uppercase tracking-wider opacity-45">
              Projects ({projects.length})
            </span>
            <button
              onClick={onOpenNewProject}
              className="flex items-center gap-1 text-[10px] font-medium text-blue-500 hover:text-blue-400 transition cursor-pointer"
            >
              <FolderPlus size={12} />
              <span>New</span>
            </button>
          </div>

          <button
            onClick={() => setSelectedProjectId('all')}
            className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-xl text-xs font-medium transition-all shrink-0 cursor-pointer ${
              selectedProjectId === 'all'
                ? isDark
                  ? 'bg-white/12 text-white border border-white/15'
                  : 'bg-black/[0.08] text-zinc-900 border border-black/10'
                : isDark
                ? 'text-zinc-400 hover:bg-white/[0.05] hover:text-zinc-200'
                : 'text-zinc-600 hover:bg-black/[0.04] hover:text-zinc-900'
            }`}
          >
            <div className="flex items-center gap-2">
              <Sparkles size={13} className="text-blue-500" />
              <span>All Projects</span>
            </div>
            <span className="font-mono text-[11px] opacity-60">{tasks.length}</span>
          </button>

          <div className="space-y-1 flex-1 overflow-hidden">
            {projects.map((project) => {
              const projTasks = tasks.filter((t) => t.projectId === project.id);
              const projDone = projTasks.filter((t) => t.status === 'done').length;
              const projDue = getDueTimeMeta(project.dueDate);
              const isSelected = selectedProjectId === project.id;

              return (
                <div
                  key={project.id}
                  onClick={() => setSelectedProjectId(project.id)}
                  className={`w-full group text-left px-2.5 py-1.5 rounded-xl transition-all border cursor-pointer ${
                    isSelected
                      ? isDark
                        ? 'bg-white/12 border-white/15 text-white shadow-2xs'
                        : 'bg-white border-black/10 text-zinc-900 shadow-2xs'
                      : isDark
                      ? 'border-transparent text-zinc-300 hover:bg-white/[0.05]'
                      : 'border-transparent text-zinc-700 hover:bg-black/[0.04]'
                  }`}
                >
                  <div className="flex items-center justify-between gap-1">
                    <div className="flex items-center gap-2 min-w-0">
                      <span
                        className="w-5 h-5 rounded-md flex items-center justify-center shrink-0"
                        style={{ backgroundColor: `${project.color}20` }}
                      >
                        {getProjectIcon(project.icon, project.color, 13)}
                      </span>
                      <span className="text-xs font-medium truncate">{project.name}</span>
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      <span
                        className={`text-[10px] font-mono ${
                          projDue.isOverdue
                            ? 'text-rose-400'
                            : projDue.isDueSoon
                            ? 'text-amber-400'
                            : 'opacity-50'
                        }`}
                        title={projDue.label}
                      >
                        {projDue.shortLabel}
                      </span>
                      <span className="text-[10px] font-mono opacity-40">•</span>
                      <span className="text-[10px] font-mono opacity-70">
                        {projDone}/{projTasks.length}
                      </span>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onDeleteProject(project.id);
                        }}
                        title={`Remove project "${project.name}"`}
                        className="opacity-0 group-hover:opacity-100 p-0.5 rounded hover:bg-rose-500/20 hover:text-rose-500 transition cursor-pointer"
                      >
                        <Trash2 size={11} />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Bottom Compact Footer */}
      <div
        className={`px-3.5 py-2.5 border-t text-[11px] flex items-center justify-between gap-2 shrink-0 ${
          isDark ? 'border-white/10 bg-black/20' : 'border-black/[0.07] bg-zinc-50/70'
        }`}
      >
        <button
          onClick={onOpenKeybindsModal}
          className={`flex-1 flex items-center justify-between px-2.5 py-1.5 rounded-xl border text-[11px] font-medium transition cursor-pointer ${
            isDark
              ? 'border-white/10 bg-white/5 hover:bg-white/10 text-zinc-300'
              : 'border-black/10 bg-white hover:bg-zinc-100 text-zinc-700 shadow-2xs'
          }`}
        >
          <span className="flex items-center gap-1.5">
            <Keyboard size={13} className="text-blue-500" />
            <span>Keybinds</span>
          </span>
          <kbd className="font-mono text-[10px] px-1.5 py-0.2 rounded bg-blue-500/15 text-blue-500">
            ?
          </kbd>
        </button>

        <button
          onClick={() => setIsCollapsed(true)}
          title="Hide Sidebar to Icons ([)"
          className={`px-2.5 py-1.5 rounded-xl border text-[11px] font-mono transition cursor-pointer ${
            isDark
              ? 'border-white/10 bg-white/5 hover:bg-white/10 text-zinc-400 hover:text-white'
              : 'border-black/10 bg-white hover:bg-zinc-100 text-zinc-600'
          }`}
        >
          [
        </button>
      </div>
    </aside>
  );
};
