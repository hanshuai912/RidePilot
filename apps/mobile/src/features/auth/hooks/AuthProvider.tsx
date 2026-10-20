import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import type {
  AuthResponse,
  AuthUser,
  LoginRequest,
  RegisterRequest,
} from "@ridepilot/contracts";

import { authApi, AuthApiError } from "../services/auth.api";
import { authStorage } from "../services/auth-storage";

type Session = { user: AuthUser; accessToken: string; expiresAt: number };
type AuthState = {
  status: "loading" | "authenticated" | "guest" | "unavailable";
  session: Session | null;
};
type AuthContextValue = AuthState & {
  login: (input: LoginRequest) => Promise<void>;
  register: (input: RegisterRequest) => Promise<void>;
  logout: () => Promise<void>;
  retry: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({
    status: "loading",
    session: null,
  });

  const accept = useCallback(async (response: AuthResponse) => {
    await authStorage.setRefreshToken(response.tokens.refreshToken);
    setState({
      status: "authenticated",
      session: {
        user: response.user,
        accessToken: response.tokens.accessToken,
        expiresAt: Date.now() + response.tokens.expiresInSeconds * 1000,
      },
    });
  }, []);

  const restore = useCallback(async () => {
    try {
      const refreshToken = await authStorage.getRefreshToken();
      if (!refreshToken) {
        setState({ status: "guest", session: null });
        return;
      }
      await accept(await authApi.refresh(refreshToken));
    } catch (error) {
      if (
        error instanceof AuthApiError &&
        [400, 401].includes(error.status ?? -1)
      ) {
        await authStorage.clearRefreshToken();
        setState({ status: "guest", session: null });
      } else {
        setState({ status: "unavailable", session: null });
      }
    }
  }, [accept]);

  useEffect(() => {
    const timer = setTimeout(() => void restore(), 0);
    return () => clearTimeout(timer);
  }, [restore]);

  useEffect(() => {
    if (state.status !== "authenticated" || !state.session) return;
    const delay = Math.max(1000, state.session.expiresAt - Date.now() - 60000);
    const timer = setTimeout(() => {
      void restore();
    }, delay);
    return () => clearTimeout(timer);
  }, [restore, state]);

  const login = useCallback(
    async (input: LoginRequest) => accept(await authApi.login(input)),
    [accept],
  );
  const register = useCallback(
    async (input: RegisterRequest) => accept(await authApi.register(input)),
    [accept],
  );
  const logout = useCallback(async () => {
    if (!state.session) return;
    try {
      await authApi.logout(state.session.accessToken);
    } catch (error) {
      if (!(error instanceof AuthApiError && error.status === 401)) throw error;
      const refreshToken = await authStorage.getRefreshToken();
      if (refreshToken) {
        try {
          const refreshed = await authApi.refresh(refreshToken);
          await authApi.logout(refreshed.tokens.accessToken);
        } catch (refreshError) {
          if (!(
            refreshError instanceof AuthApiError &&
            [400, 401].includes(refreshError.status ?? -1)
          ))
            throw refreshError;
        }
      }
    }
    await authStorage.clearRefreshToken();
    setState({ status: "guest", session: null });
  }, [state.session]);

  return (
    <AuthContext.Provider
      value={{ ...state, login, register, logout, retry: restore }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used inside AuthProvider");
  return context;
}
