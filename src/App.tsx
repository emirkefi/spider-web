import React, { useState, useEffect, useMemo, useRef } from 'react';
import { ActiveView, AppNotification, NotificationType, Project, Task, TaskPriority, TaskStatus } from './types';
import { INITIAL_PROJECTS, INITIAL_TASKS } from './initialData';
import { Sidebar } from './components/Sidebar';
import { TopBar } from './components/TopBar';
import { KanbanBoard } from './components/KanbanBoard';
import { AnalyticsView } from './components/AnalyticsView';
import { FocusListView } from './components/FocusListView';
import {
  NewTaskModal,
  TaskDetailModal,
  NewProjectModal,
  DeleteProjectModal,
  KeybindsModal,
  CommandPaletteModal,
} from './components/Modals';
import { NotificationCenterModal } from './components/NotificationCenterModal';
import {
  sendDesktopNotification,
  requestSystemNotificationPermission,
} from './services/notificationService';
import { STATUS_CONFIG } from './utils';

const STORAGE_KEYS = {
  TASKS: 'spiderweb_tasks_v2',
  PROJECTS: 'spiderweb_projects_v2',
  THEME: 'spiderweb_theme_dark_v1',
  SIDEBAR_COLLAPSED: 'spiderweb_sidebar_collapsed_v1',
  NOTIFICATIONS: 'spiderweb_notifications_v1',
  NOTIFICATIONS_ENABLED: 'spiderweb_notifications_enabled_v1',
};

