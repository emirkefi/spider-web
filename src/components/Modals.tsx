import React, { useState, useEffect, useRef } from 'react';
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
  ChevronDown,
  Clock,
  GitBranch,
  GitPullRequest,
  CheckCircle2,
  Flame,
  Pencil,
  Eye,
  Save,
} from 'lucide-react';
import { ActiveView, Project, Subtask, Task, TaskPriority, TaskStatus } from '../types';
import { getDueTimeMeta, PRIORITY_CONFIG, STATUS_CONFIG } from '../utils';

interface DropdownOption {
  value: string;
  label: string;
  dotColor?: string;
}

interface CustomSelectProps {
  value: string;
  onChange: (val: string) => void;
  options: DropdownOption[];
  isDark: boolean;
}

const CustomSelect: React.FC<CustomSelectProps> = ({
  value,
  onChange,
  options,
  isDark,
}) => {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const selectedOption = options.find((o) => o.value === value) || options[0];

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    };
    if (open) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [open]);

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className={`w-full px-2.5 py-2 rounded-xl border text-xs flex items-center justify-between gap-1.5 transition cursor-pointer outline-none ${
          isDark
            ? 'bg-zinc-800/90 border-white/12 text-zinc-100 hover:bg-zinc-700/90 focus:border-blue-500'
            : 'bg-zinc-50 border-black/10 text-zinc-900 hover:bg-zinc-100 focus:border-blue-500'
        }`}
      >
        <span className="flex items-center gap-1.5 truncate">
          {selectedOption?.dotColor && (
            <span
              className="w-2 h-2 rounded-full shrink-0"
              style={{ backgroundColor: selectedOption.dotColor }}
            />
          )}
          <span className="truncate">{selectedOption?.label}</span>
        </span>
        <ChevronDown
          size={13}
          className={`shrink-0 opacity-60 transition-transform duration-150 ${
            open ? 'rotate-180' : ''
          }`}
        />
      </button>

      {open && (
        <div
          className={`absolute left-0 right-0 mt-1.5 z-50 rounded-xl border p-1 shadow-xl max-h-52 overflow-y-auto backdrop-blur-2xl ${
            isDark
              ? 'bg-zinc-900 border-white/15 text-zinc-100 shadow-black/60'
              : 'bg-white border-black/10 text-zinc-900 shadow-black/15'
          }`}
        >
          {options.map((opt) => {
            const isSelected = opt.value === value;
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => {
                  onChange(opt.value);
                  setOpen(false);
                }}
                className={`w-full px-2.5 py-1.5 rounded-lg text-xs text-left flex items-center justify-between gap-2 transition cursor-pointer ${
                  isSelected
                    ? 'bg-[#0A84FF] text-white font-semibold'
                    : isDark
                    ? 'text-zinc-200 hover:bg-white/10'
                    : 'text-zinc-800 hover:bg-black/[0.06]'
                }`}
              >
                <span className="flex items-center gap-2 truncate">
                  {opt.dotColor && (
                    <span
                      className="w-2 h-2 rounded-full shrink-0"
                      style={{
                        backgroundColor: isSelected ? '#ffffff' : opt.dotColor,
                      }}
                    />
                  )}
                  <span className="truncate">{opt.label}</span>
                </span>
                {isSelected && <Check size={12} className="shrink-0" />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};

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
  const [estimateMinutes] = useState('60');
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
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-md"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className={`w-full max-w-xl rounded-3xl border p-6 shadow-2xl transition-all ${
          isDark
            ? 'bg-zinc-900/95 border-white/15 text-zinc-100'
            : 'bg-white/95 border-black/10 text-zinc-900'
        }`}
      >
        <div
          className={`flex items-center justify-between pb-4 border-b ${
            isDark ? 'border-white/10' : 'border-black/10'
          }`}
        >
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
                  ? 'bg-white/5 border-white/10 text-zinc-100 placeholder:text-zinc-500 focus:border-blue-500'
                  : 'bg-zinc-50 border-black/10 text-zinc-900 placeholder:text-zinc-400 focus:border-blue-500'
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
                  ? 'bg-white/5 border-white/10 text-zinc-100 placeholder:text-zinc-500 focus:border-blue-500'
                  : 'bg-zinc-50 border-black/10 text-zinc-900 placeholder:text-zinc-400 focus:border-blue-500'
              }`}
            />
          </div>

          {/* Grid for Project, Stage, Priority, Due Time using Custom Theme-Aware Dropdowns */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div>
              <label className="block text-[11px] font-medium opacity-65 mb-1">Project</label>
              <CustomSelect
                isDark={isDark}
                value={projectId}
                onChange={setProjectId}
                options={
                  projects.length > 0
                    ? projects.map((p) => ({
                        value: p.id,
                        label: p.name,
                        dotColor: p.color,
                      }))
                    : [{ value: 'unassigned', label: 'No Project', dotColor: '#8E8E93' }]
                }
              />
            </div>

            <div>
              <label className="block text-[11px] font-medium opacity-65 mb-1">Kanban Stage</label>
              <CustomSelect
                isDark={isDark}
                value={status}
                onChange={(val) => setStatus(val as TaskStatus)}
                options={[
                  { value: 'todo', label: 'To Do', dotColor: '#8E8E93' },
                  { value: 'in_progress', label: 'In Progress', dotColor: '#0A84FF' },
                  { value: 'in_review', label: 'In Review (Code)', dotColor: '#BF5AF2' },
                  { value: 'done', label: 'Done', dotColor: '#30D158' },
                ]}
              />
            </div>

            <div>
              <label className="block text-[11px] font-medium opacity-65 mb-1">Priority</label>
              <CustomSelect
                isDark={isDark}
                value={priority}
                onChange={(val) => setPriority(val as TaskPriority)}
                options={[
                  { value: 'urgent', label: 'Urgent', dotColor: '#FF453A' },
                  { value: 'high', label: 'High', dotColor: '#FF9F0A' },
                  { value: 'medium', label: 'Medium', dotColor: '#0A84FF' },
                  { value: 'low', label: 'Low', dotColor: '#8E8E93' },
                ]}
              />
            </div>

            <div>
              <label className="block text-[11px] font-medium opacity-65 mb-1">Due In</label>
              <CustomSelect
                isDark={isDark}
                value={dueHours}
                onChange={setDueHours}
                options={[
                  { value: '2', label: '2 Hours (Critical)' },
                  { value: '6', label: '6 Hours (Today)' },
                  { value: '24', label: '24 Hours (1 Day)' },
                  { value: '48', label: '48 Hours (2 Days)' },
                  { value: '120', label: '5 Days (Sprint)' },
                ]}
              />
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
                  isDark
                    ? 'bg-white/5 border-white/10 text-zinc-100 placeholder:text-zinc-500'
                    : 'bg-zinc-50 border-black/10 text-zinc-900 placeholder:text-zinc-400'
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
                  isDark
                    ? 'bg-white/5 border-white/10 text-zinc-100 placeholder:text-zinc-500'
                    : 'bg-zinc-50 border-black/10 text-zinc-900 placeholder:text-zinc-400'
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
                  isDark
                    ? 'bg-white/5 border-white/10 text-zinc-100 placeholder:text-zinc-500'
                    : 'bg-zinc-50 border-black/10 text-zinc-900 placeholder:text-zinc-400'
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
                isDark
                  ? 'bg-white/5 border-white/10 text-zinc-100 placeholder:text-zinc-500'
                  : 'bg-zinc-50 border-black/10 text-zinc-900 placeholder:text-zinc-400'
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

/* ============================================================================
   TASK DETAIL PREVIEW & EDIT MODAL
   ============================================================================ */
interface TaskDetailModalProps {
  task: Task | null;
  projects: Project[];
  isDark: boolean;
  onClose: () => void;
  onUpdateTask: (updatedTask: Task) => void;
  onDeleteTask: (taskId: string) => void;
}

export const TaskDetailModal: React.FC<TaskDetailModalProps> = ({
  task,
  projects,
  isDark,
  onClose,
  onUpdateTask,
  onDeleteTask,
}) => {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [status, setStatus] = useState<TaskStatus>('todo');
  const [priority, setPriority] = useState<TaskPriority>('high');
  const [projectId, setProjectId] = useState('');
  const [dueAction, setDueAction] = useState('keep');
  const [branchName, setBranchName] = useState('');
  const [prUrl, setPrUrl] = useState('');
  const [tagsInput, setTagsInput] = useState('');
  const [estimateMinutes, setEstimateMinutes] = useState('60');
  const [upNext, setUpNext] = useState(false);
  const [assignedToMe, setAssignedToMe] = useState(true);
  const [subtasks, setSubtasks] = useState<Subtask[]>([]);
  const [newSubtaskTitle, setNewSubtaskTitle] = useState('');

  useEffect(() => {
    if (task) {
      setTitle(task.title);
      setDescription(task.description);
      setStatus(task.status);
      setPriority(task.priority);
      setProjectId(task.projectId);
      setDueAction('keep');
      setBranchName(task.branchName || '');
      setPrUrl(task.prUrl || '');
      setTagsInput(task.tags.join(', '));
      setEstimateMinutes(String(task.estimateMinutes || 60));
      setUpNext(task.upNext);
      setAssignedToMe(task.assignedToMe);
      setSubtasks(task.subtasks || []);
      setNewSubtaskTitle('');
    }
  }, [task]);

  if (!task) return null;

  const currentDueMeta = getDueTimeMeta(task.dueDate, status);
  const project = projects.find((p) => p.id === projectId);

  const handleToggleLocalSubtask = (subId: string) => {
    setSubtasks((prev) =>
      prev.map((s) => (s.id === subId ? { ...s, completed: !s.completed } : s))
    );
  };

  const handleRemoveLocalSubtask = (subId: string) => {
    setSubtasks((prev) => prev.filter((s) => s.id !== subId));
  };

  const handleAddLocalSubtask = () => {
    if (!newSubtaskTitle.trim()) return;
    setSubtasks((prev) => [
      ...prev,
      {
        id: `sub-${Date.now()}-${prev.length}`,
        title: newSubtaskTitle.trim(),
        completed: false,
      },
    ]);
    setNewSubtaskTitle('');
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    let updatedDueDate = task.dueDate;
    if (dueAction !== 'keep') {
      const hours = Number(dueAction) || 24;
      updatedDueDate = new Date(Date.now() + hours * 3600 * 1000).toISOString();
    }

    const tags = tagsInput
      .split(',')
      .map((t) => t.trim().replace(/^#/, ''))
      .filter(Boolean);

    onUpdateTask({
      ...task,
      title: title.trim(),
      description: description.trim(),
      status,
      priority,
      projectId: projectId || task.projectId,
      dueDate: updatedDueDate,
      branchName: branchName.trim() || undefined,
      prUrl: prUrl.trim() || undefined,
      tags,
      estimateMinutes: Number(estimateMinutes) || 45,
      upNext,
      assignedToMe,
      subtasks,
    });

    onClose();
  };

  const completedSubtasks = subtasks.filter((s) => s.completed).length;

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/55 backdrop-blur-md"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className={`w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-3xl border p-6 shadow-2xl transition-all ${
          isDark
            ? 'bg-zinc-900/95 border-white/15 text-zinc-100'
            : 'bg-white/95 border-black/10 text-zinc-900'
        }`}
      >
        {/* Top Header: Task ID, Live Status Pills & Close */}
        <div
          className={`flex items-center justify-between pb-4 border-b ${
            isDark ? 'border-white/10' : 'border-black/10'
          }`}
        >
          <div className="flex items-center gap-2.5 flex-wrap">
            <span
              className={`font-mono text-xs font-bold px-2.5 py-1 rounded-xl border ${
                isDark
                  ? 'bg-white/[0.06] border-white/10 text-blue-400'
                  : 'bg-blue-50 border-blue-200 text-blue-600'
              }`}
            >
              {task.id}
            </span>

            {project && (
              <span
                className="text-xs font-semibold px-2.5 py-1 rounded-xl"
                style={{
                  backgroundColor: `${project.color}20`,
                  color: project.color,
                }}
              >
                {project.name}
              </span>
            )}

            <span
              className={`inline-flex items-center gap-1 text-xs font-mono font-medium px-2.5 py-1 rounded-xl ${
                currentDueMeta.urgencyLevel === 'overdue'
                  ? 'bg-rose-500/15 text-rose-500 border border-rose-500/30'
                  : currentDueMeta.urgencyLevel === 'critical'
                  ? 'bg-amber-500/15 text-amber-500 border border-amber-500/30'
                  : currentDueMeta.urgencyLevel === 'completed'
                  ? 'bg-emerald-500/15 text-emerald-500'
                  : isDark
                  ? 'bg-white/[0.06] text-zinc-300'
                  : 'bg-black/[0.05] text-zinc-700'
              }`}
            >
              <Clock size={12} />
              <span>{currentDueMeta.label}</span>
            </span>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => {
                onDeleteTask(task.id);
                onClose();
              }}
              title="Delete Task"
              className="p-2 rounded-xl text-rose-500 hover:bg-rose-500/15 transition cursor-pointer"
            >
              <Trash2 size={15} />
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-xl opacity-60 hover:opacity-100 hover:bg-white/10 transition cursor-pointer"
            >
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Form to Preview & Edit All Task Details */}
        <form onSubmit={handleSave} className="mt-4 space-y-4">
          {/* Task Title */}
          <div>
            <label className="block text-xs font-medium opacity-70 mb-1">
              Task Title
            </label>
            <input
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className={`w-full px-3.5 py-2.5 rounded-xl border text-sm font-semibold outline-none transition ${
                isDark
                  ? 'bg-white/5 border-white/10 text-zinc-100 focus:border-blue-500'
                  : 'bg-zinc-50 border-black/10 text-zinc-900 focus:border-blue-500'
              }`}
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-xs font-medium opacity-70 mb-1">
              Detailed Description & Notes
            </label>
            <textarea
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Add implementation details, architecture notes, or review links..."
              className={`w-full px-3.5 py-2 rounded-xl border text-xs leading-relaxed outline-none transition ${
                isDark
                  ? 'bg-white/5 border-white/10 text-zinc-100 placeholder:text-zinc-500 focus:border-blue-500'
                  : 'bg-zinc-50 border-black/10 text-zinc-900 placeholder:text-zinc-400 focus:border-blue-500'
              }`}
            />
          </div>

          {/* 4-Column Metadata Selector Row */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div>
              <label className="block text-[11px] font-medium opacity-65 mb-1">
                Project
              </label>
              <CustomSelect
                isDark={isDark}
                value={projectId}
                onChange={setProjectId}
                options={
                  projects.length > 0
                    ? projects.map((p) => ({
                        value: p.id,
                        label: p.name,
                        dotColor: p.color,
                      }))
                    : [{ value: 'unassigned', label: 'No Project', dotColor: '#8E8E93' }]
                }
              />
            </div>

            <div>
              <label className="block text-[11px] font-medium opacity-65 mb-1">
                Kanban Stage
              </label>
              <CustomSelect
                isDark={isDark}
                value={status}
                onChange={(val) => setStatus(val as TaskStatus)}
                options={[
                  { value: 'todo', label: 'To Do', dotColor: '#8E8E93' },
                  { value: 'in_progress', label: 'In Progress', dotColor: '#0A84FF' },
                  { value: 'in_review', label: 'In Review (Code)', dotColor: '#BF5AF2' },
                  { value: 'done', label: 'Done', dotColor: '#30D158' },
                ]}
              />
            </div>

            <div>
              <label className="block text-[11px] font-medium opacity-65 mb-1">
                Priority
              </label>
              <CustomSelect
                isDark={isDark}
                value={priority}
                onChange={(val) => setPriority(val as TaskPriority)}
                options={[
                  { value: 'urgent', label: 'Urgent', dotColor: '#FF453A' },
                  { value: 'high', label: 'High', dotColor: '#FF9F0A' },
                  { value: 'medium', label: 'Medium', dotColor: '#0A84FF' },
                  { value: 'low', label: 'Low', dotColor: '#8E8E93' },
                ]}
              />
            </div>

            <div>
              <label className="block text-[11px] font-medium opacity-65 mb-1">
                Due Time
              </label>
              <CustomSelect
                isDark={isDark}
                value={dueAction}
                onChange={setDueAction}
                options={[
                  { value: 'keep', label: `Keep (${currentDueMeta.shortLabel})` },
                  { value: '2', label: 'Reset: +2 Hours' },
                  { value: '6', label: 'Reset: +6 Hours' },
                  { value: '24', label: 'Reset: +24 Hours' },
                  { value: '48', label: 'Reset: +2 Days' },
                  { value: '120', label: 'Reset: +5 Days' },
                ]}
              />
            </div>
          </div>

          {/* Code Review Metadata: Git Branch, PR Link, Estimate, Tags */}
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
            <div>
              <label className="block text-[11px] font-medium opacity-65 mb-1">
                Git Branch
              </label>
              <input
                value={branchName}
                onChange={(e) => setBranchName(e.target.value)}
                placeholder="feat/branch-name"
                className={`w-full px-3 py-1.5 rounded-xl border text-xs font-mono outline-none ${
                  isDark
                    ? 'bg-white/5 border-white/10 text-zinc-100 placeholder:text-zinc-500'
                    : 'bg-zinc-50 border-black/10 text-zinc-900 placeholder:text-zinc-400'
                }`}
              />
            </div>

            <div>
              <label className="block text-[11px] font-medium opacity-65 mb-1">
                Pull Request / Code Review
              </label>
              <input
                value={prUrl}
                onChange={(e) => setPrUrl(e.target.value)}
                placeholder="PR #142"
                className={`w-full px-3 py-1.5 rounded-xl border text-xs font-mono outline-none ${
                  isDark
                    ? 'bg-white/5 border-white/10 text-zinc-100 placeholder:text-zinc-500'
                    : 'bg-zinc-50 border-black/10 text-zinc-900 placeholder:text-zinc-400'
                }`}
              />
            </div>

            <div>
              <label className="block text-[11px] font-medium opacity-65 mb-1">
                Estimate (Minutes)
              </label>
              <input
                type="number"
                min={5}
                step={5}
                value={estimateMinutes}
                onChange={(e) => setEstimateMinutes(e.target.value)}
                className={`w-full px-3 py-1.5 rounded-xl border text-xs font-mono outline-none ${
                  isDark
                    ? 'bg-white/5 border-white/10 text-zinc-100'
                    : 'bg-zinc-50 border-black/10 text-zinc-900'
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
                placeholder="wayland, rust, ipc"
                className={`w-full px-3 py-1.5 rounded-xl border text-xs font-mono outline-none ${
                  isDark
                    ? 'bg-white/5 border-white/10 text-zinc-100 placeholder:text-zinc-500'
                    : 'bg-zinc-50 border-black/10 text-zinc-900 placeholder:text-zinc-400'
                }`}
              />
            </div>
          </div>

          {/* Interactive Subtasks Manager */}
          <div
            className={`p-3.5 rounded-2xl border space-y-2.5 ${
              isDark
                ? 'bg-black/25 border-white/[0.08]'
                : 'bg-zinc-50/90 border-black/[0.07]'
            }`}
          >
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold">
                Subtasks Checklist ({completedSubtasks}/{subtasks.length})
              </span>
              {subtasks.length > 0 && (
                <span className="font-mono text-[11px] text-emerald-500">
                  {Math.round((completedSubtasks / subtasks.length) * 100)}% complete
                </span>
              )}
            </div>

            {subtasks.length > 0 && (
              <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1">
                {subtasks.map((sub) => (
                  <div
                    key={sub.id}
                    className={`flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-xl border text-xs ${
                      isDark
                        ? 'bg-white/[0.03] border-white/[0.06]'
                        : 'bg-white border-black/[0.05]'
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => handleToggleLocalSubtask(sub.id)}
                      className="flex items-center gap-2.5 text-left flex-1 min-w-0 cursor-pointer"
                    >
                      <span
                        className={`w-4 h-4 rounded flex items-center justify-center border shrink-0 transition ${
                          sub.completed
                            ? 'bg-emerald-500 border-emerald-500 text-white'
                            : isDark
                            ? 'border-zinc-600'
                            : 'border-zinc-300'
                        }`}
                      >
                        {sub.completed && <CheckCircle2 size={11} />}
                      </span>
                      <span
                        className={`truncate ${
                          sub.completed ? 'line-through opacity-45' : ''
                        }`}
                      >
                        {sub.title}
                      </span>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleRemoveLocalSubtask(sub.id)}
                      title="Remove subtask"
                      className="opacity-45 hover:opacity-100 hover:text-rose-500 p-0.5 cursor-pointer"
                    >
                      <X size={13} />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Add New Subtask Input */}
            <div className="flex items-center gap-2 pt-1">
              <input
                type="text"
                value={newSubtaskTitle}
                onChange={(e) => setNewSubtaskTitle(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleAddLocalSubtask();
                  }
                }}
                placeholder="Add a new checklist step and press Enter..."
                className={`flex-1 px-3 py-1.5 rounded-xl border text-xs outline-none ${
                  isDark
                    ? 'bg-white/5 border-white/10 text-zinc-100 placeholder:text-zinc-500'
                    : 'bg-white border-black/10 text-zinc-900 placeholder:text-zinc-400'
                }`}
              />
              <button
                type="button"
                onClick={handleAddLocalSubtask}
                className={`px-3 py-1.5 rounded-xl text-xs font-medium border transition cursor-pointer ${
                  isDark
                    ? 'bg-white/10 border-white/15 hover:bg-white/15 text-zinc-200'
                    : 'bg-zinc-200/70 border-black/10 hover:bg-zinc-200 text-zinc-800'
                }`}
              >
                + Add Step
              </button>
            </div>
          </div>

          {/* Bottom Toggles & Save Action */}
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
                <span>Assigned to Me</span>
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
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold bg-[#0A84FF] hover:bg-[#0070E0] text-white shadow-md shadow-blue-500/25 cursor-pointer"
              >
                <Save size={13} />
                <span>Save Changes</span>
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

const PROJECT_COLORS = ['#0A84FF', '#BF5AF2', '#30D158', '#FF9F0A', '#FF375F', '#64D2FF'];

export const NewProjectModal: React.FC<NewProjectModalProps> = ({
  isOpen,
  onClose,
  isDark,
  projectsCount,
  onCreateProject,
}) => {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [color, setColor] = useState(PROJECT_COLORS[0]);
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
        <div
          className={`flex items-center justify-between pb-3 border-b ${
            isDark ? 'border-white/10' : 'border-black/10'
          }`}
        >
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
                isDark
                  ? 'bg-white/5 border-white/10 text-zinc-100 placeholder:text-zinc-500'
                  : 'bg-zinc-50 border-black/10 text-zinc-900 placeholder:text-zinc-400'
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
                isDark
                  ? 'bg-white/5 border-white/10 text-zinc-100 placeholder:text-zinc-500'
                  : 'bg-zinc-50 border-black/10 text-zinc-900 placeholder:text-zinc-400'
              }`}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium opacity-70 mb-1.5">Accent Color</label>
              <div className="flex items-center gap-2 pt-1">
                {PROJECT_COLORS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setColor(c)}
                    className={`w-6 h-6 rounded-full transition-transform cursor-pointer ${
                      color === c ? 'scale-125 ring-2 ring-blue-400' : 'opacity-70'
                    }`}
                    style={{ backgroundColor: c }}
                  />
                ))}
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium opacity-70 mb-1">Target Due Date</label>
              <CustomSelect
                isDark={isDark}
                value={dueDays}
                onChange={setDueDays}
                options={[
                  { value: '3', label: 'In 3 Days' },
                  { value: '7', label: 'In 7 Days (1 Week)' },
                  { value: '14', label: 'In 14 Days (Sprint)' },
                  { value: '30', label: 'In 30 Days' },
                ]}
              />
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
    { keys: ['T'], description: 'Toggle Light / Dark Mode' },
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
        <div
          className={`flex items-center justify-between pb-4 border-b ${
            isDark ? 'border-white/10' : 'border-black/10'
          }`}
        >
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

            {/* Project & Task Editing Tip */}
            <div
              className={`p-3.5 rounded-2xl border text-xs space-y-1 ${
                isDark
                  ? 'bg-emerald-500/10 border-emerald-500/25 text-emerald-200'
                  : 'bg-emerald-50 border-emerald-200 text-emerald-900'
              }`}
            >
              <div className="font-semibold flex items-center gap-1.5">
                <Pencil size={13} className="text-emerald-500" />
                <span>Task Details & Project Removal</span>
              </div>
              <p className="text-[11px] opacity-80 leading-relaxed">
                Click any task card to open its full <strong>Preview & Edit Modal</strong>. Hover over any project in the sidebar to remove it.
              </p>
            </div>
          </div>
        </div>

        {/* Bottom Hyprland Config Snippet */}
        <div
          className={`mt-5 pt-4 border-t ${
            isDark ? 'border-white/10' : 'border-black/10'
          }`}
        >
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
  onSelectTask: (task: Task) => void;
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
  onSelectTask,
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
        <div
          className={`flex items-center px-4 py-3 border-b ${
            isDark ? 'border-white/10' : 'border-black/10'
          }`}
        >
          <Search size={16} className="opacity-50 mr-3" />
          <input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Type a command or click a task to inspect/edit..."
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
              Inspect / Edit or Move Task Stage
            </div>
            {matchedTasks.map((task) => (
              <div
                key={task.id}
                className={`flex items-center justify-between px-3 py-2 rounded-xl text-xs ${
                  isDark ? 'hover:bg-white/5' : 'hover:bg-black/5'
                }`}
              >
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onSelectTask(task);
                  }}
                  className="truncate pr-2 text-left flex-1 hover:text-blue-500 transition cursor-pointer"
                >
                  <span className="font-mono opacity-50 mr-2">{task.id}</span>
                  <span className="font-medium">{task.title}</span>
                </button>
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
