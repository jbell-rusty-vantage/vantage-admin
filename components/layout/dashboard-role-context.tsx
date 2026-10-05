"use client";

import { createContext, useContext } from "react";
// The shell carries an Owner, Admin or (Daily Operations only) Manager role; a rep never renders it.
import type { DashboardShellRole as AdminRole } from "./dashboard-nav";

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
