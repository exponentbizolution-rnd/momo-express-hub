import { useQuery } from "@tanstack/react-query";
import {
  Banknote,
  Users,
  Clock,
  CheckCircle,
  Activity,
  Wallet,
} from "lucide-react";
import { motion } from "framer-motion";
import StatCard from "@/components/StatCard";
import BatchProgressCard from "@/components/BatchProgressCard";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { supabase } from "@/integrations/supabase/client";
import { useEffect, useState } from "react";
import { Tables } from "@/integrations/supabase/types";
import { useMtnEnvironment } from "@/hooks/useMtnEnvironment";

const statusColor: Record<string, string> = {
  completed: "text-success",
  success: "text-success",
  failed: "text-destructive",
  pending: "text-warning",
  processing: "text-info",
  retrying: "text-warning",
};

const Dashboard = () => {
  const [realtimeBatches, setRealtimeBatches] = useState<Tables<"batches">[]>([]);
  const { currency } = useMtnEnvironment();

  // Fetch batches
  const { data: batches } = useQuery({
    queryKey: ["dashboard-batches"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("batches")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(20);
      if (error) throw error;
      return data;
    },
  });

  // Fetch recent transactions
  const { data: recentTx } = useQuery({
    queryKey: ["dashboard-transactions"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("transactions")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(10);
      if (error) throw error;
      return data;
    },
  });

  // Fetch stats
  const { data: stats } = useQuery({
    queryKey: ["dashboard-stats"],
    queryFn: async () => {
      const { count: totalTx } = await supabase
        .from("transactions")
        .select("*", { count: "exact", head: true });

      const { count: successCount } = await supabase
        .from("transactions")
        .select("*", { count: "exact", head: true })
        .eq("status", "completed");

      const { count: pendingBatches } = await supabase
        .from("batches")
        .select("*", { count: "exact", head: true })
        .eq("status", "pending");

      const { data: amountData } = await supabase
        .from("batches")
        .select("total_amount");

      const totalDisbursed = amountData?.reduce((sum, b) => sum + (b.total_amount || 0), 0) || 0;
      const successRate = totalTx && totalTx > 0
        ? ((successCount || 0) / totalTx * 100).toFixed(1)
        : "—";

      return {
        totalDisbursed,
        totalTx: totalTx || 0,
        pendingBatches: pendingBatches || 0,
        successRate,
      };
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
    refetchInterval: 60_000,
  });

  // Realtime subscription for batches
  useEffect(() => {
    if (batches) setRealtimeBatches(batches);
  }, [batches]);

  useEffect(() => {
    const channel = supabase
      .channel("dashboard-batches-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "batches" }, () => {
        supabase
          .from("batches")
          .select("*")
          .order("created_at", { ascending: false })
          .limit(20)
          .then(({ data }) => {
            if (data) setRealtimeBatches(data);
          });
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  const activeBatches = realtimeBatches.filter((b) =>
    ["processing", "completed", "partially_completed"].includes(b.status)
  );

  const formatAmount = (amount: number) => {
    if (amount >= 1000000) return `${currency} ${(amount / 1000000).toFixed(1)}M`;
    if (amount >= 1000) return `${currency} ${(amount / 1000).toFixed(0)}K`;
    return `${currency} ${amount.toLocaleString()}`;
  };

  const formatWalletBalance = () => {
    if (!walletBalance?.success) return "Unavailable";
    return `${walletBalance.currency} ${walletBalance.availableBalance.toLocaleString()}`;
  };

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-display text-2xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-sm text-muted-foreground mt-1">Overview of your payment operations</p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <StatCard
          title="Total Disbursed"
          value={stats ? formatAmount(stats.totalDisbursed) : "—"}
          subtitle={stats ? `${stats.totalTx.toLocaleString()} transactions` : ""}
          icon={Banknote}
          variant="primary"
        />
        <StatCard
          title="Wallet Balance"
          value={formatWalletBalance()}
          subtitle="Live MTN account balance"
          icon={Wallet}
          variant="accent"
        />
        <StatCard
          title="Pending Batches"
          value={stats?.pendingBatches.toString() || "0"}
          subtitle="Awaiting approval"
          icon={Clock}
        />
        <StatCard
          title="Success Rate"
          value={stats?.successRate ? `${stats.successRate}%` : "—"}
          subtitle="All time"
          icon={CheckCircle}
        />
        <StatCard
          title="Total Batches"
          value={realtimeBatches.length.toString()}
          subtitle="All time"
          icon={Users}
        />
      </div>

      {/* Active Batches */}
      {activeBatches.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-3"
        >
          <div className="flex items-center gap-2">
            <Activity size={14} className="text-success animate-pulse-slow" />
            <h3 className="font-display text-base font-semibold">Active Batches</h3>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {activeBatches.slice(0, 3).map((batch) => (
              <BatchProgressCard
                key={batch.id}
                id={batch.batch_number}
                name={batch.name}
                total={batch.total_records}
                processed={batch.valid_records}
                failed={batch.error_records}
                status={batch.status as "processing" | "completed" | "partially_completed"}
              />
            ))}
          </div>
        </motion.div>
      )}

      {/* Recent Transactions */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="rounded-xl border border-border bg-card"
      >
        <div className="p-5 border-b border-border">
          <h3 className="font-display text-base font-semibold">Recent Transactions</h3>
          <p className="text-xs text-muted-foreground">Latest disbursements across all batches</p>
        </div>
        {!recentTx || recentTx.length === 0 ? (
          <div className="p-8 text-center text-sm text-muted-foreground">
            No transactions yet. Upload a CSV to get started.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs font-medium text-muted-foreground">
                  <th className="px-5 py-3">Recipient</th>
                  <th className="px-5 py-3">Phone</th>
                  <th className="px-5 py-3">Amount</th>
                  <th className="px-5 py-3">Status</th>
                  <th className="px-5 py-3">Time</th>
                </tr>
              </thead>
              <tbody>
                {recentTx.map((tx) => (
                  <tr key={tx.id} className="border-b border-border last:border-0 hover:bg-muted/50 transition-colors">
                    <td className="px-5 py-3 font-medium">{tx.recipient_name}</td>
                    <td className="px-5 py-3 text-muted-foreground">{tx.mobile_number}</td>
                    <td className="px-5 py-3 font-semibold">{currency} {tx.amount.toLocaleString()}</td>
                    <td className={`px-5 py-3 font-medium ${statusColor[tx.status] || ""}`}>
                      {tx.status.charAt(0).toUpperCase() + tx.status.slice(1)}
                    </td>
                    <td className="px-5 py-3 text-muted-foreground">
                      {new Date(tx.created_at).toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </motion.div>

      {/* API Health */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="rounded-xl border border-border bg-card p-5"
      >
        <h3 className="font-display text-base font-semibold mb-3">MTN MoMo API Status</h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {[
            { name: "Disbursement API", status: "Operational", latency: "142ms" },
            { name: "Account Validation", status: "Operational", latency: "89ms" },
            { name: "Transfer Status", status: "Operational", latency: "105ms" },
          ].map((api) => (
            <div key={api.name} className="flex items-center gap-3 rounded-lg bg-muted/50 px-4 py-3">
              <div className={`h-2.5 w-2.5 rounded-full ${api.status === "Operational" ? "bg-success" : "bg-warning animate-pulse-slow"}`} />
              <div>
                <p className="text-sm font-medium">{api.name}</p>
                <p className="text-xs text-muted-foreground">{api.status} · {api.latency}</p>
              </div>
            </div>
          ))}
        </div>
      </motion.div>
    </div>
  );
};

export default Dashboard;
