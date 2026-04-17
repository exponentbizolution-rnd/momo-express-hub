import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { ArrowLeft, Loader2, CheckCircle, XCircle, Clock, RefreshCw, Undo2, History, ChevronDown, FileText } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { Tables } from "@/integrations/supabase/types";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { useState } from "react";
import TransactionTimeline from "@/components/TransactionTimeline";
import { useMtnEnvironment } from "@/hooks/useMtnEnvironment";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";

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
  const { user, profile, role } = useAuth();
  const canApprove = role === "approver" || role === "super_admin";
  const canRefund = canApprove;
  const { currency } = useMtnEnvironment();
  const [refundingTxId, setRefundingTxId] = useState<string | null>(null);
  const [timelineTxId, setTimelineTxId] = useState<string | null>(null);
  const [csvOpen, setCsvOpen] = useState(false);
  const [confirmAction, setConfirmAction] = useState<"approved" | "cancelled" | null>(null);
  const [selectedError, setSelectedError] = useState<string | null>(null);

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

  const { data: walletBalance } = useQuery({
    queryKey: ["wallet-balance"],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke("mtn-account-balance");
      if (error) throw error;
      return data as { success: boolean; availableBalance: number; currency: string };
    },
    retry: 1,
    staleTime: 60_000,
    enabled: canApprove && batch?.status === "pending",
  });

  const availableBalance = walletBalance?.success ? walletBalance.availableBalance : null;
  const walletCurrency = walletBalance?.currency || currency;
  const isBalanceUnavailable = canApprove && batch?.status === "pending" && !walletBalance?.success;

  const hasInsufficientBalance = (amount: number) =>
    availableBalance !== null && amount > availableBalance;

  const approveMutation = useMutation({
    mutationFn: async ({ status }: { status: "approved" | "cancelled" }) => {
      if (!batch) throw new Error("Batch not found");

      if (status === "approved" && batch.initiator_user_id === user?.id) {
        throw new Error("You cannot approve a batch you initiated (dual authorization required)");
      }
      if (status === "approved" && isBalanceUnavailable) {
        throw new Error("Cannot approve while wallet balance is unavailable. Retry in a moment.");
      }
      if (status === "approved" && hasInsufficientBalance(Number(batch.total_amount))) {
        throw new Error(
          `Insufficient wallet balance. Required ${walletCurrency} ${Number(batch.total_amount).toLocaleString()}, available ${walletCurrency} ${availableBalance?.toLocaleString()}`
        );
      }

      const { error } = await supabase.from("batches").update({
        status,
        approved_by: status === "approved" ? profile?.full_name : undefined,
        approver_user_id: status === "approved" ? user?.id : undefined,
        approved_at: status === "approved" ? new Date().toISOString() : undefined,
      }).eq("id", batch.id);
      if (error) throw error;

      await supabase.from("audit_logs").insert({
        action: `${status === "approved" ? "Approved" : "Rejected"} batch ${batch.batch_number}`,
        action_type: status === "approved" ? "approve" : "reject",
        user_name: profile?.full_name || "Unknown",
        user_role: role || "approver",
      });

      if (status === "approved") {
        const { error: fnError } = await supabase.functions.invoke("process-disbursements", {
          body: { batchId: batch.id },
        });
        if (fnError) {
          throw new Error("Batch approved but disbursement processing failed to start.");
        }
      }
    },
    onSuccess: (_, { status }) => {
      queryClient.invalidateQueries({ queryKey: ["batch", batchId] });
      queryClient.invalidateQueries({ queryKey: ["transactions", batchId] });
      queryClient.invalidateQueries({ queryKey: ["batches"] });
      queryClient.invalidateQueries({ queryKey: ["wallet-balance"] });
      toast.success(status === "approved" ? "Batch approved — disbursements are now processing" : "Batch rejected successfully");
    },
    onError: (err: Error) => toast.error(err.message),
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
    onMutate: (transactionId) => setRefundingTxId(transactionId),
    onSuccess: () => {
      toast.success("Refund completed successfully");
      queryClient.invalidateQueries({ queryKey: ["transactions", batchId] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-transactions"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-batches"] });
    },
    onError: (err: Error) => toast.error(err.message || "Refund failed"),
    onSettled: () => setRefundingTxId(null),
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
  const isPending = batch.status === "pending";
  const insufficientBalance = hasInsufficientBalance(Number(batch.total_amount));

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={() => navigate("/batches")}>
          <ArrowLeft size={16} />
        </Button>
        <div className="min-w-0 flex-1">
          <h1 className="font-display text-2xl font-bold tracking-tight">
            {batch.batch_number} — {batch.name}
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {batch.total_records} records · {currency} {batch.total_amount.toLocaleString()} · Initiated by {batch.initiated_by || "—"}
          </p>
          {canApprove && isPending && (
            <p className="text-xs text-muted-foreground mt-1">
              {availableBalance === null
                ? "Wallet balance unavailable right now."
                : `Available balance: ${walletCurrency} ${availableBalance.toLocaleString()}`}
            </p>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className={batchStatusConfig[batch.status] || ""}>
            {batch.status.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())}
          </Badge>
          {isPending && canApprove && (
            <>
              <Button
                size="sm"
                className="bg-success text-success-foreground hover:bg-success/90"
                disabled={approveMutation.isPending || insufficientBalance || !!isBalanceUnavailable}
                onClick={() => setConfirmAction("approved")}
              >
                {approveMutation.isPending && confirmAction === "approved" ? <Loader2 size={14} className="animate-spin mr-1" /> : <CheckCircle size={14} className="mr-1" />}
                Approve
              </Button>
              <Button
                size="sm"
                variant="destructive"
                disabled={approveMutation.isPending}
                onClick={() => setConfirmAction("cancelled")}
              >
                <XCircle size={14} className="mr-1" /> Reject
              </Button>
            </>
          )}
        </div>
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

      {/* CSV Content Viewer */}
      {batch.csv_content && (
        <Collapsible open={csvOpen} onOpenChange={setCsvOpen}>
          <CollapsibleTrigger asChild>
            <Button variant="outline" className="w-full justify-between">
              <span className="flex items-center gap-2">
                <FileText size={16} />
                Original CSV File {batch.file_name ? `— ${batch.file_name}` : ""}
              </span>
              <ChevronDown size={16} className={`transition-transform ${csvOpen ? "rotate-180" : ""}`} />
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <div className="mt-2 rounded-xl border border-border bg-muted/50 overflow-hidden">
              <div className="overflow-x-auto max-h-80">
                <pre className="p-4 text-xs font-mono text-foreground whitespace-pre">{batch.csv_content}</pre>
              </div>
            </div>
          </CollapsibleContent>
        </Collapsible>
      )}

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
                      <td className="px-5 py-3 text-xs text-destructive max-w-[250px]">
                        {tx.error_message ? (
                          <button
                            onClick={() => setSelectedError(tx.error_message)}
                            className="text-left max-w-[250px] truncate block hover:underline cursor-pointer"
                            title="Click to view full error"
                          >
                            {tx.error_message}
                          </button>
                        ) : "—"}
                      </td>
                      <td className="px-5 py-3 text-xs text-muted-foreground">
                        {tx.processed_at ? new Date(tx.processed_at).toLocaleString() : "—"}
                      </td>
                      <td className="px-5 py-3 flex items-center gap-1">
                        <Button variant="ghost" size="sm" className="h-7 px-2" onClick={() => setTimelineTxId(tx.id)}>
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

      {/* Confirmation Dialog */}
      <AlertDialog open={!!confirmAction} onOpenChange={(open) => !open && setConfirmAction(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {confirmAction === "approved" ? "Approve Batch?" : "Reject Batch?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {confirmAction === "approved"
                ? `This will approve batch ${batch?.batch_number} and trigger disbursements of ${currency} ${Number(batch?.total_amount).toLocaleString()} to ${batch?.total_records} recipients. This action cannot be undone.`
                : `This will reject batch ${batch?.batch_number}. The batch will be cancelled and no payments will be processed.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className={confirmAction === "approved" ? "bg-success text-success-foreground hover:bg-success/90" : "bg-destructive text-destructive-foreground hover:bg-destructive/90"}
              onClick={() => {
                if (confirmAction) {
                  approveMutation.mutate({ status: confirmAction });
                  setConfirmAction(null);
                }
              }}
            >
              {confirmAction === "approved" ? "Yes, Approve" : "Yes, Reject"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Error Detail Dialog */}
      <Dialog open={!!selectedError} onOpenChange={(open) => !open && setSelectedError(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-destructive">Error Details</DialogTitle>
          </DialogHeader>
          <ScrollArea className="max-h-[60vh]">
            <pre className="text-sm text-destructive whitespace-pre-wrap break-words font-mono bg-destructive/5 rounded-md p-4">
              {selectedError}
            </pre>
          </ScrollArea>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default BatchDetail;
