import {
  DollarSign,
  Users,
  Clock,
  CheckCircle,
  Activity,
  TrendingUp,
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

const chartData = [
  { day: "Mon", amount: 124000 },
  { day: "Tue", amount: 89000 },
  { day: "Wed", amount: 215000 },
  { day: "Thu", amount: 178000 },
  { day: "Fri", amount: 302000 },
  { day: "Sat", amount: 56000 },
  { day: "Sun", amount: 41000 },
];

const activeBatches = [
  { id: "2847", name: "January Salaries", total: 4500, processed: 3200, failed: 12, status: "processing" as const },
  { id: "2846", name: "Vendor Payments Q1", total: 850, processed: 850, failed: 3, status: "completed" as const },
  { id: "2845", name: "Field Agent Stipends", total: 2100, processed: 1890, failed: 45, status: "partially_completed" as const },
];

const recentTransactions = [
  { recipient: "Grace Banda", phone: "260975XXXXXX", amount: "ZMW 2,500.00", status: "Success", time: "2 min ago" },
  { recipient: "Peter Mulenga", phone: "260966XXXXXX", amount: "ZMW 1,800.00", status: "Success", time: "3 min ago" },
  { recipient: "Mary Phiri", phone: "260955XXXXXX", amount: "ZMW 3,200.00", status: "Failed", time: "5 min ago" },
  { recipient: "David Tembo", phone: "260977XXXXXX", amount: "ZMW 950.00", status: "Success", time: "7 min ago" },
  { recipient: "Joyce Mumba", phone: "260966XXXXXX", amount: "ZMW 4,100.00", status: "Pending", time: "8 min ago" },
];

const statusColor: Record<string, string> = {
  Success: "text-success",
  Failed: "text-destructive",
  Pending: "text-warning",
};

const Dashboard = () => {
  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-display text-2xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-sm text-muted-foreground mt-1">Overview of your payment operations</p>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Disbursed Today"
          value="ZMW 1.2M"
          subtitle="4,312 transactions"
          icon={DollarSign}
          trend={{ value: "12% vs yesterday", positive: true }}
          variant="primary"
        />
        <StatCard
          title="Pending Batches"
          value="7"
          subtitle="Awaiting approval"
          icon={Clock}
          trend={{ value: "3 new today", positive: false }}
        />
        <StatCard
          title="Success Rate"
          value="97.8%"
          subtitle="Last 7 days"
          icon={CheckCircle}
          trend={{ value: "0.5% improvement", positive: true }}
        />
        <StatCard
          title="Active Recipients"
          value="12,450"
          subtitle="This month"
          icon={Users}
          trend={{ value: "890 new", positive: true }}
        />
      </div>

      {/* Charts + Active Batches */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="col-span-2 rounded-xl border border-border bg-card p-5"
        >
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h3 className="font-display text-base font-semibold">Disbursement Trend</h3>
              <p className="text-xs text-muted-foreground">Weekly payment volume (ZMW)</p>
            </div>
            <div className="flex items-center gap-1.5 text-xs text-success font-medium">
              <TrendingUp size={14} /> +18.2% this week
            </div>
          </div>
          <ResponsiveContainer width="100%" height={260}>
            <AreaChart data={chartData}>
              <defs>
                <linearGradient id="colorAmount" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="hsl(152, 100%, 30%)" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="hsl(152, 100%, 30%)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(210, 20%, 90%)" />
              <XAxis dataKey="day" tick={{ fontSize: 12 }} stroke="hsl(210, 15%, 50%)" />
              <YAxis tick={{ fontSize: 12 }} stroke="hsl(210, 15%, 50%)" tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
              <Tooltip
                contentStyle={{
                  backgroundColor: "hsl(0, 0%, 100%)",
                  border: "1px solid hsl(210, 20%, 90%)",
                  borderRadius: "8px",
                  fontSize: "12px",
                }}
                formatter={(value: number) => [`ZMW ${value.toLocaleString()}`, "Amount"]}
              />
              <Area
                type="monotone"
                dataKey="amount"
                stroke="hsl(152, 100%, 30%)"
                strokeWidth={2}
                fillOpacity={1}
                fill="url(#colorAmount)"
              />
            </AreaChart>
          </ResponsiveContainer>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="space-y-3"
        >
          <div className="flex items-center justify-between">
            <h3 className="font-display text-base font-semibold">Active Batches</h3>
            <div className="flex items-center gap-1.5">
              <Activity size={14} className="text-success animate-pulse-slow" />
              <span className="text-xs text-muted-foreground">Live</span>
            </div>
          </div>
          {activeBatches.map((batch) => (
            <BatchProgressCard key={batch.id} {...batch} />
          ))}
        </motion.div>
      </div>

      {/* Recent Transactions */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className="rounded-xl border border-border bg-card"
      >
        <div className="p-5 border-b border-border">
          <h3 className="font-display text-base font-semibold">Recent Transactions</h3>
          <p className="text-xs text-muted-foreground">Latest disbursements across all batches</p>
        </div>
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
              {recentTransactions.map((tx, i) => (
                <tr key={i} className="border-b border-border last:border-0 hover:bg-muted/50 transition-colors">
                  <td className="px-5 py-3 font-medium">{tx.recipient}</td>
                  <td className="px-5 py-3 text-muted-foreground">{tx.phone}</td>
                  <td className="px-5 py-3 font-semibold">{tx.amount}</td>
                  <td className={`px-5 py-3 font-medium ${statusColor[tx.status]}`}>{tx.status}</td>
                  <td className="px-5 py-3 text-muted-foreground">{tx.time}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </motion.div>

      {/* API Health */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.35 }}
        className="rounded-xl border border-border bg-card p-5"
      >
        <h3 className="font-display text-base font-semibold mb-3">MTN MoMo API Status</h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {[
            { name: "Disbursement API", status: "Operational", latency: "142ms" },
            { name: "Account Validation", status: "Operational", latency: "89ms" },
            { name: "Transfer Status", status: "Degraded", latency: "1.2s" },
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
