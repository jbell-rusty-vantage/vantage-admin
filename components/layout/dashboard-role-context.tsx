"use client";

import { createContext, useContext } from "react";
// S8-USERS: the shell only ever carries an Owner/Admin role; a rep never renders it.
import type { DashboardRole as AdminRole } from "@/server/models";

const DashboardRoleContext = createContext<AdminRole | null>(null);

export function DashboardRoleProvider({
  role,
  children,
}: {
  role: AdminRole;
  children: React.ReactNode;
}) {
  return (
    <DashboardRoleContext.Provider value={role}>
      {children}
    </DashboardRoleContext.Provider>
  );
}

export function useDashboardRole(): AdminRole | null {
  return useContext(DashboardRoleContext);
}
