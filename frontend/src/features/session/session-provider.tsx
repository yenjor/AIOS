"use client";

import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useMemo,
  useState,
} from "react";

import { organization as mockOrganization, users, workspace as mockWorkspace } from "@/mock/fixtures";
import type {
  OrganizationSummary,
  UserIdentity,
  WorkspaceSummary,
} from "@/types/domain";

interface SessionContextValue {
  user?: UserIdentity;
  organization?: OrganizationSummary;
  workspace?: WorkspaceSummary;
  selectUser: (userId: string) => void;
  selectOrganization: (organizationId: string) => void;
  selectWorkspace: (workspaceId: string) => void;
}

const SessionContext = createContext<SessionContextValue | undefined>(undefined);

export interface SessionProviderProps {
  children: ReactNode;
}

export function SessionProvider({ children }: SessionProviderProps) {
  const [user, setUser] = useState<UserIdentity>();
  const [organization, setOrganization] = useState<OrganizationSummary>();
  const [workspace, setWorkspace] = useState<WorkspaceSummary>();

  const selectUser = useCallback((userId: string) => {
    const selectedUser = users.find((candidate) => candidate.id === userId);

    if (selectedUser) {
      setUser(selectedUser);
    }
  }, []);

  const selectOrganization = useCallback((organizationId: string) => {
    if (organizationId === mockOrganization.id) {
      setOrganization(mockOrganization);
      setWorkspace(undefined);
    }
  }, []);

  const selectWorkspace = useCallback((workspaceId: string) => {
    if (workspaceId === mockWorkspace.id) {
      setWorkspace(mockWorkspace);
    }
  }, []);

  const value = useMemo(
    () => ({
      user,
      organization,
      workspace,
      selectUser,
      selectOrganization,
      selectWorkspace,
    }),
    [
      organization,
      selectOrganization,
      selectUser,
      selectWorkspace,
      user,
      workspace,
    ],
  );

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession() {
  const session = useContext(SessionContext);

  if (!session) {
    throw new Error("useSession must be used within a SessionProvider");
  }

  return session;
}
