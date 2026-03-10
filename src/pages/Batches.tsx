import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Eye, CheckCircle, XCircle, Clock, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Tables } from "@/integrations/supabase/types";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import { useMtnEnvironment } from "@/hooks/useMtnEnvironment";
import { useState } from "react";
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

const statusConfig: Record<string, { color: string; icon: React.ElementType }> = {
  pending: { color: "bg-warning/10 text-warning border-warning/20", icon: Clock },
  approved: { color: "bg-info/10 text-info border-info/20", icon: CheckCircle },
  processing: { color: "bg-primary/10 text-primary border-primary/20", icon: Clock },
  completed: { color: "bg-success/10 text-success border-success/20", icon: CheckCircle },
  partially_completed: { color: "bg-warning/10 text-warning border-warning/20", icon: CheckCircle },
  failed: { color: "bg-destructive/10 text-destructive border-destructive/20", icon: XCircle },
  cancelled: { color: "bg-muted text-muted-foreground border-border", icon: XCircle },
};

const Batches = () => {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { user, profile, role } = useAuth();
  const canApprove = role === "approver" || role === "super_admin";
  const { currency } = useMtnEnvironment();
  const [confirmBatch, setConfirmBatch] = useState<{ batch: Tables<"batches">; status: "approved" | "cancelled" } | null>(null);

  const { data: batches, isLoading } = useQuery({
    queryKey: ["batches"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("batches")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as Tables<"batches">[];
    },
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
  });

  const availableBalance = walletBalance?.success ? walletBalance.availableBalance : null;
  const walletCurrency = walletBalance?.currency || "ZMW";
  const isBalanceUnavailable = !walletBalance?.success;

  const hasInsufficientBalance = (amount: number) =>
    availableBalance !== null && amount > availableBalance;

  const updateStatus = useMutation({
    mutationFn: async ({
      id,
      status,
      batch_number,
      initiator_user_id,
      total_amount,
    }: {
      id: string;
      status: string;
      batch_number: string;
      initiator_user_id: string | null;
      total_amount: number;
    }) => {
      // Enforce dual authorization: approver cannot be the same as initiator
      if (status === "approved" && initiator_user_id === user?.id) {
        throw new Error("You cannot approve a batch you initiated (dual authorization required)");
      }

      if (status === "approved" && isBalanceUnavailable) {
        throw new Error("Cannot approve while wallet balance is unavailable. Retry in a moment.");
      }

      if (status === "approved" && hasInsufficientBalance(total_amount)) {
        throw new Error(
          `Insufficient wallet balance. Required ${walletCurrency} ${total_amount.toLocaleString()}, available ${walletCurrency} ${availableBalance?.toLocaleString()}`,
        );
      }

      const { error } = await supabase.from("batches").update({
        status,
        approved_by: status === "approved" ? profile?.full_name : undefined,
        approver_user_id: status === "approved" ? user?.id : undefined,
        approved_at: status === "approved" ? new Date().toISOString() : undefined,
      }).eq("id", id);
      if (error) throw error;

      await supabase.from("audit_logs").insert({
        action: `${status === "approved" ? "Approved" : "Rejected"} batch ${batch_number}`,
        action_type: status === "approved" ? "approve" : "reject",
        user_name: profile?.full_name || "Unknown",
        user_role: role || "approver",
      });

      // Automatically trigger disbursements after approval
      if (status === "approved") {
        const { data, error: fnError } = await supabase.functions.invoke("process-disbursements", {
          body: { batchId: id },
        });
        if (fnError) {
          console.error("Disbursement trigger error:", fnError);
          throw new Error("Batch approved but disbursement processing failed to start. Check logs.");
        }
        return data;
      }
    },
    onSuccess: (_, { status }) => {
      queryClient.invalidateQueries({ queryKey: ["batches"] });
      queryClient.invalidateQueries({ queryKey: ["wallet-balance"] });
      if (status === "approved") {
        toast.success("Batch approved — disbursements are now processing");
      } else {
        toast.success("Batch rejected successfully");
      }
    },
    onError: (err: Error) => toast.error(err.message),
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
        <h1 className="font-display text-2xl font-bold tracking-tight">Batch Management</h1>
        <p className="text-sm text-muted-foreground mt-1">Review, approve, and track payment batches</p>
        {canApprove && (
          <p className="text-xs text-muted-foreground mt-2">
            {availableBalance === null
              ? "Wallet balance unavailable right now."
              : `Available wallet balance: ${walletCurrency} ${availableBalance.toLocaleString()}`}
          </p>
        )}
      </div>

      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="rounded-xl border border-border bg-card overflow-hidden"
      >
        {!batches || batches.length === 0 ? (
          <div className="p-12 text-center text-muted-foreground">
            <p className="text-sm">
              {canApprove
                ? "No pending batches. Batches uploaded by initiators will appear here for your review and approval."
                : "No batches yet. Upload a CSV file to create your first batch."}
            </p>
          </div>
        ) : (
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
                  const config = statusConfig[batch.status] || statusConfig.pending;
                  const insufficientBalance = hasInsufficientBalance(Number(batch.total_amount));

                  return (
                    <tr key={batch.id} className="border-b border-border last:border-0 hover:bg-muted/50 transition-colors">
                      <td className="px-5 py-3 font-mono text-xs">{batch.batch_number}</td>
                      <td className="px-5 py-3 font-medium">{batch.name}</td>
                      <td className="px-5 py-3">{batch.valid_records.toLocaleString()}</td>
                      <td className="px-5 py-3 font-semibold">{currency} {batch.total_amount.toLocaleString()}</td>
                      <td className="px-5 py-3 text-muted-foreground">{batch.initiated_by || "—"}</td>
                      <td className="px-5 py-3 text-muted-foreground">{new Date(batch.created_at).toLocaleDateString()}</td>
                      <td className="px-5 py-3">
                        <Badge variant="outline" className={config.color}>
                          {batch.status.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())}
                        </Badge>
                      </td>
                      <td className="px-5 py-3">
                        <div className="flex gap-1">
                          <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => navigate(`/batches/${batch.id}`)}>
                            <Eye size={14} />
                          </Button>
                          {batch.status === "pending" && canApprove && (
                            <>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-7 w-7 p-0 text-success hover:text-success"
                                disabled={updateStatus.isPending || insufficientBalance || isBalanceUnavailable}
                                title={insufficientBalance ? "Insufficient wallet balance" : isBalanceUnavailable ? "Wallet balance unavailable" : "Approve"}
                                onClick={() => {
                                  if (isBalanceUnavailable) {
                                    toast.error("Wallet balance is unavailable right now. Please retry in a moment.");
                                    return;
                                  }
                                  if (insufficientBalance) {
                                    toast.error(
                                      `Insufficient wallet balance for ${batch.batch_number}. Required ${walletCurrency} ${Number(batch.total_amount).toLocaleString()}.`,
                                    );
                                    return;
                                  }
                                  setConfirmBatch({ batch, status: "approved" });
                                }}
                              >
                                <CheckCircle size={14} />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-7 w-7 p-0 text-destructive hover:text-destructive"
                                disabled={updateStatus.isPending}
                                onClick={() => setConfirmBatch({ batch, status: "cancelled" })}
                              >
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
        )}
      </motion.div>

      {/* Confirmation Dialog */}
      <AlertDialog open={!!confirmBatch} onOpenChange={(open) => !open && setConfirmBatch(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {confirmBatch?.status === "approved" ? "Approve Batch?" : "Reject Batch?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {confirmBatch?.status === "approved"
                ? `This will approve batch ${confirmBatch?.batch.batch_number} and trigger disbursements of ${currency} ${Number(confirmBatch?.batch.total_amount).toLocaleString()} to ${confirmBatch?.batch.total_records} recipients. This action cannot be undone.`
                : `This will reject batch ${confirmBatch?.batch.batch_number}. The batch will be cancelled and no payments will be processed.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className={confirmBatch?.status === "approved" ? "bg-success text-success-foreground hover:bg-success/90" : "bg-destructive text-destructive-foreground hover:bg-destructive/90"}
              onClick={() => {
                if (confirmBatch) {
                  updateStatus.mutate({
                    id: confirmBatch.batch.id,
                    status: confirmBatch.status,
                    batch_number: confirmBatch.batch.batch_number,
                    initiator_user_id: confirmBatch.batch.initiator_user_id,
                    total_amount: Number(confirmBatch.batch.total_amount),
                  });
                  setConfirmBatch(null);
                }
              }}
            >
              {confirmBatch?.status === "approved" ? "Yes, Approve" : "Yes, Reject"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default Batches;
