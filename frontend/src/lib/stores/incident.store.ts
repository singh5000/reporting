import { create } from "zustand";
import { toast } from "sonner";
import { mockRequest } from "@/lib/api/api-client";
import { incidentStore as legacy } from "@/lib/incident-store";
import type { Incident, IncidentStatus } from "@/lib/types/incident.types";
import type { ApiError } from "@/lib/types/api.types";
import { toApiError } from "./_helpers";

type IncidentState = {
  incidents: Incident[];
  loading: boolean;
  error: ApiError | null;
  initialized: boolean;
  fetchIncidents: () => Promise<void>;
  createIncident: (input: Omit<Incident, "id" | "reference" | "createdAt" | "status" | "timeline">) => Promise<Incident>;
  updateStatus: (id: string, status: IncidentStatus) => Promise<void>;
  removeIncident: (id: string) => Promise<void>;
};

export const useIncidentStore = create<IncidentState>((set) => ({
  incidents: legacy.getState(),
  loading: false,
  error: null,
  initialized: false,

  fetchIncidents: async () => {
    set({ loading: true, error: null });
    try {
      const data = await mockRequest(legacy.getState());
      set({ incidents: data, loading: false, initialized: true });
    } catch (e) {
      set({ loading: false, error: toApiError(e) });
      toast.error("Failed to load incidents");
    }
  },

  createIncident: async (input) => {
    try {
      const created = await mockRequest(legacy.addIncident(input));
      set({ incidents: legacy.getState() });
      toast.success(`Incident ${created.reference} reported`);
      return created;
    } catch (e) {
      const err = toApiError(e);
      toast.error(err.message);
      throw err;
    }
  },

  updateStatus: async (id, status) => {
    try {
      await mockRequest(true);
      legacy.updateIncidentStatus(id, status);
      set({ incidents: legacy.getState() });
      toast(`Status updated to ${status}`);
    } catch (e) {
      toast.error(toApiError(e).message);
    }
  },

  removeIncident: async (id) => {
    try {
      await mockRequest(true);
      legacy.removeIncident(id);
      set({ incidents: legacy.getState() });
      toast("Incident removed");
    } catch (e) {
      toast.error(toApiError(e).message);
    }
  },
}));

if (typeof window !== "undefined") {
  legacy.subscribe(() => useIncidentStore.setState({ incidents: legacy.getState() }));
}
