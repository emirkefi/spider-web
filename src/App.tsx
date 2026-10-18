import React, { useState, useEffect, useMemo } from 'react';
import { ActiveView, Project, Task, TaskPriority, TaskStatus } from './types';
import { INITIAL_PROJECTS, INITIAL_TASKS } from './initialData';
import { Sidebar } from './components/Sidebar';
import { TopBar } from './components/TopBar';
import { KanbanBoard } from './components/KanbanBoard';
import { AnalyticsView } from './components/AnalyticsView';
import { FocusListView } from './components/FocusListView';
import {
  NewTaskModal,
  NewProjectModal,
  DeleteProjectModal,
  KeybindsModal,
  CommandPaletteModal,
} from './components/Modals';

const STORAGE_KEYS = {
  TASKS: 'spiderweb_tasks_v1',
  PROJECTS: 'spiderweb_projects_v1',
  THEME: 'spiderweb_theme_dark_v1',
  SIDEBAR_COLLAPSED: 'spiderweb_sidebar_collapsed_v1',
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
  const [isNewProjectOpen, setIsNewProjectOpen] = useState(false);
  const [projectToDelete, setProjectToDelete] = useState<Project | null>(null);
  const [isKeybindsOpen, setIsKeybindsOpen] = useState(false);
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false);

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

      if (e.key === 'Escape') {
        setIsNewTaskOpen(false);
        setIsNewProjectOpen(false);
        setProjectToDelete(null);
        setIsKeybindsOpen(false);
        setIsCommandPaletteOpen(false);
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

  const handleCreateTask = (newTaskData: Omit<Task, 'id' | 'createdAt'>) => {
    const nextNum = tasks.length + 101;
    const newTask: Task = {
      ...newTaskData,
      id: `TSK-${nextNum}`,
      createdAt: new Date().toISOString(),
    };
    setTasks((prev) => [newTask, ...prev]);
  };

  const handleCreateProject = (newProjData: Omit<Project, 'id'>) => {
    const newProj: Project = {
      ...newProjData,
      id: `proj-${Date.now()}`,
    };
    setProjects((prev) => [...prev, newProj]);
    setSelectedProjectId(newProj.id);
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
        />

        {/* Workspace View Container */}
        <main className="flex-1 overflow-hidden">
          {activeView === 'board' && (
            <KanbanBoard
              tasks={filteredTasks}
              projects={projects}
              isDark={isDark}
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
        onMoveStatus={handleMoveStatus}
        onOpenNewTask={() => handleOpenNewTaskWithStatus('todo')}
        onOpenNewProject={() => setIsNewProjectOpen(true)}
        onOpenKeybindsModal={() => setIsKeybindsOpen(true)}
      />
    </div>
  );
}
export default App;
