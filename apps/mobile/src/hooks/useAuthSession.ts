import { useCallback, useMemo, useState } from "react";
import {
  API_URL,
  ApiError,
  apiGet,
  apiPost,
  loginDevUser,
  refreshAuthSession,
  type AuthSession,
  type LoginProfile,
} from "../api/client";

export interface AuthState {
  session?: AuthSession;
  isSigningIn: boolean;
  error?: string;
}

export function useAuthSession() {
  const [state, setState] = useState<AuthState>({ isSigningIn: false });

  const refreshSession = useCallback(async (session: AuthSession): Promise<AuthSession> => {
    const refreshed = await refreshAuthSession(session.refreshToken);
    const nextSession: AuthSession = {
      ...session,
      ...refreshed,
    };
    setState({ session: nextSession, isSigningIn: false });
    return nextSession;
  }, []);

  const signIn = useCallback(async (profile: LoginProfile): Promise<AuthSession | undefined> => {
    if (state.session) {
      return state.session;
    }

    setState((current) => ({ ...current, isSigningIn: true, error: undefined }));
    try {
      const session = await loginDevUser(profile);
      setState({ session, isSigningIn: false });
      return session;
    } catch (error) {
      const detail = error instanceof ApiError && error.status === 0 ? ` Check ${API_URL}` : " Please try again.";
      setState({ isSigningIn: false, error: `Could not sign in to the API.${detail}` });
      return undefined;
    }
  }, [state.session]);

  const authenticatedPost = useCallback(
    async <T,>(path: string, body?: unknown): Promise<T> => {
      const session = state.session ?? (await signIn({ runnerId: "runner", nickname: "Runner" }));
      if (!session) {
        throw new Error("Missing auth session");
      }

      try {
        return await apiPost<T>(path, body, { accessToken: session.accessToken });
      } catch (error) {
        if (!(error instanceof ApiError) || error.status !== 401) {
          throw error;
        }

        const nextSession = await refreshSession(session);
        return apiPost<T>(path, body, { accessToken: nextSession.accessToken });
      }
    },
    [refreshSession, signIn, state.session],
  );

  const authenticatedGet = useCallback(
    async <T,>(path: string): Promise<T> => {
      const session = state.session ?? (await signIn({ runnerId: "runner", nickname: "Runner" }));
      if (!session) {
        throw new Error("Missing auth session");
      }

      try {
        return await apiGet<T>(path, { accessToken: session.accessToken });
      } catch (error) {
        if (!(error instanceof ApiError) || error.status !== 401) {
          throw error;
        }

        const nextSession = await refreshSession(session);
        return apiGet<T>(path, { accessToken: nextSession.accessToken });
      }
    },
    [refreshSession, signIn, state.session],
  );

  const getAccessToken = useCallback(async (): Promise<string> => {
    const session = state.session ?? (await signIn({ runnerId: "runner", nickname: "Runner" }));
    if (!session) {
      throw new Error("Missing auth session");
    }

    try {
      const nextSession = await refreshSession(session);
      return nextSession.accessToken;
    } catch {
      return session.accessToken;
    }
  }, [refreshSession, signIn, state.session]);

  const refreshAccessToken = useCallback(async (): Promise<string> => {
    const session = state.session;
    if (!session) {
      throw new Error("Missing auth session");
    }
    const nextSession = await refreshSession(session);
    return nextSession.accessToken;
  }, [refreshSession, state.session]);

  const authStatus = useMemo(
    () => ({
      hasSession: Boolean(state.session),
      runnerId: state.session?.user.runnerId,
      isDemoMode: state.session?.accessToken === "demo-access-token",
    }),
    [state.session],
  );

  return useMemo(
    () => ({
      ...state,
      signIn,
      authenticatedGet,
      authenticatedPost,
      getAccessToken,
      refreshAccessToken,
      authStatus,
      isDemoMode: state.session?.accessToken === "demo-access-token",
    }),
    [authStatus, authenticatedGet, authenticatedPost, getAccessToken, refreshAccessToken, signIn, state],
  );
}
