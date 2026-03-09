import { motion } from "framer-motion";
import { FileText, Download, Calendar, Filter } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

const reports = [
  { name: "Payment Summary", description: "Overview of all disbursements by period", type: "Summary" },
  { name: "Transaction Detail", description: "Individual transaction records with MTN references", type: "Detail" },
  { name: "Failed Transactions", description: "All failed payments with error codes and retry status", type: "Detail" },
  { name: "Reconciliation Report", description: "Match processed payments against bank settlements", type: "Finance" },
  { name: "Audit Log", description: "Complete trail of user actions and system events", type: "Compliance" },
];

const Reports = () => (
  <div className="space-y-6">
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
      <div>
        <h1 className="font-display text-2xl font-bold tracking-tight">Reports</h1>
        <p className="text-sm text-muted-foreground mt-1">Generate, download, and schedule reports</p>
      </div>
      <div className="flex gap-2">
        <Button variant="outline" size="sm" className="gap-2">
          <Calendar size={14} /> Date Range
        </Button>
        <Button variant="outline" size="sm" className="gap-2">
          <Filter size={14} /> Filters
        </Button>
      </div>
    </div>

    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {reports.map((report, i) => (
        <motion.div
          key={report.name}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: i * 0.05 }}
          className="rounded-xl border border-border bg-card p-5 flex flex-col justify-between"
        >
          <div>
            <div className="flex items-start justify-between mb-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted">
                <FileText size={18} className="text-muted-foreground" />
              </div>
              <Badge variant="outline">{report.type}</Badge>
            </div>
            <h3 className="font-display text-sm font-semibold mb-1">{report.name}</h3>
            <p className="text-xs text-muted-foreground">{report.description}</p>
          </div>
          <div className="flex gap-2 mt-4">
            <Button variant="outline" size="sm" className="flex-1 gap-1.5 text-xs">
              <Download size={12} /> PDF
            </Button>
            <Button variant="outline" size="sm" className="flex-1 gap-1.5 text-xs">
              <Download size={12} /> Excel
            </Button>
            <Button variant="outline" size="sm" className="flex-1 gap-1.5 text-xs">
              <Download size={12} /> CSV
            </Button>
          </div>
        </motion.div>
      ))}
    </div>
  </div>
);

export default Reports;
