import { useParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { ArrowLeft, Loader2, CheckCircle, XCircle, Clock, RefreshCw } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { Tables } from "@/integrations/supabase/types";

const txStatusConfig: Record<string, { color: string; icon: React.ElementType; label: string }> = {
  pending: { color: "bg-warning/10 text-warning border-warning/20", icon: Clock, label: "Pending" },
  processing: { color: "bg-primary/10 text-primary border-primary/20", icon: RefreshCw, label: "Processing" },
  completed: { color: "bg-success/10 text-success border-success/20", icon: CheckCircle, label: "Completed" },
  failed: { color: "bg-destructive/10 text-destructive border-destructive/20", icon: XCircle, label: "Failed" },
};

const batchStatusConfig: Record<string, string> = {
  pending: "bg-warning/10 text-warning border-warning/20",
  approved: "bg-info/10 text-info border-info/20",
  processing: "bg-primary/10 text-primary border-primary/20",
  completed: "bg-success/10 text-success border-success/20",
  partially_completed: "bg-warning/10 text-warning border-warning/20",
  failed: "bg-destructive/10 text-destructive border-destructive/20",
  cancelled: "bg-muted text-muted-foreground border-border",
};

const BatchDetail = () => {
  const { batchId } = useParams<{ batchId: string }>();
  const navigate = useNavigate();

  const { data: batch, isLoading: batchLoading } = useQuery({
    queryKey: ["batch", batchId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("batches")
        .select("*")
        .eq("id", batchId!)
        .single();
      if (error) throw error;
      return data as Tables<"batches">;
    },
    enabled: !!batchId,
  });

  const { data: transactions, isLoading: txLoading } = useQuery({
    queryKey: ["transactions", batchId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("transactions")
        .select("*")
        .eq("batch_id", batchId!)
        .order("row_number", { ascending: true });
      if (error) throw error;
      return data as Tables<"transactions">[];
    },
    enabled: !!batchId,
  });

  const isLoading = batchLoading || txLoading;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!batch) {
    return (
      <div className="space-y-4">
        <Button variant="ghost" size="sm" onClick={() => navigate("/batches")}>
          <ArrowLeft size={16} className="mr-2" /> Back to Batches
        </Button>
        <p className="text-muted-foreground text-center py-12">Batch not found.</p>
      </div>
    );
  }

  const completedCount = transactions?.filter((t) => t.status === "completed").length ?? 0;
  const failedCount = transactions?.filter((t) => t.status === "failed").length ?? 0;
  const pendingCount = transactions?.filter((t) => t.status === "pending" || t.status === "processing").length ?? 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => navigate("/batches")}>
          <ArrowLeft size={16} />
        </Button>
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight">
            {batch.batch_number} — {batch.name}
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {batch.total_records} records · ZMW {batch.total_amount.toLocaleString()} · Initiated by {batch.initiated_by || "—"}
          </p>
        </div>
        <Badge variant="outline" className={`ml-auto ${batchStatusConfig[batch.status] || ""}`}>
          {batch.status.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())}
        </Badge>
      </div>

      {/* Summary Cards */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="grid grid-cols-1 sm:grid-cols-3 gap-4"
      >
        <div className="rounded-xl border border-border bg-card p-4">
          <p className="text-xs font-medium text-muted-foreground">Completed</p>
          <p className="text-2xl font-bold text-success mt-1">{completedCount}</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-4">
          <p className="text-xs font-medium text-muted-foreground">Failed</p>
          <p className="text-2xl font-bold text-destructive mt-1">{failedCount}</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-4">
          <p className="text-xs font-medium text-muted-foreground">Pending / Processing</p>
          <p className="text-2xl font-bold text-warning mt-1">{pendingCount}</p>
        </div>
      </motion.div>

      {/* Transactions Table */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.05 }}
        className="rounded-xl border border-border bg-card overflow-hidden"
      >
        {!transactions || transactions.length === 0 ? (
          <div className="p-12 text-center text-muted-foreground text-sm">
            No transactions found for this batch.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs font-medium text-muted-foreground">
                  <th className="px-5 py-3">#</th>
                  <th className="px-5 py-3">Recipient</th>
                  <th className="px-5 py-3">Mobile</th>
                  <th className="px-5 py-3">Amount</th>
                  <th className="px-5 py-3">Reference</th>
                  <th className="px-5 py-3">MTN Txn ID</th>
                  <th className="px-5 py-3">Status</th>
                  <th className="px-5 py-3">Error</th>
                  <th className="px-5 py-3">Processed At</th>
                </tr>
              </thead>
              <tbody>
                {transactions.map((tx) => {
                  const cfg = txStatusConfig[tx.status] || txStatusConfig.pending;
                  const StatusIcon = cfg.icon;
                  return (
                    <tr key={tx.id} className="border-b border-border last:border-0 hover:bg-muted/50 transition-colors">
                      <td className="px-5 py-3 text-muted-foreground">{tx.row_number ?? "—"}</td>
                      <td className="px-5 py-3 font-medium">{tx.recipient_name}</td>
                      <td className="px-5 py-3 font-mono text-xs">{tx.mobile_number}</td>
                      <td className="px-5 py-3 font-semibold">ZMW {tx.amount.toLocaleString()}</td>
                      <td className="px-5 py-3 text-muted-foreground text-xs">{tx.reference || "—"}</td>
                      <td className="px-5 py-3 font-mono text-xs">{tx.mtn_transaction_id || "—"}</td>
                      <td className="px-5 py-3">
                        <Badge variant="outline" className={`gap-1 ${cfg.color}`}>
                          <StatusIcon size={12} />
                          {cfg.label}
                        </Badge>
                      </td>
                      <td className="px-5 py-3 text-xs text-destructive max-w-[200px] truncate" title={tx.error_message || ""}>
                        {tx.error_message || "—"}
                      </td>
                      <td className="px-5 py-3 text-xs text-muted-foreground">
                        {tx.processed_at ? new Date(tx.processed_at).toLocaleString() : "—"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </motion.div>
    </div>
  );
};

export default BatchDetail;
