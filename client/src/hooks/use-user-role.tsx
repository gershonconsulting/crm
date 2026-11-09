import { createContext, ReactNode, useContext } from "react";
import { useQuery } from "@tanstack/react-query";
import type { PublicUser } from "@shared/schema";

export enum UserRole { CLIENT = "client", MANAGER = "manager", ADMIN = "admin" }
type UserRoleContextType = {
  user: PublicUser | null; role: UserRole | null; username: string | null;
  isAdmin: boolean; isManager: boolean; isClient: boolean;
  isLoading: boolean; error: Error | null; hasAccess: (role: UserRole) => boolean;
};
const UserRoleContext = createContext<UserRoleContextType | null>(null);

export function UserRoleProvider({ children }: { children: ReactNode }) {
  const query = useQuery<PublicUser | null>({
    queryKey: ["/api/auth/me"], retry: false, staleTime: 0, refetchOnWindowFocus: true,
    queryFn: async () => {
      const response = await fetch("/api/auth/me", { credentials: "include" });
      if (response.status === 401) return null;
      if (!response.ok) throw new Error("We could not check your sign-in. Please try again.");
      return response.json();
    },
  });
  const user = query.data || null;
  const role = user?.role as UserRole | null;
  const isAdmin = role === UserRole.ADMIN;
  const isManager = isAdmin || role === UserRole.MANAGER;
  const isClient = isManager || role === UserRole.CLIENT;
  return <UserRoleContext.Provider value={{ user, role, username: user?.username || null, isAdmin, isManager, isClient,
    isLoading: query.isPending, error: query.error,
    hasAccess: required => required === UserRole.ADMIN ? isAdmin : required === UserRole.MANAGER ? isManager : isClient,
  }}>{children}</UserRoleContext.Provider>;
}

export function useUserRole() {
  const context = useContext(UserRoleContext);
  if (!context) throw new Error("useUserRole must be used within UserRoleProvider");
  return context;
}
