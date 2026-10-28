import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  ActiveView,
  AppNotification,
  Group,
  NotificationType,
  Project,
  Role,
  Task,
  TaskPriority,
  TaskStatus,
  User,
} from './types';
import { INITIAL_PROJECTS, INITIAL_TASKS } from './initialData';
import { INITIAL_USERS, INITIAL_GROUPS, INITIAL_ROLES } from './rbac/rbacData';
import { hasPermission } from './rbac/rbacUtils';
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
import { TeamManagementModal } from './components/TeamManagementModal';
import { P2PNetworkModal, P2PLogEntry } from './components/P2PNetworkModal';
import {
  sendDesktopNotification,
  requestSystemNotificationPermission,
} from './services/notificationService';
import {
  BoardSnapshot,
  NodeStatusReport,
  broadcastBoardOp,
  getNodeStatus,
  reconcileBoardSnapshot,
  subscribeP2PEvents,
} from './services/p2pService';
import { STATUS_CONFIG } from './utils';

const STORAGE_KEYS = {
  TASKS: 'spiderweb_tasks_v2',
  PROJECTS: 'spiderweb_projects_v2',
  THEME: 'spiderweb_theme_dark_v1',
  SIDEBAR_COLLAPSED: 'spiderweb_sidebar_collapsed_v1',
  NOTIFICATIONS: 'spiderweb_notifications_v1',
  NOTIFICATIONS_ENABLED: 'spiderweb_notifications_enabled_v1',
  USERS: 'spiderweb_users_v1',
  GROUPS: 'spiderweb_groups_v1',
  ROLES: 'spiderweb_roles_v1',
  CURRENT_USER: 'spiderweb_current_user_v1',
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
  const [isTeamModalOpen, setIsTeamModalOpen] = useState(false);
  const [isP2PModalOpen, setIsP2PModalOpen] = useState(false);

  // iroh P2P Engine state
  const [isP2PCoreOnline, setIsP2PCoreOnline] = useState(false);
  const [p2pNodeStatus, setP2PNodeStatus] = useState<NodeStatusReport | null>(null);
  const [p2pLogs, setP2PLogs] = useState<P2PLogEntry[]>([]);

  // RBAC: Users, Teams / Groups, Roles & Permissions
  const [users, setUsers] = useState<User[]>(() => {
    const saved = localStorage.getItem(STORAGE_KEYS.USERS);
    return saved ? JSON.parse(saved) : INITIAL_USERS;
  });

  const [groups, setGroups] = useState<Group[]>(() => {
    const saved = localStorage.getItem(STORAGE_KEYS.GROUPS);
    return saved ? JSON.parse(saved) : INITIAL_GROUPS;
  });

  const [roles, setRoles] = useState<Role[]>(() => {
    const saved = localStorage.getItem(STORAGE_KEYS.ROLES);
    return saved ? JSON.parse(saved) : INITIAL_ROLES;
  });

  const [currentUserId, setCurrentUserId] = useState<string>(() => {
    const saved = localStorage.getItem(STORAGE_KEYS.CURRENT_USER);
    return saved ? JSON.parse(saved) : INITIAL_USERS[0]?.id || 'user-admin';
  });

  const currentUser = useMemo(
    () => users.find((u) => u.id === currentUserId) || users[0],
    [users, currentUserId]
  );

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
    localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(users));
  }, [users]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.GROUPS, JSON.stringify(groups));
  }, [groups]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.ROLES, JSON.stringify(roles));
  }, [roles]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.CURRENT_USER, JSON.stringify(currentUserId));
  }, [currentUserId]);

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

  const appendP2PLog = (
    type: P2PLogEntry['type'],
    title: string,
    detail: string
  ) => {
    const entry: P2PLogEntry = {
      id: `p2p-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      timestamp: new Date().toLocaleTimeString(),
      type,
      title,
      detail,
    };
    setP2PLogs((prev) => [entry, ...prev.slice(0, 99)]);
  };

  const applyRemoteSnapshot = (snapshot: BoardSnapshot) => {
    if (!snapshot) return;
    if (Array.isArray(snapshot.tasks) && snapshot.tasks.length > 0) {
      setTasks(snapshot.tasks);
    }
    if (Array.isArray(snapshot.projects) && snapshot.projects.length > 0) {
      setProjects(snapshot.projects);
    }
    if (Array.isArray(snapshot.users) && snapshot.users.length > 0) {
      setUsers(snapshot.users);
    }
    if (Array.isArray(snapshot.groups) && snapshot.groups.length > 0) {
      setGroups(snapshot.groups);
    }
    if (Array.isArray(snapshot.roles) && snapshot.roles.length > 0) {
      setRoles(snapshot.roles);
    }
  };

  const refreshP2PStatus = async () => {
    try {
      const status = await getNodeStatus('workspace');
      setP2PNodeStatus(status);
      setIsP2PCoreOnline(true);
    } catch {
      setIsP2PCoreOnline(false);
    }
  };

  // Connect to the Rust iroh P2P Core on mount and subscribe to live Gossip & ALPN events
  useEffect(() => {
    let initialSynced = false;

    const syncInitial = async () => {
      try {
        const status = await getNodeStatus('workspace');
        setP2PNodeStatus(status);
        setIsP2PCoreOnline(true);
        if (!initialSynced) {
          initialSynced = true;
          const reconciled = await reconcileBoardSnapshot({
            boardId: 'workspace',
            tasks,
            projects,
            users,
            groups,
            roles,
          });
          applyRemoteSnapshot(reconciled);
          appendP2PLog(
            'info',
            'iroh Endpoint Ready',
            `NodeId: ${status.nodeId} | Relays: N0 Preset | Local mDNS: ${status.localDiscoveryEnabled}`
          );
        }
      } catch {
        setIsP2PCoreOnline(false);
      }
    };

    syncInitial();

    const unsubscribe = subscribeP2PEvents(
      (envelope) => {
        const { event, payload } = envelope;
        if (event === 'network://connected') {
          syncInitial();
        } else if (event === 'board://state-synced') {
          if (payload?.snapshot) {
            applyRemoteSnapshot(payload.snapshot);
          }
          appendP2PLog(
            'alpn_sync',
            'Custom ALPN Catch-Up Sync (/spiderweb/sync/1.0)',
            `Peer ${payload?.remotePeerId?.slice(0, 10) || 'remote'} synced (${payload?.updatedCount ?? 0} new CRDT record(s))`
          );
          refreshP2PStatus();
        } else if (event === 'board://remote-op') {
          if (payload?.snapshot) {
            applyRemoteSnapshot(payload.snapshot);
          }
          const rec = payload?.op?.record;
          appendP2PLog(
            'gossip',
            `iroh-gossip Live Op (${rec?.kind || 'entity'}:${rec?.id || ''})`,
            `Delivered from ${payload?.deliveredFrom?.slice(0, 10)} • Clock v${rec?.clock}`
          );
          refreshP2PStatus();
        } else if (event === 'network://peer-event') {
          appendP2PLog(
            'peer',
            `Peer Event: ${payload?.type || 'update'}`,
            JSON.stringify(payload)
          );
          refreshP2PStatus();
        }
      },
      (online) => {
        setIsP2PCoreOnline(online);
        if (online) {
          syncInitial();
        }
      }
    );

    const statusInterval = setInterval(refreshP2PStatus, 8000);
    return () => {
      unsubscribe();
      clearInterval(statusInterval);
    };
  }, []);

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

      if (e.altKey && e.key.toLowerCase() === 'u') {
        e.preventDefault();
        setIsTeamModalOpen((prev) => !prev);
        return;
      }

      if (e.altKey && e.key.toLowerCase() === 's') {
        e.preventDefault();
        setIsP2PModalOpen((prev) => !prev);
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
        setIsTeamModalOpen(false);
        setIsP2PModalOpen(false);
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
      const updated = { ...task, status: newStatus };
      broadcastBoardOp({
        boardId: 'workspace',
        kind: 'task',
        id: taskId,
        data: updated,
      }).catch(() => {});

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
      prev.map((t) => {
        if (t.id !== taskId) return t;
        const updated = { ...t, upNext: !t.upNext };
        broadcastBoardOp({
          boardId: 'workspace',
          kind: 'task',
          id: taskId,
          data: updated,
        }).catch(() => {});
        return updated;
      })
    );
  };

  const handleToggleSubtask = (taskId: string, subtaskId: string) => {
    setTasks((prev) =>
      prev.map((t) => {
        if (t.id !== taskId) return t;
        const updated = {
          ...t,
          subtasks: t.subtasks.map((s) =>
            s.id === subtaskId ? { ...s, completed: !s.completed } : s
          ),
        };
        broadcastBoardOp({
          boardId: 'workspace',
          kind: 'task',
          id: taskId,
          data: updated,
        }).catch(() => {});
        return updated;
      })
    );
  };

  const handleDeleteTask = (taskId: string) => {
    if (currentUser && !hasPermission(currentUser, 'tasks:delete', roles)) {
      addNotification(
        'overdue',
        'Permission Denied',
        'Your active role cannot delete tasks.'
      );
      return;
    }
    setTasks((prev) => prev.filter((t) => t.id !== taskId));
    broadcastBoardOp({
      boardId: 'workspace',
      kind: 'task',
      id: taskId,
      deleted: true,
    }).catch(() => {});
  };

  const handleUpdateTask = (updatedTask: Task) => {
    if (currentUser && !hasPermission(currentUser, 'tasks:edit', roles)) {
      addNotification(
        'overdue',
        'Permission Denied',
        'Your active role cannot edit tasks.'
      );
      return;
    }
    setTasks((prev) =>
      prev.map((t) => (t.id === updatedTask.id ? updatedTask : t))
    );
    broadcastBoardOp({
      boardId: 'workspace',
      kind: 'task',
      id: updatedTask.id,
      data: updatedTask,
    }).catch(() => {});
  };

  const handleCreateTask = (newTaskData: Omit<Task, 'id' | 'createdAt'>) => {
    if (currentUser && !hasPermission(currentUser, 'tasks:create', roles)) {
      addNotification(
        'overdue',
        'Permission Denied',
        'Your active role cannot create tasks.'
      );
      return;
    }
    const nextNum = tasks.length + 101;
    const newTask: Task = {
      ...newTaskData,
      id: `TSK-${nextNum}`,
      createdAt: new Date().toISOString(),
    };
    setTasks((prev) => [newTask, ...prev]);
    broadcastBoardOp({
      boardId: 'workspace',
      kind: 'task',
      id: newTask.id,
      data: newTask,
    }).catch(() => {});

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

  const handleOpenNewProject = () => {
    if (currentUser && !hasPermission(currentUser, 'projects:create', roles)) {
      addNotification(
        'overdue',
        'Permission Denied',
        'Your active role cannot create projects.'
      );
      return;
    }
    setIsNewProjectOpen(true);
  };

  const handleCreateProject = (newProjData: Omit<Project, 'id'>) => {
    if (currentUser && !hasPermission(currentUser, 'projects:create', roles)) {
      addNotification(
        'overdue',
        'Permission Denied',
        'Your active role cannot create projects.'
      );
      return;
    }
    const newProj: Project = {
      ...newProjData,
      id: `proj-${Date.now()}`,
    };
    setProjects((prev) => [...prev, newProj]);
    setSelectedProjectId(newProj.id);
    broadcastBoardOp({
      boardId: 'workspace',
      kind: 'project',
      id: newProj.id,
      data: newProj,
    }).catch(() => {});

    addNotification(
      'project_created',
      'Project Created',
      `New project "${newProj.name}" created.`,
      undefined,
      newProj.id
    );
  };

  const handleRequestDeleteProject = (projectId: string) => {
    if (currentUser && !hasPermission(currentUser, 'projects:delete', roles)) {
      addNotification(
        'overdue',
        'Permission Denied',
        'Your active role cannot delete projects.'
      );
      return;
    }
    const proj = projects.find((p) => p.id === projectId);
    if (proj) {
      setProjectToDelete(proj);
    }
  };

  const handleConfirmDeleteProject = (projectId: string, deleteTasks: boolean) => {
    const remainingProjects = projects.filter((p) => p.id !== projectId);
    setProjects(remainingProjects);
    broadcastBoardOp({
      boardId: 'workspace',
      kind: 'project',
      id: projectId,
      deleted: true,
    }).catch(() => {});

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
    if (currentUser && !hasPermission(currentUser, 'tasks:create', roles)) {
      addNotification(
        'overdue',
        'Permission Denied',
        'Your active role cannot create tasks.'
      );
      return;
    }
    setNewTaskDefaultStatus(status);
    setIsNewTaskOpen(true);
  };

  // RBAC CRUD Handlers
  const handleCreateUser = (userData: Omit<User, 'id' | 'createdAt'>) => {
    const newUser: User = {
      ...userData,
      id: `user-${Date.now()}`,
      createdAt: new Date().toISOString(),
    };
    setUsers((prev) => [...prev, newUser]);
    addNotification(
      'task_created',
      'Team Member Added',
      `${newUser.name} joined the workspace.`
    );
  };

  const handleUpdateUser = (updatedUser: User) => {
    setUsers((prev) => prev.map((u) => (u.id === updatedUser.id ? updatedUser : u)));
  };

  const handleDeleteUser = (userId: string) => {
    if (users.length <= 1) return;
    setUsers((prev) => prev.filter((u) => u.id !== userId));
    if (currentUserId === userId) {
      const fallback = users.find((u) => u.id !== userId);
      if (fallback) setCurrentUserId(fallback.id);
    }
  };

  const handleSelectCurrentUser = (userId: string) => {
    setCurrentUserId(userId);
    const switched = users.find((u) => u.id === userId);
    if (switched) {
      const userRole = roles.find((r) => r.id === switched.roleId);
      const roleName = userRole ? userRole.name.toUpperCase() : 'MEMBER';
      addNotification(
        'task_created',
        'Switched User Profile',
        `Now operating as ${switched.name} (${roleName}).`
      );
    }
  };

  const handleCreateGroup = (groupData: Omit<Group, 'id' | 'createdAt'>) => {
    const newGroup: Group = {
      ...groupData,
      id: `group-${Date.now()}`,
      createdAt: new Date().toISOString(),
    };
    setGroups((prev) => [...prev, newGroup]);
    addNotification(
      'project_created',
      'Team Group Created',
      `New team "${newGroup.name}" created.`
    );
  };

  const handleUpdateGroup = (updatedGroup: Group) => {
    setGroups((prev) => prev.map((g) => (g.id === updatedGroup.id ? updatedGroup : g)));
  };

  const handleDeleteGroup = (groupId: string) => {
    setGroups((prev) => prev.filter((g) => g.id !== groupId));
    setUsers((prev) =>
      prev.map((u) => ({
        ...u,
        groupIds: u.groupIds.filter((id) => id !== groupId),
      }))
    );
  };

  const handleCreateRole = (roleData: Omit<Role, 'id'>) => {
    const newRole: Role = {
      ...roleData,
      id: `role-${Date.now()}`,
    };
    setRoles((prev) => [...prev, newRole]);
  };

  const handleUpdateRole = (updatedRole: Role) => {
    setRoles((prev) => prev.map((r) => (r.id === updatedRole.id ? updatedRole : r)));
  };

  const handleDeleteRole = (roleId: string) => {
    setRoles((prev) => prev.filter((r) => r.id !== roleId));
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
        onOpenNewProject={handleOpenNewProject}
        onDeleteProject={handleRequestDeleteProject}
        onOpenCommandPalette={() => setIsCommandPaletteOpen(true)}
        onOpenKeybindsModal={() => setIsKeybindsOpen(true)}
        unreadNotificationsCount={unreadNotificationsCount}
        onOpenNotifications={() => setIsNotificationsOpen((prev) => !prev)}
        onOpenTeamModal={() => setIsTeamModalOpen(true)}
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
          onOpenNewProject={handleOpenNewProject}
          onDeleteProject={handleRequestDeleteProject}
          onOpenKeybindsModal={() => setIsKeybindsOpen(true)}
          unreadNotificationsCount={unreadNotificationsCount}
          onOpenNotifications={() => setIsNotificationsOpen((prev) => !prev)}
          currentUser={currentUser}
          roles={roles}
          onOpenTeamModal={() => setIsTeamModalOpen(true)}
          onOpenP2PModal={() => setIsP2PModalOpen(true)}
          p2pOnline={isP2PCoreOnline}
          p2pPeerCount={p2pNodeStatus?.connectedPeers.length || 0}
        />

        {/* Workspace View Container */}
        <main className="flex-1 overflow-hidden">
          {activeView === 'board' && (
            <KanbanBoard
              tasks={filteredTasks}
              projects={projects}
              isDark={isDark}
              users={users}
              groups={groups}
              roles={roles}
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
              users={users}
              groups={groups}
              roles={roles}
              currentUserId={currentUserId}
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
              users={users}
              groups={groups}
              roles={roles}
              currentUserId={currentUserId}
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
        users={users}
        groups={groups}
        roles={roles}
        currentUserId={currentUserId}
        onCreateTask={handleCreateTask}
      />

      <TaskDetailModal
        task={selectedTask}
        projects={projects}
        isDark={isDark}
        users={users}
        groups={groups}
        roles={roles}
        currentUserId={currentUserId}
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
        onOpenNewProject={handleOpenNewProject}
        onOpenKeybindsModal={() => setIsKeybindsOpen(true)}
        onOpenNotifications={() => setIsNotificationsOpen(true)}
        onOpenTeamModal={() => setIsTeamModalOpen(true)}
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

      <TeamManagementModal
        isOpen={isTeamModalOpen}
        onClose={() => setIsTeamModalOpen(false)}
        isDark={isDark}
        users={users}
        groups={groups}
        roles={roles}
        currentUserId={currentUserId}
        onSelectCurrentUser={handleSelectCurrentUser}
        onCreateUser={handleCreateUser}
        onUpdateUser={handleUpdateUser}
        onDeleteUser={handleDeleteUser}
        onCreateGroup={handleCreateGroup}
        onUpdateGroup={handleUpdateGroup}
        onDeleteGroup={handleDeleteGroup}
        onCreateRole={handleCreateRole}
        onUpdateRole={handleUpdateRole}
        onDeleteRole={handleDeleteRole}
      />

      <P2PNetworkModal
        isOpen={isP2PModalOpen}
        onClose={() => setIsP2PModalOpen(false)}
        isDark={isDark}
        isCoreOnline={isP2PCoreOnline}
        nodeStatus={p2pNodeStatus}
        logs={p2pLogs}
        onRefreshStatus={refreshP2PStatus}
        onTicketJoined={(msg) => addNotification('task_created', 'iroh P2P Sync', msg)}
      />
    </div>
  );
}
export default App;

