import { useQuery } from "@tanstack/react-query";
import { Send, RefreshCw, Undo2, XCircle, CheckCircle, Clock, Loader2 } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { supabase } from "@/integrations/supabase/client";
import { Tables } from "@/integrations/supabase/types";

interface TransactionTimelineProps {
  transactionId: string;
  batchId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const actionIcons: Record<string, React.ElementType> = {
  disbursement_initiated: Send,
  disbursement_processing: RefreshCw,
  disbursement_completed: CheckCircle,
  disbursement_failed: XCircle,
  refund_initiated: Undo2,
  refund_processing: RefreshCw,
  refund_completed: CheckCircle,
  refund_failed: XCircle,
  batch_approved: CheckCircle,
  batch_rejected: XCircle,
  retry: RefreshCw,
};

const actionColors: Record<string, string> = {
  disbursement_initiated: "text-primary",
  disbursement_processing: "text-info",
  disbursement_completed: "text-success",
  disbursement_failed: "text-destructive",
  refund_initiated: "text-warning",
  refund_processing: "text-info",
  refund_completed: "text-success",
  refund_failed: "text-destructive",
  batch_approved: "text-success",
  batch_rejected: "text-destructive",
  retry: "text-warning",
};

const TransactionTimeline = ({
  transactionId,
  batchId,
  open,
  onOpenChange,
}: TransactionTimelineProps) => {
  const { data: timeline, isLoading } = useQuery({
    queryKey: ["tx-timeline", transactionId, batchId],
    queryFn: async () => {
      // Query audit logs that match this transaction or batch
      const { data, error } = await supabase
        .from("audit_logs")
        .select("*")
        .order("created_at", { ascending: true });

      if (error) throw error;

      // Filter client-side for JSONB field matching
      const filtered = (data as Tables<"audit_logs">[]).filter((log) => {
        const details = log.details as Record<string, unknown> | null;
        if (!details) return false;
        return (
          details.transactionId === transactionId ||
          details.batchId === batchId
        );
      });

      return filtered;
    },
    enabled: open,
  });

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-[400px] sm:w-[540px]">
        <SheetHeader>
          <SheetTitle>Transaction History</SheetTitle>
        </SheetHeader>

        <div className="mt-6">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : !timeline || timeline.length === 0 ? (
            <div className="text-center text-muted-foreground py-12 text-sm">
              No history found for this transaction.
            </div>
          ) : (
            <div className="relative">
              {/* Vertical line */}
              <div className="absolute left-4 top-2 bottom-2 w-px bg-border" />

              <div className="space-y-4">
                {timeline.map((event, index) => {
                  const Icon = actionIcons[event.action_type] || Clock;
                  const color = actionColors[event.action_type] || "text-muted-foreground";
                  const details = event.details as Record<string, unknown> | null;

                  return (
                    <div key={event.id} className="relative flex gap-4 pl-2">
                      {/* Icon circle */}
                      <div
                        className={`relative z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-background border border-border ${color}`}
                      >
                        <Icon size={16} />
                      </div>

                      {/* Content */}
                      <div className="flex-1 min-w-0 pb-4">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-sm">
                            {event.action}
                          </span>
                        </div>
                        <div className="text-xs text-muted-foreground mt-0.5">
                          {new Date(event.created_at).toLocaleString()}
                        </div>
                        {event.user_name && (
                          <div className="text-xs text-muted-foreground mt-1">
                            By: {event.user_name} ({event.user_role})
                          </div>
                        )}
                        {details?.status && (
                          <div className="text-xs mt-1">
                            Status: <span className="font-medium">{String(details.status)}</span>
                          </div>
                        )}
                        {details?.error && (
                          <div className="text-xs text-destructive mt-1 max-w-full truncate" title={String(details.error)}>
                            Error: {String(details.error)}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
};

export default TransactionTimeline;
