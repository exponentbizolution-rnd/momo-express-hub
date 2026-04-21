import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { motion } from "framer-motion";
import { Shield, UserCog, Loader2, Info, History, ArrowRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { Database } from "@/integrations/supabase/types";

type AppRole = Database["public"]["Enums"]["app_role"];

interface UserWithRole {
  user_id: string;
  full_name: string;
  email: string;
  role: AppRole | null;
  role_id: string | null;
}

const ROLE_OPTIONS: { value: AppRole; label: string }[] = [
  { value: "super_admin", label: "Super Admin" },
  { value: "initiator", label: "Payment Initiator" },
  { value: "approver", label: "Payment Approver" },
  { value: "auditor", label: "Auditor" },
];

const roleLabel = (r: AppRole | null) =>
  r ? ROLE_OPTIONS.find((o) => o.value === r)?.label || r : "No role";

const roleBadgeClass: Record<AppRole, string> = {
  super_admin: "bg-destructive/10 text-destructive border-destructive/20",
  initiator: "bg-primary/10 text-primary border-primary/20",
  approver: "bg-info/10 text-info border-info/20",
  auditor: "bg-warning/10 text-warning border-warning/20",
};

interface PendingChange {
  user: UserWithRole;
  newRole: AppRole;
}

const UserManagement = () => {
  const { role: currentUserRole } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [pending, setPending] = useState<PendingChange | null>(null);

  const { data: users, isLoading } = useQuery({
    queryKey: ["admin-users"],
    queryFn: async () => {
      const { data: profiles, error: pErr } = await supabase
        .from("profiles")
        .select("user_id, full_name, email");
      if (pErr) throw pErr;

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
          email: p.email || "",
          role: (r?.role as AppRole) || null,
          role_id: r?.id || null,
        } as UserWithRole;
      });
    },
    enabled: currentUserRole === "super_admin",
  });

  const assignRole = useMutation({
    mutationFn: async ({
      user,
      newRole,
    }: {
      user: UserWithRole;
      newRole: AppRole;
    }) => {
      const previousRole = user.role;
      if (user.role_id) {
        const { error } = await supabase
          .from("user_roles")
          .update({ role: newRole })
          .eq("id", user.role_id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("user_roles")
          .insert({ user_id: user.user_id, role: newRole });
        if (error) throw error;
      }

      // action_type must match DB check constraint — use 'config'
      await supabase.from("audit_logs").insert({
        action: `Role changed: ${user.email || user.full_name} → ${roleLabel(newRole)}`,
        action_type: "config",
        user_name: "Super Admin",
        user_role: "super_admin",
        details: {
          target_user_id: user.user_id,
          target_email: user.email,
          previous_role: previousRole,
          new_role: newRole,
        },
      });
    },
    onSuccess: (_data, vars) => {
      queryClient.invalidateQueries({ queryKey: ["admin-users"] });
      toast({
        title: "Role updated",
        description: `${vars.user.email || vars.user.full_name} is now ${roleLabel(vars.newRole)}.`,
      });
      setPending(null);
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const restoreBwiso = () => {
    const target = users?.find((u) => u.email === "bwiso.daka@gmail.com");
    if (!target) {
      toast({
        title: "User not found",
        description: "bwiso.daka@gmail.com is not in the user list.",
        variant: "destructive",
      });
      return;
    }
    setPending({ user: target, newRole: "super_admin" });
  };

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
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold tracking-tight">User Management</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Assign and manage roles for all users
        </p>
      </div>

      {/* Help banner */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className="rounded-xl border border-info/20 bg-info/5 p-4 flex gap-3"
      >
        <Info size={18} className="text-info shrink-0 mt-0.5" />
        <div className="space-y-1 text-sm">
          <p className="font-medium text-foreground">
            Roles live in the database, not in the app code
          </p>
          <p className="text-muted-foreground">
            User roles are stored in our managed backend (Lovable Cloud). Editing
            files on your Linode server, redeploying the app, or restoring code
            versions will <span className="font-medium text-foreground">not</span> change
            anyone's role. The Linode server is only a network proxy for MTN MoMo API
            calls. Use this page (or the guided action below) to change roles safely.
          </p>
        </div>
      </motion.div>

      {/* Guided restore action */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className="rounded-xl border border-border bg-card p-5 flex flex-col sm:flex-row sm:items-center gap-4 justify-between"
      >
        <div className="flex gap-3">
          <History size={18} className="text-primary shrink-0 mt-0.5" />
          <div className="space-y-1 text-sm">
            <p className="font-medium text-foreground">Guided restore</p>
            <p className="text-muted-foreground">
              Quickly restore <span className="font-mono">bwiso.daka@gmail.com</span> to{" "}
              <span className="font-medium text-foreground">Super Admin</span>. You'll
              see the before/after values and confirm before the change is saved.
            </p>
          </div>
        </div>
        <Button onClick={restoreBwiso} className="shrink-0">
          Restore bwiso.daka to Super Admin
        </Button>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="rounded-xl border border-border bg-card"
      >
        <div className="p-5 border-b border-border flex items-center gap-2">
          <UserCog size={18} className="text-primary" />
          <h3 className="font-display text-base font-semibold">All Users</h3>
          {users && (
            <Badge variant="secondary" className="ml-auto">
              {users.length} users
            </Badge>
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
                  <tr
                    key={u.user_id}
                    className="border-b border-border last:border-0 hover:bg-muted/50 transition-colors"
                  >
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-3">
                        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
                          {u.full_name
                            .split(" ")
                            .map((n) => n[0])
                            .join("")
                            .toUpperCase()
                            .slice(0, 2)}
                        </div>
                        <div className="flex flex-col">
                          <span className="font-medium">{u.full_name}</span>
                          {u.email && (
                            <span className="text-xs text-muted-foreground">
                              {u.email}
                            </span>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-4">
                      {u.role ? (
                        <Badge variant="outline" className={roleBadgeClass[u.role]}>
                          {roleLabel(u.role)}
                        </Badge>
                      ) : (
                        <span className="text-muted-foreground text-xs">No role</span>
                      )}
                    </td>
                    <td className="px-5 py-4">
                      <Select
                        value={u.role || ""}
                        onValueChange={(val) =>
                          setPending({ user: u, newRole: val as AppRole })
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

      {/* Confirm dialog with before/after */}
      <Dialog open={!!pending} onOpenChange={(open) => !open && setPending(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirm role change</DialogTitle>
            <DialogDescription>
              Review the change below. This will be recorded in the audit log.
            </DialogDescription>
          </DialogHeader>

          {pending && (
            <div className="space-y-4">
              <div className="rounded-lg border border-border p-3 text-sm">
                <div className="font-medium">{pending.user.full_name}</div>
                {pending.user.email && (
                  <div className="text-xs text-muted-foreground">
                    {pending.user.email}
                  </div>
                )}
              </div>

              <div className="flex items-center justify-center gap-3">
                <div className="flex flex-col items-center gap-1">
                  <span className="text-xs text-muted-foreground">Before</span>
                  {pending.user.role ? (
                    <Badge
                      variant="outline"
                      className={roleBadgeClass[pending.user.role]}
                    >
                      {roleLabel(pending.user.role)}
                    </Badge>
                  ) : (
                    <Badge variant="outline">No role</Badge>
                  )}
                </div>
                <ArrowRight size={18} className="text-muted-foreground" />
                <div className="flex flex-col items-center gap-1">
                  <span className="text-xs text-muted-foreground">After</span>
                  <Badge
                    variant="outline"
                    className={roleBadgeClass[pending.newRole]}
                  >
                    {roleLabel(pending.newRole)}
                  </Badge>
                </div>
              </div>

              {pending.user.role === pending.newRole && (
                <p className="text-xs text-warning text-center">
                  This user already has this role.
                </p>
              )}
            </div>
          )}

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setPending(null)}
              disabled={assignRole.isPending}
            >
              Cancel
            </Button>
            <Button
              onClick={() => pending && assignRole.mutate(pending)}
              disabled={
                !pending ||
                assignRole.isPending ||
                pending.user.role === pending.newRole
              }
            >
              {assignRole.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  Saving...
                </>
              ) : (
                "Confirm change"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default UserManagement;
