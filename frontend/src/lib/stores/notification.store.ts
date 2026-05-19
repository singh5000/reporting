import { create } from "zustand";
import { toast } from "sonner";
import { mockRequest } from "@/lib/api/api-client";
import { notificationStore as legacy, type Notification } from "@/lib/notification-store";
import type { ApiError } from "@/lib/types/api.types";
import { toApiError } from "./_helpers";

type NotificationState = {
  notifications: Notification[];
  loading: boolean;
  error: ApiError | null;
  unreadCount: number;
  fetchNotifications: () => Promise<void>;
  markRead: (id: string) => Promise<void>;
  markAllRead: () => Promise<void>;
  clearAll: () => Promise<void>;
};

const computeUnread = (n: Notification[]) => n.filter((x) => !x.read).length;

export const useNotificationStore = create<NotificationState>((set) => ({
  notifications: legacy.getSnapshot(),
  unreadCount: computeUnread(legacy.getSnapshot()),
  loading: false,
  error: null,

  fetchNotifications: async () => {
    set({ loading: true, error: null });
    try {
      const data = await mockRequest(legacy.getSnapshot());
      set({ notifications: data, unreadCount: computeUnread(data), loading: false });
    } catch (e) {
      set({ loading: false, error: toApiError(e) });
    }
  },

  markRead: async (id) => {
    legacy.markRead(id);
    set({ notifications: legacy.getSnapshot(), unreadCount: computeUnread(legacy.getSnapshot()) });
  },

  markAllRead: async () => {
    legacy.markAllRead();
    set({ notifications: legacy.getSnapshot(), unreadCount: 0 });
    toast("All notifications marked as read");
  },

  clearAll: async () => {
    try {
      await mockRequest(true);
      legacy.clearAll();
      set({ notifications: [], unreadCount: 0 });
      toast("Notifications cleared");
    } catch (e) {
      toast.error(toApiError(e).message);
    }
  },
}));

if (typeof window !== "undefined") {
  legacy.subscribe(() => {
    const data = legacy.getSnapshot();
    useNotificationStore.setState({ notifications: data, unreadCount: computeUnread(data) });
  });
}
