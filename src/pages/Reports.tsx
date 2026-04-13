import { useState, useMemo } from "react";
import { motion } from "framer-motion";
import { FileText, Download, Calendar as CalendarIcon, Loader2, Eye, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format, isWithinInterval, startOfDay, endOfDay, subDays, startOfMonth } from "date-fns";
import { cn } from "@/lib/utils";

type ReportKey = "payment_summary" | "transaction_detail" | "failed_transactions" | "reconciliation" | "audit_log";
type ExportFormat = "pdf" | "excel" | "csv";

interface ReportData {
  headers: string[];
  rows: (string | number)[][];
}

const reports: { name: string; description: string; type: string; key: ReportKey }[] = [
  { name: "Payment Summary", description: "Overview of all disbursements by period", type: "Summary", key: "payment_summary" },
  { name: "Transaction Detail", description: "Individual transaction records with MTN references", type: "Detail", key: "transaction_detail" },
  { name: "Failed Transactions", description: "All failed payments with error codes and retry status", type: "Detail", key: "failed_transactions" },
  { name: "Reconciliation Report", description: "Match processed payments against bank settlements", type: "Finance", key: "reconciliation" },
  { name: "Audit Log", description: "Complete trail of user actions and system events", type: "Compliance", key: "audit_log" },
];

// Date column index per report for filtering
const dateColumnIndex: Record<ReportKey, number> = {
  payment_summary: 7,
  transaction_detail: 6,
  failed_transactions: 7,
  reconciliation: 6,
  audit_log: 4,
};

const fetchReportData = async (key: ReportKey): Promise<ReportData> => {
  switch (key) {
    case "payment_summary": {
      const { data, error } = await supabase
        .from("batches")
        .select("batch_number, name, status, total_records, valid_records, error_records, total_amount, created_at, initiated_by, approved_by")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return {
        headers: ["Batch Number", "Name", "Status", "Total Records", "Valid", "Errors", "Total Amount (ZMW)", "Created", "Initiated By", "Approved By"],
        rows: (data || []).map(b => [b.batch_number, b.name, b.status, b.total_records, b.valid_records, b.error_records, b.total_amount, format(new Date(b.created_at), "yyyy-MM-dd HH:mm"), b.initiated_by || "", b.approved_by || ""]),
      };
    }
    case "transaction_detail": {
      const { data, error } = await supabase
        .from("transactions")
        .select("recipient_name, mobile_number, amount, status, reference, mtn_transaction_id, created_at, processed_at, description")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return {
        headers: ["Recipient", "Mobile", "Amount (ZMW)", "Status", "Reference", "MTN Txn ID", "Created", "Processed", "Description"],
        rows: (data || []).map(t => [t.recipient_name, t.mobile_number, t.amount, t.status, t.reference || "", t.mtn_transaction_id || "", format(new Date(t.created_at), "yyyy-MM-dd HH:mm"), t.processed_at ? format(new Date(t.processed_at), "yyyy-MM-dd HH:mm") : "", t.description || ""]),
      };
    }
    case "failed_transactions": {
      const { data, error } = await supabase
        .from("transactions")
        .select("recipient_name, mobile_number, amount, status, reference, error_message, retry_count, created_at")
        .in("status", ["failed", "error"])
        .order("created_at", { ascending: false });
      if (error) throw error;
      return {
        headers: ["Recipient", "Mobile", "Amount (ZMW)", "Status", "Reference", "Error Message", "Retry Count", "Created"],
        rows: (data || []).map(t => [t.recipient_name, t.mobile_number, t.amount, t.status, t.reference || "", t.error_message || "", t.retry_count, format(new Date(t.created_at), "yyyy-MM-dd HH:mm")]),
      };
    }
    case "reconciliation": {
      const { data, error } = await supabase
        .from("transactions")
        .select("recipient_name, mobile_number, amount, status, reference, mtn_transaction_id, processed_at")
        .in("status", ["completed", "failed"])
        .order("processed_at", { ascending: false });
      if (error) throw error;
      return {
        headers: ["Recipient", "Mobile", "Amount (ZMW)", "Status", "Reference", "MTN Txn ID", "Processed At"],
        rows: (data || []).map(t => [t.recipient_name, t.mobile_number, t.amount, t.status, t.reference || "", t.mtn_transaction_id || "", t.processed_at ? format(new Date(t.processed_at), "yyyy-MM-dd HH:mm") : ""]),
      };
    }
    case "audit_log": {
      const { data, error } = await supabase
        .from("audit_logs")
        .select("action_type, action, user_name, user_role, created_at, details")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return {
        headers: ["Action Type", "Action", "User", "Role", "Date", "Details"],
        rows: (data || []).map(a => [a.action_type, a.action, a.user_name || "", a.user_role || "", format(new Date(a.created_at), "yyyy-MM-dd HH:mm"), a.details ? JSON.stringify(a.details) : ""]),
      };
    }
  }
};

