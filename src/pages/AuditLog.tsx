import { motion } from "framer-motion";
import { Badge } from "@/components/ui/badge";

const logs = [
  { time: "14:32:05", user: "John Mwale", role: "Initiator", action: "Uploaded batch B-2847", type: "upload" },
  { time: "14:28:12", user: "Sarah Banda", role: "Approver", action: "Approved batch B-2846", type: "approve" },
  { time: "14:15:00", user: "System", role: "System", action: "Batch B-2846 processing completed (850/850)", type: "system" },
  { time: "13:55:30", user: "Grace Tembo", role: "Initiator", action: "Submitted batch B-2844 for approval", type: "submit" },
  { time: "13:40:22", user: "Admin", role: "Super Admin", action: "Updated daily disbursement limit to ZMW 15M", type: "config" },
  { time: "13:12:10", user: "John Mwale", role: "Initiator", action: "Downloaded payment template", type: "download" },
  { time: "12:58:45", user: "Sarah Banda", role: "Approver", action: "Rejected batch B-2843 — insufficient funds", type: "reject" },
];

const typeColor: Record<string, string> = {
  upload: "bg-info/10 text-info border-info/20",
  approve: "bg-success/10 text-success border-success/20",
  system: "bg-muted text-muted-foreground border-border",
  submit: "bg-primary/10 text-primary border-primary/20",
  config: "bg-warning/10 text-warning border-warning/20",
  download: "bg-muted text-muted-foreground border-border",
  reject: "bg-destructive/10 text-destructive border-destructive/20",
};

const AuditLog = () => (
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
          {logs.map((log, i) => (
            <tr key={i} className="border-b border-border last:border-0 hover:bg-muted/50 transition-colors">
              <td className="px-5 py-3 font-mono text-xs text-muted-foreground">{log.time}</td>
              <td className="px-5 py-3 font-medium">{log.user}</td>
              <td className="px-5 py-3 text-muted-foreground">{log.role}</td>
              <td className="px-5 py-3">{log.action}</td>
              <td className="px-5 py-3">
                <Badge variant="outline" className={typeColor[log.type]}>
                  {log.type}
                </Badge>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </motion.div>
  </div>
);

export default AuditLog;
