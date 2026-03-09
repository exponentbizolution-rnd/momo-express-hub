import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { ArrowLeft, Loader2, CheckCircle, XCircle, Clock, RefreshCw, Undo2, History } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { Tables } from "@/integrations/supabase/types";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { useState } from "react";
import TransactionTimeline from "@/components/TransactionTimeline";
import { useMtnEnvironment } from "@/hooks/useMtnEnvironment";

const txStatusConfig: Record<string, { color: string; icon: React.ElementType; label: string }> = {
  pending: { color: "bg-warning/10 text-warning border-warning/20", icon: Clock, label: "Pending" },
  processing: { color: "bg-primary/10 text-primary border-primary/20", icon: RefreshCw, label: "Processing" },
  completed: { color: "bg-success/10 text-success border-success/20", icon: CheckCircle, label: "Completed" },
  failed: { color: "bg-destructive/10 text-destructive border-destructive/20", icon: XCircle, label: "Failed" },
  refund_processing: { color: "bg-info/10 text-info border-info/20", icon: RefreshCw, label: "Refund Processing" },
  refunded: { color: "bg-success/10 text-success border-success/20", icon: CheckCircle, label: "Refunded" },
  refund_failed: { color: "bg-destructive/10 text-destructive border-destructive/20", icon: XCircle, label: "Refund Failed" },
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
  const queryClient = useQueryClient();
  const { profile, role } = useAuth();
  const canRefund = role === "approver" || role === "super_admin";
  const { currency } = useMtnEnvironment();
  const [refundingTxId, setRefundingTxId] = useState<string | null>(null);
  const [timelineTxId, setTimelineTxId] = useState<string | null>(null);

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

  const refundMutation = useMutation({
    mutationFn: async (transactionId: string) => {
      const { data, error } = await supabase.functions.invoke("process-refund", {
        body: {
          transactionId,
          requestedBy: profile?.full_name || "Unknown",
          requestedRole: role || "approver",
        },
      });

      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || "Refund failed");
      return data;
    },
    onMutate: (transactionId) => {
      setRefundingTxId(transactionId);
    },
    onSuccess: () => {
      toast.success("Refund completed successfully");
      queryClient.invalidateQueries({ queryKey: ["transactions", batchId] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-transactions"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-batches"] });
    },
    onError: (err: Error) => {
      toast.error(err.message || "Refund failed");
    },
    onSettled: () => {
      setRefundingTxId(null);
    },
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

  const completedCount = transactions?.filter((t) => ["completed", "refunded"].includes(t.status)).length ?? 0;
  const failedCount = transactions?.filter((t) => ["failed", "refund_failed"].includes(t.status)).length ?? 0;
  const pendingCount = transactions?.filter((t) => ["pending", "processing", "refund_processing"].includes(t.status)).length ?? 0;

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
            {batch.total_records} records · {currency} {batch.total_amount.toLocaleString()} · Initiated by {batch.initiated_by || "—"}
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
          <p className="text-xs font-medium text-muted-foreground">Completed / Refunded</p>
          <p className="text-2xl font-bold text-success mt-1">{completedCount}</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-4">
          <p className="text-xs font-medium text-muted-foreground">Failed / Refund Failed</p>
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
                  <th className="px-5 py-3">Actions</th>
                </tr>
              </thead>
              <tbody>
                {transactions.map((tx) => {
                  const cfg = txStatusConfig[tx.status] || txStatusConfig.pending;
                  const StatusIcon = cfg.icon;
                  const canTriggerRefund = canRefund && ["failed", "refund_failed"].includes(tx.status) && !!tx.mtn_transaction_id;

                  return (
                    <tr key={tx.id} className="border-b border-border last:border-0 hover:bg-muted/50 transition-colors">
                      <td className="px-5 py-3 text-muted-foreground">{tx.row_number ?? "—"}</td>
                      <td className="px-5 py-3 font-medium">{tx.recipient_name}</td>
                      <td className="px-5 py-3 font-mono text-xs">{tx.mobile_number}</td>
                      <td className="px-5 py-3 font-semibold">{currency} {tx.amount.toLocaleString()}</td>
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
                      <td className="px-5 py-3 flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 px-2"
                          onClick={() => setTimelineTxId(tx.id)}
                        >
                          <History size={14} className="mr-1" /> History
                        </Button>
                        {canTriggerRefund && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 px-2 text-warning hover:text-warning"
                            disabled={refundMutation.isPending}
                            onClick={() => refundMutation.mutate(tx.id)}
                          >
                            {refundingTxId === tx.id ? (
                              <Loader2 size={14} className="animate-spin" />
                            ) : (
                              <>
                                <Undo2 size={14} className="mr-1" /> Refund
                              </>
                            )}
                          </Button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </motion.div>

      {/* Timeline Sheet */}
      <TransactionTimeline
        transactionId={timelineTxId || ""}
        batchId={batchId || ""}
        open={!!timelineTxId}
        onOpenChange={(open) => !open && setTimelineTxId(null)}
      />
    </div>
  );
};

export default BatchDetail;
