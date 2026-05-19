import { create } from "zustand";
import { toast } from "sonner";
import { mockRequest } from "@/lib/api/api-client";
import { companyStore as legacy } from "@/lib/company-store";
import type { Company } from "@/lib/types/company.types";
import type { ApiError } from "@/lib/types/api.types";
import { toApiError } from "./_helpers";

type CompanyState = {
  companies: Company[];
  activeId: string;
  loading: boolean;
  error: ApiError | null;
  initialized: boolean;
  fetchCompanies: () => Promise<void>;
  createCompany: (input: Omit<Company, "id" | "reference" | "createdAt">) => Promise<Company>;
  updateCompany: (id: string, patch: Partial<Company>) => Promise<void>;
  setActive: (id: string) => void;
};

export const useCompanyStore = create<CompanyState>((set) => ({
  companies: legacy.getState(),
  activeId: legacy.getActiveId(),
  loading: false,
  error: null,
  initialized: false,

  fetchCompanies: async () => {
    set({ loading: true, error: null });
    try {
      const data = await mockRequest(legacy.getState());
      set({ companies: data, loading: false, initialized: true });
    } catch (e) {
      set({ loading: false, error: toApiError(e) });
      toast.error("Failed to load companies");
    }
  },

  createCompany: async (input) => {
    try {
      const created = await mockRequest(legacy.addCompany(input));
      set({ companies: legacy.getState() });
      toast.success(`Company ${created.reference} added`);
      return created;
    } catch (e) {
      const err = toApiError(e);
      toast.error(err.message);
      throw err;
    }
  },

  updateCompany: async (id, patch) => {
    try {
      await mockRequest(true);
      legacy.updateCompany(id, patch);
      set({ companies: legacy.getState() });
    } catch (e) {
      toast.error(toApiError(e).message);
    }
  },

  setActive: (id) => {
    legacy.setActive(id);
    set({ activeId: id });
  },
}));

if (typeof window !== "undefined") {
  legacy.subscribe(() =>
    useCompanyStore.setState({ companies: legacy.getState(), activeId: legacy.getActiveId() }),
  );
}
