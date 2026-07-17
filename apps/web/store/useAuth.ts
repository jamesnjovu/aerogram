"use client";

import { create } from "zustand";
import type { MeDTO } from "@aerogram/shared";

interface AuthState {
  me: MeDTO | null;
  setMe: (me: MeDTO | null) => void;
}

export const useAuth = create<AuthState>((set) => ({
  me: null,
  setMe: (me) => set({ me }),
}));
