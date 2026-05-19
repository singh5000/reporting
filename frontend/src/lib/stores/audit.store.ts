import { create } from "zustand";
import { toast } from "sonner";
import { mockRequest } from "@/lib/api/api-client";
import { auditStore as legacy } from "@/lib/audit-store";
import type { Audit, AuditStatus } from "@/lib/types/audit.types";
import type { ApiError } from "@/lib/types/api.types";
import { toApiError } from "./_helpers";

type AuditState = {
  audits: Audit[];
  loading: boolean;
  error: ApiError | null;
  initialized: boolean;
  fetchAudits: () => Promise<void>;
  createAudit: (input: Omit<Audit, "id" | "reference" | "createdAt" | "status"> & { status?: AuditStatus }) => Promise<Audit>;
  updateAudit: (id: string, patch: Partial<Audit>) => Promise<void>;
  removeAudit: (id: string) => Promise<void>;
};

export const useAuditStore = create<AuditState>((set, get) => ({
  audits: legacy.getState(),
  loading: false,
  error: null,
  initialized: false,

  fetchAudits: async () => {
    set({ loading: true, error: null });
    try {
      const data = await mockRequest(legacy.getState());
      set({ audits: data, loading: false, initialized: true });
    } catch (e) {
      set({ loading: false, error: toApiError(e) });
      toast.error("Failed to load audits");
    }
  },

  createAudit: async (input) => {
    try {
      const created = await mockRequest(legacy.addAudit(input));
      set({ audits: legacy.getState() });
      toast.success(`Audit ${created.reference} created`);
      return created;
    } catch (e) {
      const err = toApiError(e);
      set({ error: err });
      toast.error(err.message);
      throw err;
    }
  },

  updateAudit: async (id, patch) => {
    try {
      await mockRequest(true);
      legacy.updateAudit(id, patch);
      set({ audits: legacy.getState() });
    } catch (e) {
      const err = toApiError(e);
      toast.error(err.message);
      set({ error: err });
    }
    void get;
  },

  removeAudit: async (id) => {
    try {
      await mockRequest(true);
      legacy.removeAudit(id);
      set({ audits: legacy.getState() });
      toast("Audit removed");
    } catch (e) {
      toast.error(toApiError(e).message);
    }
  },
}));

// Bridge legacy store mutations into Zustand for components still using useAudits()
if (typeof window !== "undefined") {
  legacy.subscribe(() => {
    useAuditStore.setState({ audits: legacy.getState() });
  });
}