const downloadCSV = (headers: string[], rows: (string | number)[][], filename: string) => {
  const escape = (v: string | number) => {
    const s = String(v);
    return s.includes(",") || s.includes('"') || s.includes("\n") ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const csv = [headers.map(escape).join(","), ...rows.map(r => r.map(escape).join(","))].join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  triggerDownload(blob, `${filename}.csv`);
};

const downloadExcel = (headers: string[], rows: (string | number)[][], filename: string) => {
  const escape = (v: string | number) => String(v).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const html = `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel">
<head><meta charset="UTF-8"><!--[if gte mso 9]><xml><x:ExcelWorkbook><x:ExcelWorksheets><x:ExcelWorksheet><x:Name>Report</x:Name></x:ExcelWorksheet></x:ExcelWorksheets></x:ExcelWorkbook></xml><![endif]--></head>
<body><table border="1"><thead><tr>${headers.map(h => `<th style="background:#f0f0f0;font-weight:bold">${escape(h)}</th>`).join("")}</tr></thead>
<tbody>${rows.map(r => `<tr>${r.map(c => `<td>${escape(c)}</td>`).join("")}</tr>`).join("")}</tbody></table></body></html>`;
  const blob = new Blob([html], { type: "application/vnd.ms-excel" });
  triggerDownload(blob, `${filename}.xls`);
};

const downloadPDF = (headers: string[], rows: (string | number)[][], filename: string, title: string) => {
  const pageWidth = 842;
  const pageHeight = 595;
  const margin = 40;
  const lineHeight = 16;
  const colWidth = (pageWidth - 2 * margin) / headers.length;

  let pages: string[] = [];
  let currentY = margin + 40;
  let pageContent = "";

  const escPdf = (s: string) => s.replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
  const truncate = (s: string, max: number) => s.length > max ? s.slice(0, max - 2) + ".." : s;

  const startPage = () => {
    currentY = margin + 40;
    pageContent = "";
    pageContent += `BT /F1 14 Tf ${margin} ${pageHeight - margin - 14} Td (${escPdf(title)} - ${format(new Date(), "yyyy-MM-dd")}) Tj ET\n`;
    currentY = pageHeight - margin - 50;
    headers.forEach((h, i) => {
      pageContent += `BT /F1 8 Tf ${margin + i * colWidth + 2} ${currentY} Td (${escPdf(truncate(h, 20))}) Tj ET\n`;
    });
    currentY -= 4;
    pageContent += `${margin} ${currentY} m ${pageWidth - margin} ${currentY} l S\n`;
    currentY -= lineHeight;
  };

  startPage();

  rows.forEach((row) => {
    if (currentY < margin + 20) {
      pages.push(pageContent);
      startPage();
    }
    row.forEach((cell, i) => {
      const cellStr = truncate(String(cell), 25);
      pageContent += `BT /F1 7 Tf ${margin + i * colWidth + 2} ${currentY} Td (${escPdf(cellStr)}) Tj ET\n`;
    });
    currentY -= lineHeight;
  });
  pages.push(pageContent);

  let pdf = "%PDF-1.4\n";
  const objects: string[] = [];
  objects.push("1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj");
  objects.push("3 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj");

  const pageObjStart = 4;
  const pageObjs: number[] = [];

  pages.forEach((content, idx) => {
    const streamObjNum = pageObjStart + idx * 2;
    const pageObjNum = pageObjStart + idx * 2 + 1;
    pageObjs.push(pageObjNum);
    objects.push(`${streamObjNum} 0 obj\n<< /Length ${content.length} >>\nstream\n${content}endstream\nendobj`);
    objects.push(`${pageObjNum} 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pageWidth} ${pageHeight}] /Contents ${streamObjNum} 0 R /Resources << /Font << /F1 3 0 R >> >> >>\nendobj`);
  });

  const kidsStr = pageObjs.map(n => `${n} 0 R`).join(" ");
  objects.splice(1, 0, `2 0 obj\n<< /Type /Pages /Kids [${kidsStr}] /Count ${pages.length} >>\nendobj`);

  const offsets: number[] = [];
  let pdfBody = "";
  objects.forEach(obj => {
    offsets.push(pdf.length + pdfBody.length);
    pdfBody += obj + "\n";
  });

  pdf += pdfBody;
  const xrefOffset = pdf.length;
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  offsets.forEach(o => { pdf += `${String(o).padStart(10, "0")} 00000 n \n`; });
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;

  const blob = new Blob([pdf], { type: "application/pdf" });
  triggerDownload(blob, `${filename}.pdf`);
};

const triggerDownload = (blob: Blob, filename: string) => {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};

const Reports = () => {
  const [loading, setLoading] = useState<string | null>(null);
  const [dateFrom, setDateFrom] = useState<Date | undefined>();
  const [dateTo, setDateTo] = useState<Date | undefined>();
  const [previewData, setPreviewData] = useState<{ report: typeof reports[0]; data: ReportData } | null>(null);
  const [previewLoading, setPreviewLoading] = useState<string | null>(null);

  const dateLabel = useMemo(() => {
    if (dateFrom && dateTo) return `${format(dateFrom, "MMM d")} – ${format(dateTo, "MMM d, yyyy")}`;
    if (dateFrom) return `From ${format(dateFrom, "MMM d, yyyy")}`;
    if (dateTo) return `Until ${format(dateTo, "MMM d, yyyy")}`;
    return "Date Range";
  }, [dateFrom, dateTo]);

  const filterByDate = (rows: (string | number)[][], reportKey: ReportKey) => {
    if (!dateFrom && !dateTo) return rows;
    const idx = dateColumnIndex[reportKey];
    return rows.filter(row => {
      const val = String(row[idx]);
      if (!val) return false;
      const d = new Date(val);
      if (isNaN(d.getTime())) return false;
      if (dateFrom && dateTo) {
        return isWithinInterval(d, { start: startOfDay(dateFrom), end: endOfDay(dateTo) });
      }
      if (dateFrom) return d >= startOfDay(dateFrom);
      if (dateTo) return d <= endOfDay(dateTo);
      return true;
    });
  };

  const handleDownload = async (report: typeof reports[0], fmt: ExportFormat) => {
    const loadingKey = `${report.key}-${fmt}`;
    setLoading(loadingKey);
    try {
      const { headers, rows } = await fetchReportData(report.key);
      const filtered = filterByDate(rows, report.key);
      if (filtered.length === 0) {
        toast.info("No data available for this report in the selected date range");
        return;
      }
      const filename = `${report.key}_${format(new Date(), "yyyyMMdd_HHmm")}`;
      switch (fmt) {
        case "csv": downloadCSV(headers, filtered, filename); break;
        case "excel": downloadExcel(headers, filtered, filename); break;
        case "pdf": downloadPDF(headers, filtered, filename, report.name); break;
      }
      toast.success(`${report.name} downloaded as ${fmt.toUpperCase()} (${filtered.length} rows)`);
    } catch (err: any) {
      toast.error(`Download failed: ${err.message}`);
    } finally {
      setLoading(null);
    }
  };

  const handlePreview = async (report: typeof reports[0]) => {
    setPreviewLoading(report.key);
    try {
      const data = await fetchReportData(report.key);
      data.rows = filterByDate(data.rows, report.key);
      setPreviewData({ report, data });
    } catch (err: any) {
      toast.error(`Preview failed: ${err.message}`);
    } finally {
      setPreviewLoading(null);
    }
  };

  const clearDates = () => { setDateFrom(undefined); setDateTo(undefined); };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight">Reports</h1>
          <p className="text-sm text-muted-foreground mt-1">Generate, preview, and download reports</p>
        </div>
        <div className="flex gap-2 items-center">
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" className={cn("gap-2", (dateFrom || dateTo) && "border-primary text-primary")}>
                <CalendarIcon size={14} />
                {dateLabel}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="end">
              <div className="p-3 space-y-3">
                {/* Quick presets */}
                <div className="flex flex-wrap gap-1.5">
                  {[
                    { label: "Today", from: new Date(), to: new Date() },
                    { label: "Last 7 days", from: subDays(new Date(), 6), to: new Date() },
                    { label: "Last 30 days", from: subDays(new Date(), 29), to: new Date() },
                    { label: "This month", from: startOfMonth(new Date()), to: new Date() },
                  ].map(preset => (
                    <Button
                      key={preset.label}
                      variant="outline"
                      size="sm"
                      className="text-xs h-7"
                      onClick={() => { setDateFrom(preset.from); setDateTo(preset.to); }}
                    >
                      {preset.label}
                    </Button>
                  ))}
                </div>
                <div className="border-t border-border pt-3">
                  <p className="text-xs font-medium text-muted-foreground mb-1.5">From</p>
                  <Calendar
                    mode="single"
                    selected={dateFrom}
                    onSelect={setDateFrom}
                    className={cn("p-2 pointer-events-auto")}
                    disabled={(date) => dateTo ? date > dateTo : false}
                  />
                </div>
                <div className="border-t border-border pt-3">
                  <p className="text-xs font-medium text-muted-foreground mb-1.5">To</p>
                  <Calendar
                    mode="single"
                    selected={dateTo}
                    onSelect={setDateTo}
                    className={cn("p-2 pointer-events-auto")}
                    disabled={(date) => dateFrom ? date < dateFrom : false}
                  />
                </div>
                {(dateFrom || dateTo) && (
                  <Button variant="ghost" size="sm" className="w-full gap-1.5" onClick={clearDates}>
                    <X size={14} /> Clear dates
                  </Button>
                )}
              </div>
            </PopoverContent>
          </Popover>
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
            <div className="flex flex-wrap gap-2 mt-4">
              <Button
                variant="ghost"
                size="sm"
                className="gap-1.5 text-xs"
                disabled={!!loading || !!previewLoading}
                onClick={() => handlePreview(report)}
              >
                {previewLoading === report.key ? <Loader2 size={12} className="animate-spin" /> : <Eye size={12} />}
                Preview
              </Button>
              {(["pdf", "excel", "csv"] as ExportFormat[]).map(fmt => {
                const isLoading = loading === `${report.key}-${fmt}`;
                return (
                  <Button
                    key={fmt}
                    variant="outline"
                    size="sm"
                    className="flex-1 min-w-[60px] gap-1.5 text-xs"
                    disabled={!!loading || !!previewLoading}
                    onClick={() => handleDownload(report, fmt)}
                  >
                    {isLoading ? <Loader2 size={12} className="animate-spin" /> : <Download size={12} />}
                    {fmt.toUpperCase()}
                  </Button>
                );
              })}
            </div>
          </motion.div>
        ))}
      </div>

      {/* Preview Dialog */}
      <Dialog open={!!previewData} onOpenChange={(open) => !open && setPreviewData(null)}>
        <DialogContent className="max-w-4xl max-h-[85vh] w-[95vw] sm:w-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {previewData?.report.name}
              <Badge variant="outline" className="text-xs font-normal">
                {previewData?.data.rows.length} rows
              </Badge>
              {(dateFrom || dateTo) && (
                <Badge variant="secondary" className="text-xs font-normal">
                  {dateLabel}
                </Badge>
              )}
            </DialogTitle>
          </DialogHeader>
          <ScrollArea className="max-h-[60vh]">
            {previewData && previewData.data.rows.length === 0 ? (
              <div className="py-12 text-center text-muted-foreground text-sm">
                No data found for the selected date range.
              </div>
            ) : previewData ? (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="sticky top-0 bg-card z-10">
                    <tr className="border-b border-border text-left text-xs font-medium text-muted-foreground">
                      {previewData.data.headers.map((h, i) => (
                        <th key={i} className="px-3 py-2 whitespace-nowrap">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {previewData.data.rows.map((row, ri) => (
                      <tr key={ri} className="border-b border-border last:border-0 hover:bg-muted/50 transition-colors">
                        {row.map((cell, ci) => (
                          <td key={ci} className="px-3 py-2 text-xs max-w-[200px] truncate" title={String(cell)}>
                            {String(cell)}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : null}
          </ScrollArea>
          {previewData && previewData.data.rows.length > 0 && (
            <div className="flex justify-end gap-2 pt-2 border-t border-border">
              {(["csv", "excel", "pdf"] as ExportFormat[]).map(fmt => (
                <Button
                  key={fmt}
                  variant="outline"
                  size="sm"
                  className="gap-1.5 text-xs"
                  onClick={() => handleDownload(previewData.report, fmt)}
                >
                  <Download size={12} /> {fmt.toUpperCase()}
                </Button>
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Reports;
