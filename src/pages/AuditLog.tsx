import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { Badge } from "@/components/ui/badge";
import { Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

const typeColor: Record<string, string> = {
  upload: "bg-info/10 text-info border-info/20",
  approve: "bg-success/10 text-success border-success/20",
  system: "bg-muted text-muted-foreground border-border",
  submit: "bg-primary/10 text-primary border-primary/20",
  config: "bg-warning/10 text-warning border-warning/20",
  download: "bg-muted text-muted-foreground border-border",
  reject: "bg-destructive/10 text-destructive border-destructive/20",
  login: "bg-info/10 text-info border-info/20",
  logout: "bg-muted text-muted-foreground border-border",
};

const AuditLog = () => {
  const { data: logs, isLoading } = useQuery({
    queryKey: ["audit_logs"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("audit_logs")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      return data;
    },
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold tracking-tight">Audit Log</h1>
        <p className="text-sm text-muted-foreground mt-1">Complete trail of all system actions and events</p>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="rounded-xl border border-border bg-card overflow-hidden"
      >
        {!logs || logs.length === 0 ? (
          <div className="p-12 text-center text-muted-foreground">
            <p className="text-sm">No audit events recorded yet.</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs font-medium text-muted-foreground">
                <th className="px-5 py-3">Time</th>
                <th className="px-5 py-3">User</th>
                <th className="px-5 py-3">Role</th>
                <th className="px-5 py-3">Action</th>
                <th className="px-5 py-3">Type</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((log) => (
                <tr key={log.id} className="border-b border-border last:border-0 hover:bg-muted/50 transition-colors">
                  <td className="px-5 py-3 font-mono text-xs text-muted-foreground">
                    {new Date(log.created_at).toLocaleString()}
                  </td>
                  <td className="px-5 py-3 font-medium">{log.user_name || "System"}</td>
                  <td className="px-5 py-3 text-muted-foreground">{log.user_role || "—"}</td>
                  <td className="px-5 py-3">{log.action}</td>
                  <td className="px-5 py-3">
                    <Badge variant="outline" className={typeColor[log.action_type] || typeColor.system}>
                      {log.action_type}
                    </Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </motion.div>
    </div>
  );
};

export default AuditLog;
