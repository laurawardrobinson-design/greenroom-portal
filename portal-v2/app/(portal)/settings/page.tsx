"use client";

import { useState } from "react";
import useSWR from "swr";
import type { AppUser } from "@/types/domain";
import { useCurrentUser } from "@/hooks/use-current-user";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { DashboardSkeleton } from "@/components/ui/loading-skeleton";
import { Settings, Shield, User, Users } from "lucide-react";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

const ROLE_COLORS: Record<string, string> = {
  Admin: "bg-purple-50 text-purple-700",
  Producer: "bg-blue-50 text-blue-700",
  Studio: "bg-teal-50 text-teal-700",
  Vendor: "bg-amber-50 text-amber-700",
};

const ALL_ROLES = ["Admin", "Producer", "Studio", "Vendor"];

export default function SettingsPage() {
  const { user, isLoading: loadingUser } = useCurrentUser();
  const isAdmin = user?.role === "Admin";

  // Fetch all users (including inactive) for admin — use no filter
  const { data: users, isLoading: loadingUsers, mutate } = useSWR<AppUser[]>(
    isAdmin ? "/api/users?roles=Admin,Producer,Studio,Vendor" : null,
    fetcher
  );

  if (loadingUser) return <DashboardSkeleton />;

  return (
    <div className="space-y-6">
      <h2 className="text-lg font-semibold text-text-primary">Settings</h2>

      {/* Profile section */}
      <Card>
        <CardHeader>
          <CardTitle>
            <User className="h-4 w-4" />
            My Profile
          </CardTitle>
        </CardHeader>
        {user && (
          <dl className="space-y-3 text-sm">
            <div className="flex justify-between">
              <dt className="text-text-tertiary">Name</dt>
              <dd className="font-medium text-text-primary">{user.name}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-text-tertiary">Email</dt>
              <dd className="text-text-primary">{user.email}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-text-tertiary">Role</dt>
              <dd>
                <Badge variant="custom" className={ROLE_COLORS[user.role] || ""}>
                  {user.role}
                </Badge>
              </dd>
            </div>
            {user.title && (
              <div className="flex justify-between">
                <dt className="text-text-tertiary">Title</dt>
                <dd className="text-text-primary">{user.title}</dd>
              </div>
            )}
          </dl>
        )}
      </Card>

      {/* Dev mode indicator */}
      {process.env.NEXT_PUBLIC_DEV_AUTH === "true" && (
        <Card>
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-amber-50 text-amber-600">
              <Settings className="h-4.5 w-4.5" />
            </div>
            <div>
              <p className="text-sm font-medium text-text-primary">Development Mode</p>
              <p className="text-xs text-text-tertiary">
                Dev authentication is enabled — use the login page to switch between roles.
              </p>
            </div>
          </div>
        </Card>
      )}

      {/* User management (Admin only) */}
      {isAdmin && (
        <Card>
          <CardHeader>
            <CardTitle>
              <Shield className="h-4 w-4" />
              User Management
            </CardTitle>
          </CardHeader>
          {loadingUsers ? (
            <DashboardSkeleton />
          ) : users && users.length > 0 ? (
            <div className="space-y-1">
              {/* Table header */}
              <div className="grid grid-cols-12 gap-3 px-3 py-2 text-[10px] font-medium uppercase tracking-wider text-text-tertiary">
                <div className="col-span-4">User</div>
                <div className="col-span-3">Email</div>
                <div className="col-span-2">Role</div>
                <div className="col-span-1">Status</div>
                <div className="col-span-2 text-right">Actions</div>
              </div>
              {users.map((u) => (
                <UserRow
                  key={u.id}
                  appUser={u}
                  isCurrentUser={u.id === user?.id}
                  onUpdated={mutate}
                />
              ))}
            </div>
          ) : (
            <div className="flex items-center gap-2 text-sm text-text-tertiary">
              <Users className="h-4 w-4" />
              No users found
            </div>
          )}
        </Card>
      )}
    </div>
  );
}

function UserRow({
  appUser,
  isCurrentUser,
  onUpdated,
}: {
  appUser: AppUser;
  isCurrentUser: boolean;
  onUpdated: () => void;
}) {
  const { toast } = useToast();
  const [updating, setUpdating] = useState(false);

  async function handleRoleChange(newRole: string) {
    setUpdating(true);
    try {
      const res = await fetch("/api/users", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: appUser.id, role: newRole }),
      });
      if (!res.ok) throw new Error("Failed");
      toast("success", `${appUser.name} is now ${newRole}`);
      onUpdated();
    } catch {
      toast("error", "Failed to update role");
    } finally {
      setUpdating(false);
    }
  }

  async function handleToggleActive() {
    setUpdating(true);
    try {
      const res = await fetch("/api/users", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: appUser.id, active: !appUser.active }),
      });
      if (!res.ok) throw new Error("Failed");
      toast("success", `${appUser.name} ${appUser.active ? "deactivated" : "activated"}`);
      onUpdated();
    } catch {
      toast("error", "Failed to update status");
    } finally {
      setUpdating(false);
    }
  }

  return (
    <div
      className={`grid grid-cols-12 items-center gap-3 rounded-lg px-3 py-2.5 transition-colors ${
        isCurrentUser ? "bg-primary/5" : "hover:bg-surface-secondary"
      }`}
    >
      <div className="col-span-4">
        <p className="text-sm font-medium text-text-primary truncate">
          {appUser.name}
          {isCurrentUser && (
            <span className="ml-1.5 text-[10px] text-text-tertiary">(you)</span>
          )}
        </p>
        {appUser.title && (
          <p className="text-xs text-text-tertiary truncate">{appUser.title}</p>
        )}
      </div>
      <div className="col-span-3">
        <p className="text-xs text-text-secondary truncate">{appUser.email}</p>
      </div>
      <div className="col-span-2">
        <select
          value={appUser.role}
          onChange={(e) => handleRoleChange(e.target.value)}
          disabled={updating || isCurrentUser}
          className="h-7 w-full rounded border border-border bg-surface px-1.5 text-xs font-medium text-text-primary focus:outline-none focus:ring-1 focus:ring-primary disabled:opacity-50"
        >
          {ALL_ROLES.map((r) => (
            <option key={r} value={r}>{r}</option>
          ))}
        </select>
      </div>
      <div className="col-span-1">
        <Badge
          variant="custom"
          className={
            appUser.active
              ? "bg-emerald-50 text-emerald-700"
              : "bg-red-50 text-red-600"
          }
        >
          {appUser.active ? "Active" : "Inactive"}
        </Badge>
      </div>
      <div className="col-span-2 text-right">
        {!isCurrentUser && (
          <Button
            size="sm"
            variant="ghost"
            loading={updating}
            onClick={handleToggleActive}
            className="text-xs"
          >
            {appUser.active ? "Deactivate" : "Activate"}
          </Button>
        )}
      </div>
    </div>
  );
}
