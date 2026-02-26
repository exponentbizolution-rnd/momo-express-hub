import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Eye, CheckCircle, XCircle, Clock, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Tables } from "@/integrations/supabase/types";
import { useAuth } from "@/contexts/AuthContext";

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
  const { user, profile, role } = useAuth();
  const canApprove = role === "approver" || role === "super_admin";

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

  const updateStatus = useMutation({
    mutationFn: async ({ id, status, batch_number, initiator_user_id }: { id: string; status: string; batch_number: string; initiator_user_id: string | null }) => {
      // Enforce dual authorization: approver cannot be the same as initiator
      if (status === "approved" && initiator_user_id === user?.id) {
        throw new Error("You cannot approve a batch you initiated (dual authorization required)");
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
      </div>

      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="rounded-xl border border-border bg-card overflow-hidden"
      >
        {!batches || batches.length === 0 ? (
          <div className="p-12 text-center text-muted-foreground">
            <p className="text-sm">No batches yet. Upload a CSV file to create your first batch.</p>
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
                  return (
                    <tr key={batch.id} className="border-b border-border last:border-0 hover:bg-muted/50 transition-colors">
                      <td className="px-5 py-3 font-mono text-xs">{batch.batch_number}</td>
                      <td className="px-5 py-3 font-medium">{batch.name}</td>
                      <td className="px-5 py-3">{batch.valid_records.toLocaleString()}</td>
                      <td className="px-5 py-3 font-semibold">ZMW {batch.total_amount.toLocaleString()}</td>
                      <td className="px-5 py-3 text-muted-foreground">{batch.initiated_by || "—"}</td>
                      <td className="px-5 py-3 text-muted-foreground">{new Date(batch.created_at).toLocaleDateString()}</td>
                      <td className="px-5 py-3">
                        <Badge variant="outline" className={config.color}>
                          {batch.status.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())}
                        </Badge>
                      </td>
                      <td className="px-5 py-3">
                        <div className="flex gap-1">
                          <Button variant="ghost" size="sm" className="h-7 w-7 p-0">
                            <Eye size={14} />
                          </Button>
                          {batch.status === "pending" && canApprove && (
                            <>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-7 w-7 p-0 text-success hover:text-success"
                                onClick={() => updateStatus.mutate({ id: batch.id, status: "approved", batch_number: batch.batch_number, initiator_user_id: batch.initiator_user_id })}
                              >
                                <CheckCircle size={14} />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-7 w-7 p-0 text-destructive hover:text-destructive"
                                onClick={() => updateStatus.mutate({ id: batch.id, status: "cancelled", batch_number: batch.batch_number, initiator_user_id: batch.initiator_user_id })}
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
    </div>
  );
};

export default Batches;
