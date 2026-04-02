import { useState } from "react";
import { motion } from "framer-motion";
import { FileText, Download, Calendar, Filter, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format } from "date-fns";

type ReportKey = "payment_summary" | "transaction_detail" | "failed_transactions" | "reconciliation" | "audit_log";
type ExportFormat = "pdf" | "excel" | "csv";

const reports: { name: string; description: string; type: string; key: ReportKey }[] = [
  { name: "Payment Summary", description: "Overview of all disbursements by period", type: "Summary", key: "payment_summary" },
  { name: "Transaction Detail", description: "Individual transaction records with MTN references", type: "Detail", key: "transaction_detail" },
  { name: "Failed Transactions", description: "All failed payments with error codes and retry status", type: "Detail", key: "failed_transactions" },
  { name: "Reconciliation Report", description: "Match processed payments against bank settlements", type: "Finance", key: "reconciliation" },
  { name: "Audit Log", description: "Complete trail of user actions and system events", type: "Compliance", key: "audit_log" },
];

const fetchReportData = async (key: ReportKey) => {
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
  // Generate a simple HTML table that Excel can open
  const escape = (v: string | number) => String(v).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const html = `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel">
<head><meta charset="UTF-8"><!--[if gte mso 9]><xml><x:ExcelWorkbook><x:ExcelWorksheets><x:ExcelWorksheet><x:Name>Report</x:Name></x:ExcelWorksheet></x:ExcelWorksheets></x:ExcelWorkbook></xml><![endif]--></head>
<body><table border="1"><thead><tr>${headers.map(h => `<th style="background:#f0f0f0;font-weight:bold">${escape(h)}</th>`).join("")}</tr></thead>
<tbody>${rows.map(r => `<tr>${r.map(c => `<td>${escape(c)}</td>`).join("")}</tr>`).join("")}</tbody></table></body></html>`;
  const blob = new Blob([html], { type: "application/vnd.ms-excel" });
  triggerDownload(blob, `${filename}.xls`);
};

const downloadPDF = (headers: string[], rows: (string | number)[][], filename: string, title: string) => {
  const pageWidth = 842; // A4 landscape
  const pageHeight = 595;
  const margin = 40;
  const lineHeight = 16;
  const headerHeight = 20;
  const colWidth = (pageWidth - 2 * margin) / headers.length;
  const rowsPerPage = Math.floor((pageHeight - margin * 2 - 60) / lineHeight);

  let pages: string[] = [];
  let currentY = margin + 40;
  let pageContent = "";

  const escPdf = (s: string) => s.replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
  const truncate = (s: string, max: number) => s.length > max ? s.slice(0, max - 2) + ".." : s;

  const startPage = () => {
    currentY = margin + 40;
    pageContent = "";
    // Title
    pageContent += `BT /F1 14 Tf ${margin} ${pageHeight - margin - 14} Td (${escPdf(title)} - ${format(new Date(), "yyyy-MM-dd")}) Tj ET\n`;
    // Header row
    currentY = pageHeight - margin - 50;
    headers.forEach((h, i) => {
      pageContent += `BT /F1 8 Tf ${margin + i * colWidth + 2} ${currentY} Td (${escPdf(truncate(h, 20))}) Tj ET\n`;
    });
    // Header line
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

  // Build minimal PDF
  let pdf = "%PDF-1.4\n";
  const objects: string[] = [];
  
  // Catalog
  objects.push("1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj");
  
  // Font
  objects.push("3 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj");
  
  // Pages content objects start at 4
  const pageObjStart = 4;
  const pageContentObjs: number[] = [];
  const pageObjs: number[] = [];
  
  pages.forEach((content, idx) => {
    const streamObjNum = pageObjStart + idx * 2;
    const pageObjNum = pageObjStart + idx * 2 + 1;
    pageContentObjs.push(streamObjNum);
    pageObjs.push(pageObjNum);
    
    objects.push(`${streamObjNum} 0 obj\n<< /Length ${content.length} >>\nstream\n${content}endstream\nendobj`);
    objects.push(`${pageObjNum} 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pageWidth} ${pageHeight}] /Contents ${streamObjNum} 0 R /Resources << /Font << /F1 3 0 R >> >> >>\nendobj`);
  });
  
  // Pages object (obj 2)
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

  const handleDownload = async (report: typeof reports[0], fmt: ExportFormat) => {
    const loadingKey = `${report.key}-${fmt}`;
    setLoading(loadingKey);
    try {
      const { headers, rows } = await fetchReportData(report.key);
      if (rows.length === 0) {
        toast.info("No data available for this report");
        return;
      }
      const filename = `${report.key}_${format(new Date(), "yyyyMMdd_HHmm")}`;
      switch (fmt) {
        case "csv": downloadCSV(headers, rows, filename); break;
        case "excel": downloadExcel(headers, rows, filename); break;
        case "pdf": downloadPDF(headers, rows, filename, report.name); break;
      }
      toast.success(`${report.name} downloaded as ${fmt.toUpperCase()}`);
    } catch (err: any) {
      toast.error(`Download failed: ${err.message}`);
    } finally {
      setLoading(null);
    }
  };

  return (
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
              {(["pdf", "excel", "csv"] as ExportFormat[]).map(fmt => {
                const isLoading = loading === `${report.key}-${fmt}`;
                return (
                  <Button
                    key={fmt}
                    variant="outline"
                    size="sm"
                    className="flex-1 gap-1.5 text-xs"
                    disabled={!!loading}
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
    </div>
  );
};

export default Reports;
