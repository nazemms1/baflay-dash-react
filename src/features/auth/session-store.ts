import { create } from "zustand";
import { clearStoredToken, getStoredToken, storeToken } from "@/lib/token-storage";
import * as authApi from "./api";
import type { SessionUser } from "./types";

export type SessionStatus = "unknown" | "authenticated" | "anonymous";

interface SessionState {
  /** `unknown` قبل أن نعرف إن كان التوكن المحفوظ ما زال صالحاً. */
  status: SessionStatus;
  user: SessionUser | null;
  hydrate: () => Promise<void>;
  signIn: (email: string, password: string, remember?: boolean) => Promise<void>;
  signOut: () => Promise<void>;
  /** تفريغ محلي دون طلب خادم، يُستدعى عند انتهاء الجلسة. */
  expire: () => void;
}

// الفحص يُطلق مرة واحدة حتى لو استدعاه StrictMode مرتين.
let hydration: Promise<void> | null = null;

export const useSession = create<SessionState>()((set) => ({
  status: "unknown",
  user: null,

  hydrate: () => {
    hydration ??= (async () => {
      if (!getStoredToken()) {
        set({ status: "anonymous", user: null });
        return;
      }
      try {
        const user = await authApi.profile();
        set({ status: "authenticated", user });
      } catch {
        clearStoredToken();
        set({ status: "anonymous", user: null });
      }
    })();
    return hydration;
  },

  signIn: async (email, password, remember = true) => {
    clearStoredToken();
    const { token, user } = await authApi.login(email, password, remember);
    // التوكن يُحفظ قبل طلب الملف الشخصي، لأن الـ interceptor يقرأه من الكوكي.
    storeToken(token, remember);
    try {
      const session = user ?? (await authApi.profile());
      set({ status: "authenticated", user: session });
    } catch (error) {
      clearStoredToken();
      throw error;
    }
  },

  signOut: async () => {
    try {
      if (getStoredToken()) {
        await authApi.logout();
      }
    } catch {
      // الخروج المحلي يكفي حتى لو فشل إبلاغ الخادم.
    } finally {
      clearStoredToken();
      set({ status: "anonymous", user: null });
    }
  },

  expire: () => {
    clearStoredToken();
    set({ status: "anonymous", user: null });
  },
}));
