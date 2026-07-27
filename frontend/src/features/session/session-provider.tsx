"use client";

import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import {
  organization as mockOrganization,
  users,
  workspaces,
} from "@/mock/fixtures";
import type {
  DeepReadonly,
  OrganizationSummary,
  UserIdentity,
  WorkspaceSummary,
} from "@/types/domain";

interface SessionContextValue {
  user?: DeepReadonly<UserIdentity>;
  organization?: DeepReadonly<OrganizationSummary>;
  workspace?: DeepReadonly<WorkspaceSummary>;
  hydrated: boolean;
  selectUser: (userId: string) => boolean;
  selectOrganization: (organizationId: string) => boolean;
  selectWorkspace: (workspaceId: string) => boolean;
}

const SessionContext = createContext<SessionContextValue | undefined>(undefined);

export const MOCK_SESSION_STORAGE_KEY = "aios.mock.session.v1";

interface SessionState {
  user?: DeepReadonly<UserIdentity>;
  organization?: DeepReadonly<OrganizationSummary>;
  workspace?: DeepReadonly<WorkspaceSummary>;
}

interface StoredSession {
  userId: string;
  organizationId?: string;
  workspaceId?: string;
}

const emptySession: SessionState = {};
const storedSessionKeys = new Set(["userId", "organizationId", "workspaceId"]);

function readStoredSession(): SessionState | undefined {
  let rawValue: string | null;

  try {
    rawValue = window.sessionStorage.getItem(MOCK_SESSION_STORAGE_KEY);
  } catch {
    return undefined;
  }

  if (rawValue === null) {
    return emptySession;
  }

  try {
    const parsed: unknown = JSON.parse(rawValue);

    if (
      parsed === null ||
      typeof parsed !== "object" ||
      Array.isArray(parsed) ||
      Object.keys(parsed).some((key) => !storedSessionKeys.has(key))
    ) {
      return undefined;
    }

    const candidate = parsed as Partial<Record<keyof StoredSession, unknown>>;
    if (
      typeof candidate.userId !== "string" ||
      (candidate.organizationId !== undefined &&
        typeof candidate.organizationId !== "string") ||
      (candidate.workspaceId !== undefined &&
        typeof candidate.workspaceId !== "string")
    ) {
      return undefined;
    }

    const user = users.find(({ id }) => id === candidate.userId);
    if (!user) {
      return undefined;
    }

    if (candidate.organizationId === undefined) {
      return candidate.workspaceId === undefined ? { user } : undefined;
    }

    if (candidate.organizationId !== mockOrganization.id) {
      return undefined;
    }

    if (candidate.workspaceId === undefined) {
      return { user, organization: mockOrganization };
    }

    const workspace = workspaces.find(
      ({ id }) => id === candidate.workspaceId,
    );
    if (
      !workspace ||
      workspace.organizationId !== mockOrganization.id ||
      workspace.accessStatus !== "可访问"
    ) {
      return undefined;
    }

    return { user, organization: mockOrganization, workspace };
  } catch {
    return undefined;
  }
}

function persistSession(session: SessionState): void {
  try {
    if (!session.user) {
      window.sessionStorage.removeItem(MOCK_SESSION_STORAGE_KEY);
      return;
    }

    const storedSession: StoredSession = {
      userId: session.user.id,
      ...(session.organization
        ? { organizationId: session.organization.id }
        : {}),
      ...(session.workspace ? { workspaceId: session.workspace.id } : {}),
    };
    window.sessionStorage.setItem(
      MOCK_SESSION_STORAGE_KEY,
      JSON.stringify(storedSession),
    );
  } catch {
    // 标签页存储不可用时，模拟会话仍可在内存中使用。
  }
}

function clearStoredSession(): void {
  try {
    window.sessionStorage.removeItem(MOCK_SESSION_STORAGE_KEY);
  } catch {
    // 加固的浏览器环境可能禁用存储。
  }
}

export interface SessionProviderProps {
  children: ReactNode;
}

export function SessionProvider({ children }: SessionProviderProps) {
  const [session, setSession] = useState<SessionState>(emptySession);
  const [hydrated, setHydrated] = useState(false);
  const sessionRef = useRef<SessionState>(emptySession);
  const explicitSelectionRef = useRef(false);

  const commitSession = useCallback((nextSession: SessionState) => {
    sessionRef.current = nextSession;
    setSession(nextSession);
    persistSession(nextSession);
  }, []);

  useEffect(() => {
    let active = true;

    queueMicrotask(() => {
      if (!active) {
        return;
      }

      if (!explicitSelectionRef.current) {
        const restoredSession = readStoredSession();

        if (restoredSession) {
          sessionRef.current = restoredSession;
          setSession(restoredSession);
        } else {
          clearStoredSession();
        }
      }

      setHydrated(true);
    });

    return () => {
      active = false;
    };
  }, []);

  const selectUser = useCallback((userId: string) => {
    const selectedUser = users.find((candidate) => candidate.id === userId);

    if (!selectedUser) {
      return false;
    }

    explicitSelectionRef.current = true;
    commitSession({ user: selectedUser });
    return true;
  }, [commitSession]);

  const selectOrganization = useCallback((organizationId: string) => {
    const currentSession = sessionRef.current;
    if (!currentSession.user || organizationId !== mockOrganization.id) {
      return false;
    }

    explicitSelectionRef.current = true;
    commitSession({
      user: currentSession.user,
      organization: mockOrganization,
    });
    return true;
  }, [commitSession]);

  const selectWorkspace = useCallback((workspaceId: string) => {
    const currentSession = sessionRef.current;
    const selectedWorkspace = workspaces.find(
      (candidate) => candidate.id === workspaceId,
    );
    if (
      !currentSession.user ||
      !currentSession.organization ||
      !selectedWorkspace ||
      selectedWorkspace.organizationId !== currentSession.organization.id ||
      selectedWorkspace.accessStatus !== "可访问"
    ) {
      return false;
    }

    explicitSelectionRef.current = true;
    commitSession({
      user: currentSession.user,
      organization: currentSession.organization,
      workspace: selectedWorkspace,
    });
    return true;
  }, [commitSession]);

  const value = useMemo(
    () => ({
      ...session,
      hydrated,
      selectUser,
      selectOrganization,
      selectWorkspace,
    }),
    [
      hydrated,
      session,
      selectOrganization,
      selectUser,
      selectWorkspace,
    ],
  );

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession() {
  const session = useContext(SessionContext);

  if (!session) {
    throw new Error("useSession 必须在 SessionProvider 内部使用");
  }

  return session;
}
