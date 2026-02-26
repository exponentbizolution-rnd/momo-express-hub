import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { motion } from "framer-motion";
import { Shield, UserCog, Loader2, ChevronDown } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Database } from "@/integrations/supabase/types";

type AppRole = Database["public"]["Enums"]["app_role"];

interface UserWithRole {
  user_id: string;
  full_name: string;
  role: AppRole | null;
  role_id: string | null;
}

const ROLE_OPTIONS: { value: AppRole; label: string }[] = [
  { value: "super_admin", label: "Super Admin" },
  { value: "initiator", label: "Payment Initiator" },
  { value: "approver", label: "Payment Approver" },
  { value: "auditor", label: "Auditor" },
];

const roleBadgeClass: Record<AppRole, string> = {
  super_admin: "bg-destructive/10 text-destructive border-destructive/20",
  initiator: "bg-primary/10 text-primary border-primary/20",
  approver: "bg-info/10 text-info border-info/20",
  auditor: "bg-warning/10 text-warning border-warning/20",
};

const UserManagement = () => {
  const { role: currentUserRole } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: users, isLoading } = useQuery({
    queryKey: ["admin-users"],
    queryFn: async () => {
      // Fetch all profiles (super_admin RLS allows this)
      const { data: profiles, error: pErr } = await supabase
        .from("profiles")
        .select("user_id, full_name");
      if (pErr) throw pErr;

      // Fetch all roles
      const { data: roles, error: rErr } = await supabase
        .from("user_roles")
        .select("id, user_id, role");
      if (rErr) throw rErr;

      const roleMap = new Map(roles?.map((r) => [r.user_id, r]) || []);

      return (profiles || []).map((p) => {
        const r = roleMap.get(p.user_id);
        return {
          user_id: p.user_id,
          full_name: p.full_name || "Unnamed User",
          role: (r?.role as AppRole) || null,
          role_id: r?.id || null,
        } as UserWithRole;
      });
    },
    enabled: currentUserRole === "super_admin",
  });

  const assignRole = useMutation({
    mutationFn: async ({ userId, newRole, existingRoleId }: { userId: string; newRole: AppRole; existingRoleId: string | null }) => {
      if (existingRoleId) {
        const { error } = await supabase
          .from("user_roles")
          .update({ role: newRole })
          .eq("id", existingRoleId);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("user_roles")
          .insert({ user_id: userId, role: newRole });
        if (error) throw error;
      }

      // Log the action
      await supabase.from("audit_logs").insert({
        action: `Role changed to ${newRole}`,
        action_type: "role_change",
        user_name: "Super Admin",
        user_role: "super_admin",
        details: { target_user_id: userId, new_role: newRole },
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-users"] });
      toast({ title: "Role updated", description: "User role has been updated successfully." });
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  if (currentUserRole !== "super_admin") {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
        <Shield size={48} className="mb-4 opacity-30" />
        <p className="text-lg font-medium">Access Denied</p>
        <p className="text-sm">Only Super Admins can manage user roles.</p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-display text-2xl font-bold tracking-tight">User Management</h1>
        <p className="text-sm text-muted-foreground mt-1">Assign and manage roles for all users</p>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="rounded-xl border border-border bg-card"
      >
        <div className="p-5 border-b border-border flex items-center gap-2">
          <UserCog size={18} className="text-primary" />
          <h3 className="font-display text-base font-semibold">All Users</h3>
          {users && (
            <Badge variant="secondary" className="ml-auto">{users.length} users</Badge>
          )}
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : !users || users.length === 0 ? (
          <div className="p-8 text-center text-sm text-muted-foreground">
            No users found.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs font-medium text-muted-foreground">
                  <th className="px-5 py-3">User</th>
                  <th className="px-5 py-3">Current Role</th>
                  <th className="px-5 py-3">Change Role</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.user_id} className="border-b border-border last:border-0 hover:bg-muted/50 transition-colors">
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-3">
                        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
                          {u.full_name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2)}
                        </div>
                        <span className="font-medium">{u.full_name}</span>
                      </div>
                    </td>
                    <td className="px-5 py-4">
                      {u.role ? (
                        <Badge variant="outline" className={roleBadgeClass[u.role]}>
                          {ROLE_OPTIONS.find((r) => r.value === u.role)?.label || u.role}
                        </Badge>
                      ) : (
                        <span className="text-muted-foreground text-xs">No role</span>
                      )}
                    </td>
                    <td className="px-5 py-4">
                      <Select
                        value={u.role || ""}
                        onValueChange={(val) =>
                          assignRole.mutate({
                            userId: u.user_id,
                            newRole: val as AppRole,
                            existingRoleId: u.role_id,
                          })
                        }
                      >
                        <SelectTrigger className="w-[180px] h-9">
                          <SelectValue placeholder="Assign role" />
                        </SelectTrigger>
                        <SelectContent>
                          {ROLE_OPTIONS.map((opt) => (
                            <SelectItem key={opt.value} value={opt.value}>
                              {opt.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </motion.div>
    </div>
  );
};

export default UserManagement;
