import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import axios from 'axios';
import type { User } from '../types';

interface AuthState {
  user: User | null;
  // accessToken lives ONLY in memory — never written to localStorage
  accessToken: string | null;
  setAuth: (user: User, token: string) => void;
  setToken: (token: string) => void;
  logout: () => Promise<void> | void;
  isAuthenticated: () => boolean;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      accessToken: null,
      setAuth: (user, accessToken) => {
        // Token stays in-memory (Zustand state) only.
        // ONLY the non-sensitive user profile is persisted via sessionStorage.
        set({ user, accessToken });
      },
      setToken: (token) => {
        set({ accessToken: token });
      },
      logout: async () => {
        try {
          await axios.post(
            `${import.meta.env.VITE_API_URL || 'http://localhost:5000/api'}/auth/logout`,
            {},
            { withCredentials: true }
          );
        } catch (error) {
          console.warn('Backend session revocation failed', error);
        }
        set({ user: null, accessToken: null });
      },
      isAuthenticated: () => !!get().user,
    }),
    {
      name: 'auth-session',
      // sessionStorage: cleared on tab close — no persistent cross-tab token exposure
      storage: createJSONStorage(() => sessionStorage),
      // Only persist the user profile, NOT the token
      partialize: (state) => ({ user: state.user }),
    }
  )
);
