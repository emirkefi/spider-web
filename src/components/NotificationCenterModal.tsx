import React from 'react';
import {
  Bell,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Sparkles,
  Trash2,
  CheckCheck,
  X,
  Flame,
  GitPullRequest,
  FolderKanban,
} from 'lucide-react';
import { AppNotification, NotificationType } from '../types';

interface NotificationCenterModalProps {
  isOpen: boolean;
  onClose: () => void;
  notifications: AppNotification[];
  isDark: boolean;
  onMarkAllAsRead: () => void;
  onClearAll: () => void;
  onNotificationClick: (notif: AppNotification) => void;
  onRequestPermission: () => void;
  onToggleSystemPermission?: () => void;
  onSendTestNotification?: () => void;
  hasSystemPermission: boolean;
}

export const NotificationCenterModal: React.FC<NotificationCenterModalProps> = ({
  isOpen,
  onClose,
  notifications,
  isDark,
  onMarkAllAsRead,
  onClearAll,
  onNotificationClick,
  onRequestPermission,
  onToggleSystemPermission,
  onSendTestNotification,
  hasSystemPermission,
}) => {
  if (!isOpen) return null;

  const unreadCount = notifications.filter((n) => !n.read).length;

  const formatRelativeTime = (isoString: string) => {
    try {
      const diffMs = Date.now() - new Date(isoString).getTime();
      const sec = Math.floor(diffMs / 1000);
      if (sec < 60) return 'Just now';
      const min = Math.floor(sec / 60);
      if (min < 60) return `${min}m ago`;
      const hrs = Math.floor(min / 60);
      if (hrs < 24) return `${hrs}h ago`;
      const days = Math.floor(hrs / 24);
      return `${days}d ago`;
    } catch {
      return '';
    }
  };

  const getIcon = (type: NotificationType) => {
    switch (type) {
      case 'task_completed':
        return <CheckCircle2 size={16} className="text-emerald-500" />;
      case 'task_moved':
        return <GitPullRequest size={16} className="text-purple-500" />;
      case 'overdue':
        return <AlertTriangle size={16} className="text-rose-500" />;
      case 'due_soon':
        return <Clock size={16} className="text-amber-500" />;
      case 'project_created':
        return <FolderKanban size={16} className="text-blue-500" />;
      default:
        return <Sparkles size={16} className="text-blue-500" />;
    }
  };

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-start justify-end p-4 pt-16 sm:pr-8 bg-black/40 backdrop-blur-xs"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className={`w-full max-w-sm rounded-3xl border shadow-2xl overflow-hidden flex flex-col transition-all max-h-[82vh] ${
          isDark
            ? 'bg-zinc-900/95 border-white/15 text-zinc-100 shadow-black/70'
            : 'bg-white/95 border-black/10 text-zinc-900 shadow-black/20'
        } backdrop-blur-2xl`}
      >
        {/* Header */}
        <div
          className={`px-4 py-3.5 border-b flex items-center justify-between gap-2 shrink-0 ${
            isDark ? 'border-white/10 bg-white/[0.02]' : 'border-black/5 bg-zinc-50/70'
          }`}
        >
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-xl bg-blue-500/15 text-blue-500">
              <Bell size={16} />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <h3 className="text-sm font-semibold tracking-tight">Notifications</h3>
                {unreadCount > 0 && (
                  <span className="text-[10px] font-mono font-bold px-1.5 py-0.2 rounded-full bg-blue-500 text-white">
                    {unreadCount}
                  </span>
                )}
              </div>
              <p className="text-[10px] opacity-50">App &amp; Linux Desktop Alerts</p>
            </div>
          </div>

          <div className="flex items-center gap-1">
            {unreadCount > 0 && (
              <button
                onClick={onMarkAllAsRead}
                title="Mark all as read"
                className={`p-1.5 rounded-lg border text-xs opacity-75 hover:opacity-100 transition cursor-pointer ${
                  isDark
                    ? 'border-white/10 hover:bg-white/10'
                    : 'border-black/10 hover:bg-black/5'
                }`}
              >
                <CheckCheck size={14} />
              </button>
            )}
            {notifications.length > 0 && (
              <button
                onClick={onClearAll}
                title="Clear all notifications"
                className={`p-1.5 rounded-lg border text-xs opacity-75 hover:opacity-100 hover:text-rose-500 transition cursor-pointer ${
                  isDark
                    ? 'border-white/10 hover:bg-white/10'
                    : 'border-black/10 hover:bg-black/5'
                }`}
              >
                <Trash2 size={14} />
              </button>
            )}
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg opacity-60 hover:opacity-100 transition cursor-pointer"
            >
              <X size={15} />
            </button>
          </div>
        </div>

        {/* Desktop Notification Status & Controls Banner */}
        <div
          className={`px-4 py-2 border-b text-xs flex items-center justify-between gap-2 shrink-0 ${
            hasSystemPermission
              ? isDark
                ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-300'
                : 'bg-emerald-50 border-emerald-200 text-emerald-900'
              : isDark
              ? 'bg-blue-500/10 border-blue-500/20 text-blue-200'
              : 'bg-blue-50 border-blue-200 text-blue-900'
          }`}
        >
          <div className="flex items-center gap-1.5 min-w-0">
            <span
              className={`w-2 h-2 rounded-full shrink-0 ${
                hasSystemPermission
                  ? 'bg-emerald-500 shadow-[0_0_8px_rgba(48,209,88,0.7)]'
                  : 'bg-zinc-400'
              }`}
            />
            <span className="text-[11px] truncate">
              {hasSystemPermission ? 'Desktop alerts active' : 'Enable PC desktop notifications'}
            </span>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            {hasSystemPermission ? (
              <>
                {onSendTestNotification && (
                  <button
                    onClick={onSendTestNotification}
                    title="Send a test alert to your desktop"
                    className={`px-2 py-0.5 rounded-lg text-[10px] font-medium border transition cursor-pointer ${
                      isDark
                        ? 'border-emerald-500/30 hover:bg-emerald-500/20 text-emerald-200'
                        : 'border-emerald-300 hover:bg-emerald-100 text-emerald-800'
                    }`}
                  >
                    Test Alert
                  </button>
                )}
                {onToggleSystemPermission && (
                  <button
                    onClick={onToggleSystemPermission}
                    title="Mute desktop push notifications"
                    className="px-2 py-0.5 rounded-lg text-[10px] font-medium opacity-60 hover:opacity-100 transition cursor-pointer"
                  >
                    Mute
                  </button>
                )}
              </>
            ) : (
              <button
                onClick={onRequestPermission}
                className="px-2.5 py-1 rounded-lg text-[10px] font-semibold bg-blue-500 text-white hover:bg-blue-600 transition cursor-pointer shadow-xs"
              >
                Enable
              </button>
            )}
          </div>
        </div>

        {/* Notification List */}
        <div className="flex-1 overflow-y-auto p-2 space-y-1.5">
          {notifications.length === 0 ? (
            <div className="h-48 flex flex-col items-center justify-center text-center p-4">
              <div
                className={`w-10 h-10 rounded-2xl flex items-center justify-center mb-2 ${
                  isDark ? 'bg-white/5 text-zinc-500' : 'bg-black/5 text-zinc-400'
                }`}
              >
                <Bell size={20} />
              </div>
              <p className="text-xs font-semibold">No notifications</p>
              <p className="text-[11px] opacity-50 mt-0.5">
                Task deadlines, reviews, and status changes will appear here
              </p>
            </div>
          ) : (
            notifications.map((n) => (
              <div
                key={n.id}
                onClick={() => onNotificationClick(n)}
                className={`p-3 rounded-2xl border transition-all cursor-pointer relative ${
                  !n.read
                    ? isDark
                      ? 'bg-white/[0.08] border-blue-500/40 text-zinc-100'
                      : 'bg-blue-50/70 border-blue-200 text-zinc-900'
                    : isDark
                    ? 'bg-white/[0.02] border-white/[0.06] text-zinc-300 hover:bg-white/[0.05]'
                    : 'bg-white border-black/[0.06] text-zinc-700 hover:bg-zinc-50'
                }`}
              >
                <div className="flex items-start gap-2.5">
                  <div className="shrink-0 mt-0.5">{getIcon(n.type)}</div>
                  <div className="flex-1 min-w-0 pr-1">
                    <div className="flex items-baseline justify-between gap-1">
                      <h4 className="text-xs font-semibold truncate leading-tight">
                        {n.title}
                      </h4>
                      <span className="text-[10px] font-mono opacity-40 shrink-0">
                        {formatRelativeTime(n.createdAt)}
                      </span>
                    </div>
                    <p className="text-[11px] opacity-70 mt-0.5 line-clamp-2 leading-relaxed">
                      {n.message}
                    </p>
                  </div>
                  {!n.read && (
                    <span className="w-2 h-2 rounded-full bg-blue-500 shrink-0 mt-1" />
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
