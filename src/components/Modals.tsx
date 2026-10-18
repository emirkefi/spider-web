import React, { useState, useEffect } from 'react';
import {
  X,
  Plus,
  Search,
  Sun,
  Moon,
  BarChart3,
  Keyboard,
  Terminal,
  Trash2,
  AlertTriangle,
  Copy,
  Check,
  Zap,
  LayoutGrid,
} from 'lucide-react';
import { ActiveView, Project, Task, TaskPriority, TaskStatus } from '../types';
import { STATUS_CONFIG } from '../utils';

interface NewTaskModalProps {
  isOpen: boolean;
  onClose: () => void;
  projects: Project[];
  defaultProjectId: string;
  defaultStatus: TaskStatus;
  isDark: boolean;
  onCreateTask: (task: Omit<Task, 'id' | 'createdAt'>) => void;
}

export const NewTaskModal: React.FC<NewTaskModalProps> = ({
  isOpen,
  onClose,
  projects,
  defaultProjectId,
  defaultStatus,
  isDark,
  onCreateTask,
}) => {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [status, setStatus] = useState<TaskStatus>(defaultStatus);
  const [priority, setPriority] = useState<TaskPriority>('high');
  const [projectId, setProjectId] = useState(defaultProjectId);
  const [dueHours, setDueHours] = useState('24');
  const [branchName, setBranchName] = useState('');
  const [prUrl, setPrUrl] = useState('');
  const [tagsInput, setTagsInput] = useState('hyprland, rust');
  const [estimateMinutes, setEstimateMinutes] = useState('60');
  const [upNext, setUpNext] = useState(true);
  const [assignedToMe, setAssignedToMe] = useState(true);
  const [subtasksText, setSubtasksText] = useState('');

  useEffect(() => {
    setStatus(defaultStatus);
    if (defaultProjectId !== 'all') {
      setProjectId(defaultProjectId);
    } else if (projects[0]) {
      setProjectId(projects[0].id);
    }
  }, [defaultStatus, defaultProjectId, projects, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    const hours = Number(dueHours) || 24;
    const dueDate = new Date(Date.now() + hours * 3600 * 1000).toISOString();

    const subtasks = subtasksText
      .split('\n')
      .map((s) => s.trim())
      .filter(Boolean)
      .map((s, idx) => ({
        id: `sub-${Date.now()}-${idx}`,
        title: s,
        completed: false,
      }));

    const tags = tagsInput
      .split(',')
      .map((t) => t.trim().replace(/^#/, ''))
      .filter(Boolean);

    onCreateTask({
      title: title.trim(),
      description: description.trim(),
      status,
      priority,
      projectId: projectId || projects[0]?.id || 'proj-hypr-core',
      dueDate,
      assignedToMe,
      upNext,
      tags,
      branchName: branchName.trim() || undefined,
      prUrl: prUrl.trim() || undefined,
      estimateMinutes: Number(estimateMinutes) || 45,
      subtasks,
    });

    setTitle('');
    setDescription('');
    setBranchName('');
    setPrUrl('');
    setSubtasksText('');
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-md">
      <div
        className={`w-full max-w-xl rounded-3xl border p-6 shadow-2xl transition-all ${
          isDark
            ? 'bg-zinc-900/95 border-white/15 text-zinc-100'
            : 'bg-white/95 border-black/10 text-zinc-900'
        }`}
      >
        <div className="flex items-center justify-between pb-4 border-b border-white/10">
          <div>
            <h2 className="text-base font-semibold tracking-tight">Create New Task</h2>
            <p className="text-xs opacity-55">
              Fast keyboard entry — assign stage, due time, and Git PR metadata
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl opacity-60 hover:opacity-100 hover:bg-white/10 transition cursor-pointer"
          >
            <X size={16} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          <div>
            <label className="block text-xs font-medium opacity-70 mb-1">Task Title *</label>
            <input
              autoFocus
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g., Implement zero-copy Wayland screencopy frame pipe"
              className={`w-full px-3.5 py-2 rounded-xl border text-sm outline-none ${
                isDark
                  ? 'bg-white/5 border-white/10 focus:border-blue-500'
                  : 'bg-zinc-50 border-black/10 focus:border-blue-500'
              }`}
            />
          </div>

          <div>
            <label className="block text-xs font-medium opacity-70 mb-1">Description</label>
            <textarea
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Technical context, notes, or acceptance criteria..."
              className={`w-full px-3.5 py-2 rounded-xl border text-xs outline-none ${
                isDark
                  ? 'bg-white/5 border-white/10 focus:border-blue-500'
                  : 'bg-zinc-50 border-black/10 focus:border-blue-500'
              }`}
            />
          </div>

          {/* Grid for Project, Stage, Priority, Due Time */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div>
              <label className="block text-[11px] font-medium opacity-65 mb-1">Project</label>
              <select
                value={projectId}
                onChange={(e) => setProjectId(e.target.value)}
                className={`w-full px-2.5 py-2 rounded-xl border text-xs outline-none ${
                  isDark
                    ? 'bg-zinc-800 border-white/10 text-zinc-100'
                    : 'bg-zinc-50 border-black/10 text-zinc-900'
                }`}
              >
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-medium opacity-65 mb-1">Kanban Stage</label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as TaskStatus)}
                className={`w-full px-2.5 py-2 rounded-xl border text-xs outline-none ${
                  isDark
                    ? 'bg-zinc-800 border-white/10 text-zinc-100'
                    : 'bg-zinc-50 border-black/10 text-zinc-900'
                }`}
              >
                <option value="todo">To Do</option>
                <option value="in_progress">In Progress (Doing)</option>
                <option value="in_review">In Review (Code)</option>
                <option value="done">Done</option>
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-medium opacity-65 mb-1">Priority</label>
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value as TaskPriority)}
                className={`w-full px-2.5 py-2 rounded-xl border text-xs outline-none ${
                  isDark
                    ? 'bg-zinc-800 border-white/10 text-zinc-100'
                    : 'bg-zinc-50 border-black/10 text-zinc-900'
                }`}
              >
                <option value="urgent">Urgent</option>
                <option value="high">High</option>
                <option value="medium">Medium</option>
                <option value="low">Low</option>
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-medium opacity-65 mb-1">Due In</label>
              <select
                value={dueHours}
                onChange={(e) => setDueHours(e.target.value)}
                className={`w-full px-2.5 py-2 rounded-xl border text-xs outline-none ${
                  isDark
                    ? 'bg-zinc-800 border-white/10 text-zinc-100'
                    : 'bg-zinc-50 border-black/10 text-zinc-900'
                }`}
              >
                <option value="2">2 Hours (Critical)</option>
                <option value="6">6 Hours (Today)</option>
                <option value="24">24 Hours (1 Day)</option>
                <option value="48">48 Hours (2 Days)</option>
                <option value="120">5 Days (Sprint)</option>
              </select>
            </div>
          </div>

          {/* Code Review Metadata: Git Branch & PR Number */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-[11px] font-medium opacity-65 mb-1">
                Git Branch (optional)
              </label>
              <input
                value={branchName}
                onChange={(e) => setBranchName(e.target.value)}
                placeholder="feat/hypr-ipc"
                className={`w-full px-3 py-1.5 rounded-xl border text-xs font-mono outline-none ${
                  isDark ? 'bg-white/5 border-white/10' : 'bg-zinc-50 border-black/10'
                }`}
              />
            </div>

            <div>
              <label className="block text-[11px] font-medium opacity-65 mb-1">
                PR / Code Review Link
              </label>
              <input
                value={prUrl}
                onChange={(e) => setPrUrl(e.target.value)}
                placeholder="PR #142"
                className={`w-full px-3 py-1.5 rounded-xl border text-xs font-mono outline-none ${
                  isDark ? 'bg-white/5 border-white/10' : 'bg-zinc-50 border-black/10'
                }`}
              />
            </div>

            <div>
              <label className="block text-[11px] font-medium opacity-65 mb-1">
                Tags (comma separated)
              </label>
              <input
                value={tagsInput}
                onChange={(e) => setTagsInput(e.target.value)}
                placeholder="rust, wayland, ui"
                className={`w-full px-3 py-1.5 rounded-xl border text-xs font-mono outline-none ${
                  isDark ? 'bg-white/5 border-white/10' : 'bg-zinc-50 border-black/10'
                }`}
              />
            </div>
          </div>

          {/* Subtasks */}
          <div>
            <label className="block text-[11px] font-medium opacity-65 mb-1">
              Subtasks Checklist (one per line)
            </label>
            <textarea
              rows={2}
              value={subtasksText}
              onChange={(e) => setSubtasksText(e.target.value)}
              placeholder={"Write unit tests\nVerify memory footprint under Hyprland"}
              className={`w-full px-3 py-1.5 rounded-xl border text-xs font-mono outline-none ${
                isDark ? 'bg-white/5 border-white/10' : 'bg-zinc-50 border-black/10'
              }`}
            />
          </div>

          {/* Toggles + Submit */}
          <div className="flex items-center justify-between pt-2">
            <div className="flex items-center gap-4 text-xs">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={upNext}
                  onChange={(e) => setUpNext(e.target.checked)}
                  className="rounded accent-blue-500"
                />
                <span>Pin to Up Next</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={assignedToMe}
                  onChange={(e) => setAssignedToMe(e.target.checked)}
                  className="rounded accent-blue-500"
                />
                <span>Assign to Me</span>
              </label>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-xl text-xs font-medium opacity-70 hover:opacity-100 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-2 rounded-xl text-xs font-semibold bg-[#0A84FF] hover:bg-[#0070E0] text-white shadow-md shadow-blue-500/25 cursor-pointer"
              >
                Create Task
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};

interface NewProjectModalProps {
  isOpen: boolean;
  onClose: () => void;
  isDark: boolean;
  projectsCount: number;
  onCreateProject: (proj: Omit<Project, 'id'>) => void;
}

const APPLE_COLORS = ['#0A84FF', '#BF5AF2', '#30D158', '#FF9F0A', '#FF375F', '#64D2FF'];

export const NewProjectModal: React.FC<NewProjectModalProps> = ({
  isOpen,
  onClose,
  isDark,
  projectsCount,
  onCreateProject,
}) => {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [color, setColor] = useState(APPLE_COLORS[0]);
  const [dueDays, setDueDays] = useState('7');

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    const dueDate = new Date(
      Date.now() + (Number(dueDays) || 7) * 24 * 3600 * 1000
    ).toISOString();

    onCreateProject({
      name: name.trim(),
      description: description.trim() || 'Hyprland development project',
      color,
      icon: 'Terminal',
      dueDate,
      workspaceId: projectsCount + 1,
    });
    setName('');
    setDescription('');
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-md">
      <div
        className={`w-full max-w-md rounded-3xl border p-6 shadow-2xl ${
          isDark
            ? 'bg-zinc-900/95 border-white/15 text-zinc-100'
            : 'bg-white/95 border-black/10 text-zinc-900'
        }`}
      >
        <div className="flex items-center justify-between pb-3 border-b border-white/10">
          <h2 className="text-base font-semibold">New Project</h2>
          <button onClick={onClose} className="p-1 opacity-60 hover:opacity-100 cursor-pointer">
            <X size={16} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          <div>
            <label className="block text-xs font-medium opacity-70 mb-1">Project Name *</label>
            <input
              autoFocus
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Waybar Custom Rust Module"
              className={`w-full px-3.5 py-2 rounded-xl border text-sm outline-none ${
                isDark ? 'bg-white/5 border-white/10' : 'bg-zinc-50 border-black/10'
              }`}
            />
          </div>

          <div>
            <label className="block text-xs font-medium opacity-70 mb-1">Description</label>
            <input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Short goal or repository scope"
              className={`w-full px-3.5 py-2 rounded-xl border text-xs outline-none ${
                isDark ? 'bg-white/5 border-white/10' : 'bg-zinc-50 border-black/10'
              }`}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium opacity-70 mb-1.5">Accent Color</label>
              <div className="flex items-center gap-2">
                {APPLE_COLORS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setColor(c)}
                    className={`w-6 h-6 rounded-full transition-transform cursor-pointer ${
                      color === c ? 'scale-125 ring-2 ring-white' : 'opacity-70'
                    }`}
                    style={{ backgroundColor: c }}
                  />
                ))}
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium opacity-70 mb-1">Target Due Date</label>
              <select
                value={dueDays}
                onChange={(e) => setDueDays(e.target.value)}
                className={`w-full px-3 py-2 rounded-xl border text-xs outline-none ${
                  isDark ? 'bg-zinc-800 border-white/10' : 'bg-zinc-50 border-black/10'
                }`}
              >
                <option value="3">In 3 Days</option>
                <option value="7">In 7 Days (1 Week)</option>
                <option value="14">In 14 Days (Sprint)</option>
                <option value="30">In 30 Days</option>
              </select>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs opacity-70 hover:opacity-100 cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 rounded-xl text-xs font-semibold bg-[#0A84FF] text-white cursor-pointer"
            >
              Create Project
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

interface DeleteProjectModalProps {
  project: Project | null;
  taskCount: number;
  isDark: boolean;
  onClose: () => void;
  onConfirmDelete: (projectId: string, deleteTasks: boolean) => void;
}

export const DeleteProjectModal: React.FC<DeleteProjectModalProps> = ({
  project,
  taskCount,
  isDark,
  onClose,
  onConfirmDelete,
}) => {
  const [deleteAssociatedTasks, setDeleteAssociatedTasks] = useState(true);

  if (!project) return null;

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-md"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className={`w-full max-w-md rounded-3xl border p-6 shadow-2xl ${
          isDark
            ? 'bg-zinc-900/95 border-white/15 text-zinc-100'
            : 'bg-white/95 border-black/10 text-zinc-900'
        }`}
      >
        <div className="flex items-start gap-3.5">
          <div className="w-10 h-10 rounded-2xl bg-rose-500/15 text-rose-500 flex items-center justify-center shrink-0">
            <AlertTriangle size={20} />
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="text-base font-semibold tracking-tight">
              Remove "{project.name}"?
            </h2>
            <p className="text-xs opacity-65 mt-1 leading-relaxed">
              This project currently has <span className="font-mono font-semibold">{taskCount}</span>{' '}
              associated {taskCount === 1 ? 'task' : 'tasks'}.
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg opacity-60 hover:opacity-100 cursor-pointer"
          >
            <X size={16} />
          </button>
        </div>

        {taskCount > 0 && (
          <div
            className={`mt-4 p-3 rounded-2xl border text-xs space-y-2 ${
              isDark ? 'bg-white/[0.04] border-white/10' : 'bg-zinc-50 border-black/[0.07]'
            }`}
          >
            <label className="flex items-center gap-2.5 cursor-pointer">
              <input
                type="radio"
                name="taskHandling"
                checked={deleteAssociatedTasks}
                onChange={() => setDeleteAssociatedTasks(true)}
                className="accent-rose-500"
              />
              <span>Delete project and all {taskCount} tasks inside it</span>
            </label>
            <label className="flex items-center gap-2.5 cursor-pointer">
              <input
                type="radio"
                name="taskHandling"
                checked={!deleteAssociatedTasks}
                onChange={() => setDeleteAssociatedTasks(false)}
                className="accent-blue-500"
              />
              <span>Keep tasks and move them to another project</span>
            </label>
          </div>
        )}

        <div className="flex justify-end gap-2 mt-5">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-medium opacity-70 hover:opacity-100 cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => {
              onConfirmDelete(project.id, deleteAssociatedTasks);
              onClose();
            }}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold bg-rose-500 hover:bg-rose-600 text-white shadow-md shadow-rose-500/25 cursor-pointer"
          >
            <Trash2 size={13} />
            <span>Remove Project</span>
          </button>
        </div>
      </div>
    </div>
  );
};

interface KeybindsModalProps {
  isOpen: boolean;
  onClose: () => void;
  isDark: boolean;
}

export const KeybindsModal: React.FC<KeybindsModalProps> = ({
  isOpen,
  onClose,
  isDark,
}) => {
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const hyprlandSnippet = `# SpiderWeb Quick Launch & Scratchpad in ~/.config/hypr/hyprland.conf
bind = $mainMod, K, exec, /home/umbra/Projects/Coding/spider-web/hyprland-launch.sh
bind = $mainMod, grave, togglespecialworkspace, spiderweb
workspace = special:spiderweb, on-created-empty:/home/umbra/Projects/Coding/spider-web/hyprland-launch.sh`;

  const handleCopy = () => {
    navigator.clipboard.writeText(hyprlandSnippet);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const appShortcuts = [
    { keys: ['Ctrl', 'K'], description: 'Open Spotlight Command Palette' },
    { keys: ['['], description: 'Hide / Show Sidebar (Icon-only Dock Mode)' },
    { keys: ['N'], description: 'Create a New Task in active project' },
    { keys: ['P'], description: 'Create a New Project' },
    { keys: ['/'], description: 'Focus Top-Right Search Bar' },
    { keys: ['T'], description: 'Toggle Apple Light / Dark Mode' },
    { keys: ['?'], description: 'Toggle this Keybinds Cheat Sheet' },
    { keys: ['Esc'], description: 'Close any open popup or modal' },
  ];

  const navigationShortcuts = [
    { keys: ['Alt', '1'], description: 'Switch to 4-Column Kanban Board' },
    { keys: ['Alt', '2'], description: 'Switch to Up Next Focus Queue' },
    { keys: ['Alt', '3'], description: 'Switch to My Assigned Tasks' },
    { keys: ['Alt', '4'], description: 'Switch to Velocity & Progress Charts' },
  ];

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-md"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className={`w-full max-w-2xl rounded-3xl border p-6 shadow-2xl transition-all ${
          isDark
            ? 'bg-zinc-900/95 border-white/15 text-zinc-100'
            : 'bg-white/95 border-black/10 text-zinc-900'
        }`}
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-white/10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-blue-500/15 text-blue-500 flex items-center justify-center">
              <Keyboard size={20} />
            </div>
            <div>
              <h2 className="text-base font-semibold tracking-tight">
                Keyboard Shortcuts & Hyprland Keybinds
              </h2>
              <p className="text-xs opacity-60">
                Designed for high-speed mouseless navigation on Hyprland Linux
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl opacity-60 hover:opacity-100 hover:bg-white/10 transition cursor-pointer"
          >
            <X size={16} />
          </button>
        </div>

        {/* Two Columns of App Shortcuts */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mt-5">
          {/* Column 1: Global Actions */}
          <div className="space-y-2.5">
            <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-blue-500">
              <Zap size={13} />
              <span>Quick Actions</span>
            </div>
            <div
              className={`rounded-2xl border divide-y ${
                isDark
                  ? 'bg-white/[0.03] border-white/[0.08] divide-white/[0.06]'
                  : 'bg-zinc-50/80 border-black/[0.07] divide-black/[0.06]'
              }`}
            >
              {appShortcuts.map((item) => (
                <div
                  key={item.description}
                  className="flex items-center justify-between px-3.5 py-2.5 text-xs"
                >
                  <span className="opacity-85">{item.description}</span>
                  <div className="flex items-center gap-1 shrink-0">
                    {item.keys.map((k) => (
                      <kbd
                        key={k}
                        className={`px-2 py-0.5 text-[11px] font-mono font-semibold rounded-lg border shadow-2xs ${
                          isDark
                            ? 'bg-zinc-800 border-white/15 text-zinc-200'
                            : 'bg-white border-black/15 text-zinc-800'
                        }`}
                      >
                        {k}
                      </kbd>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Column 2: View Navigation & Workflow */}
          <div className="space-y-4">
            <div className="space-y-2.5">
              <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-purple-500">
                <LayoutGrid size={13} />
                <span>View Switching</span>
              </div>
              <div
                className={`rounded-2xl border divide-y ${
                  isDark
                    ? 'bg-white/[0.03] border-white/[0.08] divide-white/[0.06]'
                    : 'bg-zinc-50/80 border-black/[0.07] divide-black/[0.06]'
                }`}
              >
                {navigationShortcuts.map((item) => (
                  <div
                    key={item.description}
                    className="flex items-center justify-between px-3.5 py-2.5 text-xs"
                  >
                    <span className="opacity-85">{item.description}</span>
                    <div className="flex items-center gap-1 shrink-0">
                      {item.keys.map((k) => (
                        <kbd
                          key={k}
                          className={`px-2 py-0.5 text-[11px] font-mono font-semibold rounded-lg border shadow-2xs ${
                            isDark
                              ? 'bg-zinc-800 border-white/15 text-zinc-200'
                              : 'bg-white border-black/15 text-zinc-800'
                          }`}
                        >
                          {k}
                        </kbd>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Project Management Tip */}
            <div
              className={`p-3.5 rounded-2xl border text-xs space-y-1 ${
                isDark
                  ? 'bg-emerald-500/10 border-emerald-500/25 text-emerald-200'
                  : 'bg-emerald-50 border-emerald-200 text-emerald-900'
              }`}
            >
              <div className="font-semibold flex items-center gap-1.5">
                <Trash2 size={13} className="text-emerald-500" />
                <span>Managing & Removing Projects</span>
              </div>
              <p className="text-[11px] opacity-80 leading-relaxed">
                Hover over any project in the left sidebar and click the trash icon, or select a project and click <strong>Remove Project</strong> in the top bar.
              </p>
            </div>
          </div>
        </div>

        {/* Bottom Hyprland Config Snippet */}
        <div className="mt-5 pt-4 border-t border-white/10">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold flex items-center gap-1.5 opacity-80">
              <Terminal size={13} className="text-blue-500" />
              Hyprland Compositor Keybinds (`~/.config/hypr/hyprland.conf`)
            </span>
            <button
              onClick={handleCopy}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-mono border transition cursor-pointer ${
                copied
                  ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-400'
                  : isDark
                  ? 'bg-white/5 border-white/10 hover:bg-white/10 text-zinc-300'
                  : 'bg-zinc-100 border-black/10 hover:bg-zinc-200 text-zinc-700'
              }`}
            >
              {copied ? <Check size={12} /> : <Copy size={12} />}
              <span>{copied ? 'Copied!' : 'Copy Config'}</span>
            </button>
          </div>
          <pre
            className={`p-3 rounded-2xl text-[11px] font-mono overflow-x-auto border ${
              isDark
                ? 'bg-black/40 border-white/10 text-blue-300'
                : 'bg-zinc-900 border-black/10 text-blue-200'
            }`}
          >
            {hyprlandSnippet}
          </pre>
        </div>
      </div>
    </div>
  );
};

interface CommandPaletteModalProps {
  isOpen: boolean;
  onClose: () => void;
  isDark: boolean;
  setIsDark: (v: boolean) => void;
  tasks: Task[];
  setActiveView: (v: ActiveView) => void;
  onMoveStatus: (taskId: string, newStatus: TaskStatus) => void;
  onOpenNewTask: () => void;
  onOpenNewProject: () => void;
  onOpenKeybindsModal: () => void;
}

export const CommandPaletteModal: React.FC<CommandPaletteModalProps> = ({
  isOpen,
  onClose,
  isDark,
  setIsDark,
  tasks,
  setActiveView,
  onMoveStatus,
  onOpenNewTask,
  onOpenNewProject,
  onOpenKeybindsModal,
}) => {
  const [query, setQuery] = useState('');

  if (!isOpen) return null;

  const matchedTasks = tasks
    .filter(
      (t) =>
        t.title.toLowerCase().includes(query.toLowerCase()) ||
        t.id.toLowerCase().includes(query.toLowerCase()) ||
        t.tags.some((tag) => tag.toLowerCase().includes(query.toLowerCase()))
    )
    .slice(0, 5);

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-start justify-center pt-24 p-4 bg-black/50 backdrop-blur-md"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className={`w-full max-w-lg rounded-3xl border overflow-hidden shadow-2xl ${
          isDark
            ? 'bg-zinc-900/95 border-white/15 text-zinc-100'
            : 'bg-white/95 border-black/10 text-zinc-900'
        }`}
      >
        <div className="flex items-center px-4 py-3 border-b border-white/10">
          <Search size={16} className="opacity-50 mr-3" />
          <input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Type a command or search task to move stage..."
            className="w-full text-sm bg-transparent outline-none"
          />
          <kbd className="text-[10px] font-mono opacity-50 px-1.5 py-0.5 rounded border border-current">
            ESC
          </kbd>
        </div>

        <div className="p-2 max-h-96 overflow-y-auto space-y-3">
          {/* Quick Actions */}
          <div className="space-y-1">
            <div className="px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider opacity-45">
              Quick Commands
            </div>
            <button
              onClick={() => {
                onClose();
                onOpenNewTask();
              }}
              className="w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs hover:bg-blue-500 hover:text-white transition cursor-pointer"
            >
              <span className="flex items-center gap-2">
                <Plus size={14} /> Create New Task
              </span>
              <span className="font-mono opacity-70">N</span>
            </button>
            <button
              onClick={() => {
                onClose();
                onOpenNewProject();
              }}
              className="w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs hover:bg-blue-500 hover:text-white transition cursor-pointer"
            >
              <span className="flex items-center gap-2">
                <Plus size={14} /> Create New Project
              </span>
              <span className="font-mono opacity-70">P</span>
            </button>
            <button
              onClick={() => {
                onClose();
                onOpenKeybindsModal();
              }}
              className="w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs hover:bg-blue-500 hover:text-white transition cursor-pointer"
            >
              <span className="flex items-center gap-2">
                <Keyboard size={14} /> Show Keyboard Shortcuts & Hyprland Keybinds
              </span>
              <span className="font-mono opacity-70">?</span>
            </button>
            <button
              onClick={() => {
                setIsDark(!isDark);
                onClose();
              }}
              className="w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs hover:bg-blue-500 hover:text-white transition cursor-pointer"
            >
              <span className="flex items-center gap-2">
                {isDark ? <Sun size={14} /> : <Moon size={14} />}
                Toggle {isDark ? 'Light' : 'Dark'} Appearance
              </span>
              <span className="font-mono opacity-70">T</span>
            </button>
            <button
              onClick={() => {
                setActiveView('analytics');
                onClose();
              }}
              className="w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs hover:bg-blue-500 hover:text-white transition cursor-pointer"
            >
              <span className="flex items-center gap-2">
                <BarChart3 size={14} /> View Velocity & Completion Charts
              </span>
              <span className="font-mono opacity-70">Alt+4</span>
            </button>
          </div>

          {/* Matched Tasks */}
          <div className="space-y-1">
            <div className="px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider opacity-45">
              Jump / Advance Task Stage
            </div>
            {matchedTasks.map((task) => (
              <div
                key={task.id}
                className="flex items-center justify-between px-3 py-2 rounded-xl text-xs hover:bg-white/5"
              >
                <div className="truncate pr-2">
                  <span className="font-mono opacity-50 mr-2">{task.id}</span>
                  <span className="font-medium">{task.title}</span>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  {(['todo', 'in_progress', 'in_review', 'done'] as TaskStatus[]).map((st) => (
                    <button
                      key={st}
                      onClick={() => {
                        onMoveStatus(task.id, st);
                        onClose();
                      }}
                      className={`px-2 py-0.5 rounded text-[10px] font-mono border transition cursor-pointer ${
                        task.status === st
                          ? 'bg-blue-500 text-white border-blue-500'
                          : 'opacity-60 hover:opacity-100 border-current/20'
                      }`}
                    >
                      {STATUS_CONFIG[st].label}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
