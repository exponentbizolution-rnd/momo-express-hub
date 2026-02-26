import { motion } from "framer-motion";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Eye, CheckCircle, XCircle, Clock } from "lucide-react";

const batches = [
  { id: "B-2847", name: "January Salaries", records: 4500, total: "ZMW 8,450,000", initiator: "John Mwale", status: "processing", date: "2026-02-26" },
  { id: "B-2846", name: "Vendor Payments Q1", records: 850, total: "ZMW 2,120,000", initiator: "Sarah Banda", status: "completed", date: "2026-02-25" },
  { id: "B-2845", name: "Field Agent Stipends", records: 2100, total: "ZMW 1,890,000", initiator: "John Mwale", status: "pending", date: "2026-02-25" },
  { id: "B-2844", name: "Supplier Refunds", records: 340, total: "ZMW 780,000", initiator: "Grace Tembo", status: "approved", date: "2026-02-24" },
  { id: "B-2843", name: "Bonus Payments Feb", records: 1200, total: "ZMW 3,600,000", initiator: "John Mwale", status: "failed", date: "2026-02-24" },
  { id: "B-2842", name: "December Reimbursements", records: 560, total: "ZMW 1,250,000", initiator: "Sarah Banda", status: "cancelled", date: "2026-02-23" },
];

const statusConfig: Record<string, { color: string; icon: React.ElementType }> = {
  pending: { color: "bg-warning/10 text-warning border-warning/20", icon: Clock },
  approved: { color: "bg-info/10 text-info border-info/20", icon: CheckCircle },
  processing: { color: "bg-primary/10 text-primary border-primary/20", icon: Clock },
  completed: { color: "bg-success/10 text-success border-success/20", icon: CheckCircle },
  failed: { color: "bg-destructive/10 text-destructive border-destructive/20", icon: XCircle },
  cancelled: { color: "bg-muted text-muted-foreground border-border", icon: XCircle },
};

const Batches = () => (
  <div className="space-y-6">
    <div>
      <h1 className="font-display text-2xl font-bold tracking-tight">Batch Management</h1>
      <p className="text-sm text-muted-foreground mt-1">Review, approve, and track payment batches</p>
    </div>

    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-xl border border-border bg-card overflow-hidden"
    >
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-left text-xs font-medium text-muted-foreground">
              <th className="px-5 py-3">Batch ID</th>
              <th className="px-5 py-3">Name</th>
              <th className="px-5 py-3">Records</th>
              <th className="px-5 py-3">Total</th>
              <th className="px-5 py-3">Initiated By</th>
              <th className="px-5 py-3">Date</th>
              <th className="px-5 py-3">Status</th>
              <th className="px-5 py-3">Actions</th>
            </tr>
          </thead>
          <tbody>
            {batches.map((batch) => {
              const config = statusConfig[batch.status];
              return (
                <tr key={batch.id} className="border-b border-border last:border-0 hover:bg-muted/50 transition-colors">
                  <td className="px-5 py-3 font-mono text-xs">{batch.id}</td>
                  <td className="px-5 py-3 font-medium">{batch.name}</td>
                  <td className="px-5 py-3">{batch.records.toLocaleString()}</td>
                  <td className="px-5 py-3 font-semibold">{batch.total}</td>
                  <td className="px-5 py-3 text-muted-foreground">{batch.initiator}</td>
                  <td className="px-5 py-3 text-muted-foreground">{batch.date}</td>
                  <td className="px-5 py-3">
                    <Badge variant="outline" className={config.color}>
                      {batch.status.charAt(0).toUpperCase() + batch.status.slice(1)}
                    </Badge>
                  </td>
                  <td className="px-5 py-3">
                    <div className="flex gap-1">
                      <Button variant="ghost" size="sm" className="h-7 w-7 p-0">
                        <Eye size={14} />
                      </Button>
                      {batch.status === "pending" && (
                        <>
                          <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-success hover:text-success">
                            <CheckCircle size={14} />
                          </Button>
                          <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-destructive hover:text-destructive">
                            <XCircle size={14} />
                          </Button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </motion.div>
  </div>
);

export default Batches;
