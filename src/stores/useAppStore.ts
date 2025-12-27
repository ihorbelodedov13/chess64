import { create } from "zustand";
import type { UserResponse } from "../types/api";

interface AppState {
  currentPage: string;
  isLoading: boolean;
  user: UserResponse | null;

  // Actions
  setCurrentPage: (page: string) => void;
  setLoading: (loading: boolean) => void;
  setUser: (user: UserResponse | null) => void;
}

export const useAppStore = create<AppState>((set) => ({
  currentPage: "home",
  isLoading: false,
  user: null,

  setCurrentPage: (page) => set({ currentPage: page }),
  setLoading: (loading) => set({ isLoading: loading }),
  setUser: (user) => set({ user }),
}));
