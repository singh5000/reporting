import { create } from "zustand";
import { toast } from "sonner";
import { mockRequest } from "@/lib/api/api-client";
import { dashboardStore as legacy } from "@/lib/dashboard-store";
import type { ApiError } from "@/lib/types/api.types";
import { toApiError } from "./_helpers";

type Snapshot = ReturnType<typeof legacy.getSnapshot>;

type DashboardState = {
  snapshot: Snapshot;
  loading: boolean;
  error: ApiError | null;
  initialized: boolean;
  fetchMetrics: () => Promise<void>;
  startLive: () => void;
  stopLive: () => void;
};

export const useDashboardStore = create<DashboardState>((set) => ({
  snapshot: legacy.getSnapshot(),
  loading: false,
  error: null,
  initialized: false,

  fetchMetrics: async () => {
    set({ loading: true, error: null });
    try {
      const snap = await mockRequest(legacy.getSnapshot());
      set({ snapshot: snap, loading: false, initialized: true });
    } catch (e) {
      set({ loading: false, error: toApiError(e) });
      toast.error("Failed to load metrics");
    }
  },

  startLive: () => legacy.start(),
  stopLive: () => legacy.stop(),
}));

if (typeof window !== "undefined") {
  legacy.subscribe(() => useDashboardStore.setState({ snapshot: legacy.getSnapshot() }));
}
