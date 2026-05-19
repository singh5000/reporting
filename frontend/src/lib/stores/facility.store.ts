import { create } from "zustand";
import { toast } from "sonner";
import { mockRequest } from "@/lib/api/api-client";
import { facilityStore as legacy } from "@/lib/facility-store";
import type { Facility, MaintenanceLogEntry } from "@/lib/types/facility.types";
import type { ApiError } from "@/lib/types/api.types";
import { toApiError } from "./_helpers";

type FacilityState = {
  facilities: Facility[];
  loading: boolean;
  error: ApiError | null;
  initialized: boolean;
  fetchFacilities: () => Promise<void>;
  createFacility: (input: Omit<Facility, "id" | "reference" | "createdAt" | "lastMaintenance" | "logs">) => Promise<Facility>;
  updateFacility: (id: string, patch: Partial<Facility>) => Promise<void>;
  addMaintenance: (id: string, log: Omit<MaintenanceLogEntry, "id">) => Promise<void>;
  removeFacility: (id: string) => Promise<void>;
};

export const useFacilityStore = create<FacilityState>((set) => ({
  facilities: legacy.getState(),
  loading: false,
  error: null,
  initialized: false,

  fetchFacilities: async () => {
    set({ loading: true, error: null });
    try {
      const data = await mockRequest(legacy.getState());
      set({ facilities: data, loading: false, initialized: true });
    } catch (e) {
      set({ loading: false, error: toApiError(e) });
      toast.error("Failed to load facilities");
    }
  },

  createFacility: async (input) => {
    try {
      const created = await mockRequest(legacy.addFacility(input));
      set({ facilities: legacy.getState() });
      toast.success(`Facility ${created.reference} added`);
      return created;
    } catch (e) {
      const err = toApiError(e);
      toast.error(err.message);
      throw err;
    }
  },

  updateFacility: async (id, patch) => {
    try {
      await mockRequest(true);
      legacy.updateFacility(id, patch);
      set({ facilities: legacy.getState() });
    } catch (e) {
      toast.error(toApiError(e).message);
    }
  },

  addMaintenance: async (id, log) => {
    try {
      await mockRequest(true);
      legacy.addMaintenanceLog(id, log);
      set({ facilities: legacy.getState() });
      toast.success("Maintenance log added");
    } catch (e) {
      toast.error(toApiError(e).message);
    }
  },

  removeFacility: async (id) => {
    try {
      await mockRequest(true);
      legacy.removeFacility(id);
      set({ facilities: legacy.getState() });
      toast("Facility removed");
    } catch (e) {
      toast.error(toApiError(e).message);
    }
  },
}));

if (typeof window !== "undefined") {
  legacy.subscribe(() => useFacilityStore.setState({ facilities: legacy.getState() }));
}
