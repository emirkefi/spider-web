import { AppNotification } from '../types';

// Check if running inside the native GTK4 WebKit application
export function isNativeDesktopBridge(): boolean {
  if (typeof window === 'undefined') return false;
  const win = window as any;
  return Boolean(win.webkit?.messageHandlers?.systemNotification);
}

// Check if system notifications are supported in this environment
export function isSystemNotificationSupported(): boolean {
  if (typeof window === 'undefined') return false;
  return isNativeDesktopBridge() || 'Notification' in window;
}

// Request desktop notification permission
export async function requestSystemNotificationPermission(): Promise<boolean> {
  if (typeof window === 'undefined') {
    return false;
  }

  // 1. If running in native Linux WebKitGTK standalone app, it is always available and granted
  if (isNativeDesktopBridge()) {
    return true;
  }

  // 2. Standard Web Notification API
  if ('Notification' in window) {
    if (Notification.permission === 'granted') {
      return true;
    }
    try {
      const result = await Notification.requestPermission();
      return result === 'granted';
    } catch (err) {
      console.warn('Web notification permission error:', err);
      return false;
    }
  }

  return false;
}

// Send system notification to Linux desktop and notify-send bridge
export function sendDesktopNotification(title: string, body: string, icon = '/spider-icon.svg') {
  try {
    const win = window as any;

    // 1. Post to native WebKitGTK handler if available (executes notify-send on Linux/Wayland)
    if (win.webkit?.messageHandlers?.systemNotification) {
      try {
        win.webkit.messageHandlers.systemNotification.postMessage({ title, body, icon });
      } catch {
        win.webkit.messageHandlers.systemNotification.postMessage(
          JSON.stringify({ title, body, icon })
        );
      }
      return;
    }

    // 2. Standard Web Notification API fallback
    if ('Notification' in window && Notification.permission === 'granted') {
      new Notification(title, {
        body,
        icon,
      });
    }
  } catch (err) {
    console.warn('Desktop notification dispatch note:', err);
  }
}