export function App() {
  const [isDark, setIsDark] = useState<boolean>(() => {
    const saved = localStorage.getItem(STORAGE_KEYS.THEME);
    return saved !== null ? JSON.parse(saved) : true;
  });

  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState<boolean>(() => {
    const saved = localStorage.getItem(STORAGE_KEYS.SIDEBAR_COLLAPSED);
    return saved !== null ? JSON.parse(saved) : false;
  });

  const [projects, setProjects] = useState<Project[]>(() => {
    const saved = localStorage.getItem(STORAGE_KEYS.PROJECTS);
    return saved ? JSON.parse(saved) : INITIAL_PROJECTS;
  });

  const [tasks, setTasks] = useState<Task[]>(() => {
    const saved = localStorage.getItem(STORAGE_KEYS.TASKS);
    return saved ? JSON.parse(saved) : INITIAL_TASKS;
  });

  const [activeView, setActiveView] = useState<ActiveView>('board');
  const [selectedProjectId, setSelectedProjectId] = useState<string | 'all'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [priorityFilter, setPriorityFilter] = useState<TaskPriority | 'all'>('all');

  // Modals state
  const [isNewTaskOpen, setIsNewTaskOpen] = useState(false);
  const [newTaskDefaultStatus, setNewTaskDefaultStatus] = useState<TaskStatus>('todo');
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [isNewProjectOpen, setIsNewProjectOpen] = useState(false);
  const [projectToDelete, setProjectToDelete] = useState<Project | null>(null);
  const [isKeybindsOpen, setIsKeybindsOpen] = useState(false);
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);

  // In-app & Desktop Notifications state
  const [notifications, setNotifications] = useState<AppNotification[]>(() => {
    const saved = localStorage.getItem(STORAGE_KEYS.NOTIFICATIONS);
    return saved ? JSON.parse(saved) : [];
  });
  const [hasSystemPermission, setHasSystemPermission] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    const saved = localStorage.getItem(STORAGE_KEYS.NOTIFICATIONS_ENABLED);
    if (saved !== null) {
      return JSON.parse(saved);
    }
    // Default to enabled in the native app
    const win = window as any;
    if (win.webkit?.messageHandlers?.systemNotification) {
      return true;
    }
    return 'Notification' in window && Notification.permission === 'granted';
  });

  // Track task deadlines already notified to prevent spamming notifications on every interval
  const notifiedDeadlinesRef = useRef<Set<string>>(new Set());

  // Sync to localStorage
  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.THEME, JSON.stringify(isDark));
    document.documentElement.classList.toggle('dark', isDark);
  }, [isDark]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.PROJECTS, JSON.stringify(projects));
  }, [projects]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.TASKS, JSON.stringify(tasks));
  }, [tasks]);

  useEffect(() => {
    localStorage.setItem(
      STORAGE_KEYS.SIDEBAR_COLLAPSED,
      JSON.stringify(isSidebarCollapsed)
    );
  }, [isSidebarCollapsed]);

  useEffect(() => {
    localStorage.setItem(
      STORAGE_KEYS.NOTIFICATIONS,
      JSON.stringify(notifications)
    );
  }, [notifications]);

  useEffect(() => {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      setHasSystemPermission(Notification.permission === 'granted');
    }
  }, []);

  // Helper to add in-app notification and dispatch desktop notification
  const addNotification = (
    type: NotificationType,
    title: string,
    message: string,
    taskId?: string,
    projectId?: string
  ) => {
    const newNotif: AppNotification = {
      id: `notif-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      type,
      title,
      message,
      createdAt: new Date().toISOString(),
      read: false,
      taskId,
      projectId,
    };
    setNotifications((prev) => [newNotif, ...prev]);
    if (hasSystemPermission) {
      sendDesktopNotification(title, message);
    }
  };

  // Periodic deadline checker (runs on mount and every 60s)
  useEffect(() => {
    const checkDeadlines = () => {
      const now = Date.now();
      tasks.forEach((task) => {
        if (task.status === 'done' || !task.dueDate) return;
        const dueTime = new Date(task.dueDate).getTime();
        const diffMs = dueTime - now;
        const diffHours = diffMs / (1000 * 60 * 60);

        if (diffMs < 0) {
          const key = `${task.id}-overdue`;
          if (!notifiedDeadlinesRef.current.has(key)) {
            notifiedDeadlinesRef.current.add(key);
            addNotification(
              'overdue',
              'Task Overdue',
              `"${task.title}" has passed its due deadline.`,
              task.id,
              task.projectId
            );
          }
        } else if (diffHours <= 6) {
          const key = `${task.id}-due-soon`;
          if (!notifiedDeadlinesRef.current.has(key)) {
            notifiedDeadlinesRef.current.add(key);
            const hoursRounded = Math.max(1, Math.round(diffHours));
            addNotification(
              'due_soon',
              'Task Due Soon',
              `"${task.title}" is due in approximately ${hoursRounded} hour${hoursRounded > 1 ? 's' : ''}.`,
              task.id,
              task.projectId
            );
          }
        }
      });
    };

    checkDeadlines();
    const interval = setInterval(checkDeadlines, 60000);
    return () => clearInterval(interval);
  }, [tasks]);

  // Global Hyprland-friendly keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      const isInputFocused =
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.tagName === 'SELECT';

      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setIsCommandPaletteOpen((prev) => !prev);
        return;
      }

      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'b') {
        e.preventDefault();
        setIsSidebarCollapsed((prev) => !prev);
        return;
      }

      if (e.altKey && e.key.toLowerCase() === 'n') {
        e.preventDefault();
        setIsNotificationsOpen((prev) => !prev);
        return;
      }

      if (e.key === 'Escape') {
        setIsNewTaskOpen(false);
        setSelectedTask(null);
        setIsNewProjectOpen(false);
        setProjectToDelete(null);
        setIsKeybindsOpen(false);
        setIsCommandPaletteOpen(false);
        setIsNotificationsOpen(false);
        return;
      }

      if (isInputFocused) return;

      if (e.key === '?') {
        e.preventDefault();
        setIsKeybindsOpen((prev) => !prev);
      } else if (e.key === '[') {
        e.preventDefault();
        setIsSidebarCollapsed((prev) => !prev);
      } else if (e.key.toLowerCase() === 'n') {
        e.preventDefault();
        setNewTaskDefaultStatus('todo');
        setIsNewTaskOpen(true);
      } else if (e.key.toLowerCase() === 'p') {
        e.preventDefault();
        setIsNewProjectOpen(true);
      } else if (e.key.toLowerCase() === 't') {
        e.preventDefault();
        setIsDark((prev) => !prev);
      } else if (e.altKey && e.key === '1') {
        e.preventDefault();
        setActiveView('board');
      } else if (e.altKey && e.key === '2') {
        e.preventDefault();
        setActiveView('up_next');
      } else if (e.altKey && e.key === '3') {
        e.preventDefault();
        setActiveView('my_tasks');
      } else if (e.altKey && e.key === '4') {
        e.preventDefault();
        setActiveView('analytics');
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Filtered tasks based on selected project, search query, and priority
  const filteredTasks = useMemo(() => {
    return tasks.filter((task) => {
      if (selectedProjectId !== 'all' && task.projectId !== selectedProjectId) {
        return false;
      }
      if (priorityFilter !== 'all' && task.priority !== priorityFilter) {
        return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchTitle = task.title.toLowerCase().includes(q);
        const matchDesc = task.description.toLowerCase().includes(q);
        const matchId = task.id.toLowerCase().includes(q);
        const matchBranch = task.branchName?.toLowerCase().includes(q);
        const matchPr = task.prUrl?.toLowerCase().includes(q);
        const matchTag = task.tags.some((t) => t.toLowerCase().includes(q));
        return matchTitle || matchDesc || matchId || matchBranch || matchPr || matchTag;
      }
      return true;
    });
  }, [tasks, selectedProjectId, priorityFilter, searchQuery]);

  const selectedProject = useMemo(
    () => projects.find((p) => p.id === selectedProjectId),
    [projects, selectedProjectId]
  );

  // Task handlers
  const handleMoveStatus = (taskId: string, newStatus: TaskStatus) => {
    const task = tasks.find((t) => t.id === taskId);
    if (task && task.status !== newStatus) {
      const statusLabel = STATUS_CONFIG[newStatus]?.label || newStatus;
      if (newStatus === 'done') {
        addNotification(
          'task_completed',
          'Task Completed',
          `"${task.title}" was marked as Done.`,
          task.id,
          task.projectId
        );
      } else if (newStatus === 'in_review') {
        addNotification(
          'task_moved',
          'Ready for Review',
          `"${task.title}" moved to Code Review.`,
          task.id,
          task.projectId
        );
      } else {
        addNotification(
          'task_moved',
          'Task Moved',
          `"${task.title}" moved to ${statusLabel}.`,
          task.id,
          task.projectId
        );
      }
    }
    setTasks((prev) =>
      prev.map((t) => (t.id === taskId ? { ...t, status: newStatus } : t))
    );
  };

  const handleToggleUpNext = (taskId: string) => {
    setTasks((prev) =>
      prev.map((t) => (t.id === taskId ? { ...t, upNext: !t.upNext } : t))
    );
  };

  const handleToggleSubtask = (taskId: string, subtaskId: string) => {
    setTasks((prev) =>
      prev.map((t) => {
        if (t.id !== taskId) return t;
        return {
          ...t,
          subtasks: t.subtasks.map((s) =>
            s.id === subtaskId ? { ...s, completed: !s.completed } : s
          ),
        };
      })
    );
  };

  const handleDeleteTask = (taskId: string) => {
    setTasks((prev) => prev.filter((t) => t.id !== taskId));
  };

  const handleUpdateTask = (updatedTask: Task) => {
    setTasks((prev) =>
      prev.map((t) => (t.id === updatedTask.id ? updatedTask : t))
    );
  };

  const handleCreateTask = (newTaskData: Omit<Task, 'id' | 'createdAt'>) => {
    const nextNum = tasks.length + 101;
    const newTask: Task = {
      ...newTaskData,
      id: `TSK-${nextNum}`,
      createdAt: new Date().toISOString(),
    };
    setTasks((prev) => [newTask, ...prev]);

    const proj = projects.find((p) => p.id === newTask.projectId);
    const projName = proj ? proj.name : 'Workspace';
    addNotification(
      'task_created',
      'New Task Created',
      `"${newTask.title}" added to ${projName}.`,
      newTask.id,
      newTask.projectId
    );
  };

  const handleCreateProject = (newProjData: Omit<Project, 'id'>) => {
    const newProj: Project = {
      ...newProjData,
      id: `proj-${Date.now()}`,
    };
    setProjects((prev) => [...prev, newProj]);
    setSelectedProjectId(newProj.id);
    addNotification(
      'project_created',
      'Project Created',
      `New project "${newProj.name}" created.`,
      undefined,
      newProj.id
    );
  };

  const handleRequestDeleteProject = (projectId: string) => {
    const proj = projects.find((p) => p.id === projectId);
    if (proj) {
      setProjectToDelete(proj);
    }
  };

  const handleConfirmDeleteProject = (projectId: string, deleteTasks: boolean) => {
    const remainingProjects = projects.filter((p) => p.id !== projectId);
    setProjects(remainingProjects);

    if (selectedProjectId === projectId) {
      setSelectedProjectId('all');
    }

    if (deleteTasks) {
      setTasks((prev) => prev.filter((t) => t.projectId !== projectId));
    } else {
      const fallbackProjectId = remainingProjects[0]?.id || 'unassigned';
      setTasks((prev) =>
        prev.map((t) =>
          t.projectId === projectId ? { ...t, projectId: fallbackProjectId } : t
        )
      );
    }
  };

  const handleOpenNewTaskWithStatus = (status: TaskStatus) => {
    setNewTaskDefaultStatus(status);
    setIsNewTaskOpen(true);
  };

  // Notification actions
  const unreadNotificationsCount = useMemo(
    () => notifications.filter((n) => !n.read).length,
    [notifications]
  );

  const handleMarkAllNotificationsRead = () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  };

  const handleClearAllNotifications = () => {
    setNotifications([]);
  };

  const handleNotificationClick = (notif: AppNotification) => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === notif.id ? { ...n, read: true } : n))
    );
    if (notif.taskId) {
      const found = tasks.find((t) => t.id === notif.taskId);
      if (found) {
        setSelectedTask(found);
      }
    }
    setIsNotificationsOpen(false);
  };

  const handleRequestSystemPermission = async () => {
    const granted = await requestSystemNotificationPermission();
    setHasSystemPermission(granted);
    localStorage.setItem(STORAGE_KEYS.NOTIFICATIONS_ENABLED, JSON.stringify(granted));
    if (granted) {
      addNotification(
        'task_created',
        'Desktop Notifications Enabled',
        'SpiderWeb will now notify you on task events and deadlines.'
      );
      sendDesktopNotification('SpiderWeb Alerts Active', 'Desktop push notifications are enabled.');
    }
  };

  const handleToggleSystemPermission = () => {
    const next = !hasSystemPermission;
    setHasSystemPermission(next);
    localStorage.setItem(STORAGE_KEYS.NOTIFICATIONS_ENABLED, JSON.stringify(next));
    if (next) {
      sendDesktopNotification('SpiderWeb Alerts Active', 'Desktop notifications unmuted.');
    }
  };

  const handleSendTestNotification = () => {
    sendDesktopNotification('SpiderWeb Test Alert', 'Desktop notifications are working on your PC.');
    addNotification('task_created', 'Test Notification', 'Desktop notifications are active and verified.');
  };

  return (
    <div
      className={`h-screen w-screen overflow-hidden flex transition-colors duration-300 ${
        isDark
          ? 'bg-[#0B0C10] text-zinc-100'
          : 'bg-[#F2F3F7] text-zinc-900'
      }`}
      style={{
        backgroundImage: isDark
          ? 'radial-gradient(circle at 15% 15%, rgba(10, 132, 255, 0.12), transparent 35%), radial-gradient(circle at 85% 20%, rgba(191, 90, 242, 0.10), transparent 35%), radial-gradient(circle at 50% 90%, rgba(48, 209, 88, 0.06), transparent 40%)'
          : 'radial-gradient(circle at 15% 15%, rgba(10, 132, 255, 0.08), transparent 40%), radial-gradient(circle at 85% 20%, rgba(191, 90, 242, 0.07), transparent 40%)',
      }}
    >
      {/* Left Sidebar for Quick Access & Projects */}
      <Sidebar
        isDark={isDark}
        isCollapsed={isSidebarCollapsed}
        setIsCollapsed={setIsSidebarCollapsed}
        activeView={activeView}
        setActiveView={setActiveView}
        projects={projects}
        selectedProjectId={selectedProjectId}
        setSelectedProjectId={setSelectedProjectId}
        tasks={tasks}
        onOpenNewProject={() => setIsNewProjectOpen(true)}
        onDeleteProject={handleRequestDeleteProject}
        onOpenCommandPalette={() => setIsCommandPaletteOpen(true)}
        onOpenKeybindsModal={() => setIsKeybindsOpen(true)}
        unreadNotificationsCount={unreadNotificationsCount}
        onOpenNotifications={() => setIsNotificationsOpen((prev) => !prev)}
      />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 h-full overflow-hidden">
        {/* Top Right Search, Light/Dark Mode, Project Count, Due Time & Create New Task */}
        <TopBar
          isDark={isDark}
          setIsDark={setIsDark}
          searchQuery={searchQuery}
          setSearchQuery={setSearchQuery}
          priorityFilter={priorityFilter}
          setPriorityFilter={setPriorityFilter}
          activeView={activeView}
          selectedProject={selectedProject}
          projectsCount={projects.length}
          tasks={filteredTasks}
          onOpenNewTask={() => handleOpenNewTaskWithStatus('todo')}
          onOpenNewProject={() => setIsNewProjectOpen(true)}
          onDeleteProject={handleRequestDeleteProject}
          onOpenKeybindsModal={() => setIsKeybindsOpen(true)}
          unreadNotificationsCount={unreadNotificationsCount}
          onOpenNotifications={() => setIsNotificationsOpen((prev) => !prev)}
        />

        {/* Workspace View Container */}
        <main className="flex-1 overflow-hidden">
          {activeView === 'board' && (
            <KanbanBoard
              tasks={filteredTasks}
              projects={projects}
              isDark={isDark}
              onSelectTask={(task) => setSelectedTask(task)}
              onMoveStatus={handleMoveStatus}
              onToggleUpNext={handleToggleUpNext}
              onToggleSubtask={handleToggleSubtask}
              onDeleteTask={handleDeleteTask}
              onOpenNewTaskWithStatus={handleOpenNewTaskWithStatus}
            />
          )}

          {activeView === 'up_next' && (
            <FocusListView
              mode="up_next"
              tasks={filteredTasks}
              projects={projects}
              isDark={isDark}
              onSelectTask={(task) => setSelectedTask(task)}
              onMoveStatus={handleMoveStatus}
              onToggleUpNext={handleToggleUpNext}
              onToggleSubtask={handleToggleSubtask}
            />
          )}

          {activeView === 'my_tasks' && (
            <FocusListView
              mode="my_tasks"
              tasks={filteredTasks}
              projects={projects}
              isDark={isDark}
              onSelectTask={(task) => setSelectedTask(task)}
              onMoveStatus={handleMoveStatus}
              onToggleUpNext={handleToggleUpNext}
              onToggleSubtask={handleToggleSubtask}
            />
          )}

          {activeView === 'analytics' && (
            <AnalyticsView
              tasks={filteredTasks}
              projects={projects}
              isDark={isDark}
            />
          )}
        </main>
      </div>

      {/* Modals */}
      <NewTaskModal
        isOpen={isNewTaskOpen}
        onClose={() => setIsNewTaskOpen(false)}
        projects={projects}
        defaultProjectId={selectedProjectId}
        defaultStatus={newTaskDefaultStatus}
        isDark={isDark}
        onCreateTask={handleCreateTask}
      />

      <TaskDetailModal
        task={selectedTask}
        projects={projects}
        isDark={isDark}
        onClose={() => setSelectedTask(null)}
        onUpdateTask={handleUpdateTask}
        onDeleteTask={handleDeleteTask}
      />

      <NewProjectModal
        isOpen={isNewProjectOpen}
        onClose={() => setIsNewProjectOpen(false)}
        isDark={isDark}
        projectsCount={projects.length}
        onCreateProject={handleCreateProject}
      />

      <DeleteProjectModal
        project={projectToDelete}
        taskCount={
          projectToDelete
            ? tasks.filter((t) => t.projectId === projectToDelete.id).length
            : 0
        }
        isDark={isDark}
        onClose={() => setProjectToDelete(null)}
        onConfirmDelete={handleConfirmDeleteProject}
      />

      <KeybindsModal
        isOpen={isKeybindsOpen}
        onClose={() => setIsKeybindsOpen(false)}
        isDark={isDark}
      />

      <CommandPaletteModal
        isOpen={isCommandPaletteOpen}
        onClose={() => setIsCommandPaletteOpen(false)}
        isDark={isDark}
        setIsDark={setIsDark}
        tasks={tasks}
        setActiveView={setActiveView}
        onSelectTask={(task) => setSelectedTask(task)}
        onMoveStatus={handleMoveStatus}
        onOpenNewTask={() => handleOpenNewTaskWithStatus('todo')}
        onOpenNewProject={() => setIsNewProjectOpen(true)}
        onOpenKeybindsModal={() => setIsKeybindsOpen(true)}
        onOpenNotifications={() => setIsNotificationsOpen(true)}
      />

      <NotificationCenterModal
        isOpen={isNotificationsOpen}
        onClose={() => setIsNotificationsOpen(false)}
        notifications={notifications}
        isDark={isDark}
        onMarkAllAsRead={handleMarkAllNotificationsRead}
        onClearAll={handleClearAllNotifications}
        onNotificationClick={handleNotificationClick}
        onRequestPermission={handleRequestSystemPermission}
        onToggleSystemPermission={handleToggleSystemPermission}
        onSendTestNotification={handleSendTestNotification}
        hasSystemPermission={hasSystemPermission}
      />
    </div>
  );
}
export default App;

