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
  DeepReadonly,
  OrganizationSummary,
  UserIdentity,
  WorkspaceSummary,
} from "@/types/domain";

interface SessionContextValue {
  user?: DeepReadonly<UserIdentity>;
  organization?: DeepReadonly<OrganizationSummary>;
  workspace?: DeepReadonly<WorkspaceSummary>;
  selectUser: (userId: string) => boolean;
  selectOrganization: (organizationId: string) => boolean;
  selectWorkspace: (workspaceId: string) => boolean;
}

const SessionContext = createContext<SessionContextValue | undefined>(undefined);

export interface SessionProviderProps {
  children: ReactNode;
}

export function SessionProvider({ children }: SessionProviderProps) {
  const [user, setUser] = useState<DeepReadonly<UserIdentity>>();
  const [organization, setOrganization] = useState<DeepReadonly<OrganizationSummary>>();
  const [workspace, setWorkspace] = useState<DeepReadonly<WorkspaceSummary>>();

  const selectUser = useCallback((userId: string) => {
    const selectedUser = users.find((candidate) => candidate.id === userId);

    if (!selectedUser) {
      return false;
    }

    setUser(selectedUser);
    setOrganization(undefined);
    setWorkspace(undefined);
    return true;
  }, []);

  const selectOrganization = useCallback((organizationId: string) => {
    if (organizationId !== mockOrganization.id) {
      return false;
    }

    setOrganization(mockOrganization);
    setWorkspace(undefined);
    return true;
  }, []);

  const selectWorkspace = useCallback((workspaceId: string) => {
    if (workspaceId !== mockWorkspace.id) {
      return false;
    }

    setWorkspace(mockWorkspace);
    return true;
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
