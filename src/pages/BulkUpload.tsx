import { useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Upload, FileSpreadsheet, AlertTriangle, CheckCircle2, Download, X, Info, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { toast } from "sonner";
import Papa from "papaparse";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

interface ParsedRow {
  row: number;
  name: string;
  phone: string;
  amount: number;
  reference: string;
  description: string;
  error?: string;
}

const validatePhone = (phone: string) => /^260\d{9}$/.test(phone.replace(/\s/g, ""));

const downloadTemplate = (format: "csv") => {
  const header = "Recipient Name,Mobile Number,Amount (ZMW),Reference,Description";
  const sample = "Grace Banda,260975123456,2500,REF001,January salary";
  const blob = new Blob([header + "\n" + sample], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `expopay_template.${format}`;
  a.click();
  URL.revokeObjectURL(url);
};

const BulkUpload = () => {
  const [file, setFile] = useState<File | null>(null);
  const [rawCsvContent, setRawCsvContent] = useState<string>("");
  const [dragOver, setDragOver] = useState(false);
  const [validated, setValidated] = useState(false);
  const [rows, setRows] = useState<ParsedRow[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [batchName, setBatchName] = useState("");
  const { user, profile, role } = useAuth();

  const parseFile = useCallback((f: File) => {
    // Read raw content for storage
    const reader = new FileReader();
    reader.onload = (e) => {
      setRawCsvContent(e.target?.result as string || "");
    };
    reader.readAsText(f);

    Papa.parse(f, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        const seen = new Map<string, number>();
        const parsed: ParsedRow[] = results.data.map((raw: any, i: number) => {
          const name = (raw["Recipient Name"] || "").trim();
          const phone = (raw["Mobile Number"] || "").trim().replace(/\s/g, "");
          const amountStr = (raw["Amount (ZMW)"] || raw["Amount"] || "0").toString().replace(/,/g, "");
          const amount = parseFloat(amountStr) || 0;
          const reference = (raw["Reference"] || "").trim();
          const description = (raw["Description"] || "").trim();

          let error: string | undefined;
          if (!name) error = "Missing recipient name";
          else if (!validatePhone(phone)) error = "Invalid mobile number (must be 260XXXXXXXXX)";
          else if (amount < 1 || amount > 50000) error = "Amount must be ZMW 1–50,000";
          else if (seen.has(phone + amount)) error = `Duplicate entry (same as row ${seen.get(phone + amount)})`;

          if (!error) seen.set(phone + amount, i + 1);

          return { row: i + 1, name, phone, amount, reference, description, error };
        });

        setRows(parsed);
        setValidated(true);
        setBatchName(f.name.replace(/\.(csv|xlsx?)$/i, ""));
      },
      error: () => toast.error("Failed to parse file"),
    });
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const dropped = e.dataTransfer.files[0];
    if (dropped && (dropped.name.endsWith(".csv") || dropped.name.endsWith(".xlsx"))) {
      setFile(dropped);
    }
  }, []);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    if (selected) setFile(selected);
  };

  const handleValidate = () => {
    if (file) parseFile(file);
  };

  const handleSubmit = async (excludeErrors: boolean) => {
    setSubmitting(true);
    try {
      const validRows = excludeErrors ? rows.filter((r) => !r.error) : rows;
      const errorRows = rows.filter((r) => r.error);
      const totalAmount = validRows.reduce((sum, r) => sum + r.amount, 0);

      // Create batch with CSV content stored
      const { data: batch, error: batchError } = await supabase
        .from("batches")
        .insert({
          batch_number: "", // trigger will generate
          name: batchName || file?.name || "Untitled Batch",
          file_name: file?.name,
          total_records: rows.length,
          valid_records: validRows.length,
          error_records: errorRows.length,
          total_amount: totalAmount,
          initiated_by: profile?.full_name || "Unknown",
          initiator_user_id: user?.id,
          status: "pending",
          csv_content: rawCsvContent || null,
        })
        .select()
        .single();

      if (batchError) throw batchError;

      // Insert transactions
      const txRows = validRows.map((r) => ({
        batch_id: batch.id,
        row_number: r.row,
        recipient_name: r.name,
        mobile_number: r.phone,
        amount: r.amount,
        reference: r.reference || null,
        description: r.description || null,
      }));

      if (txRows.length > 0) {
        const { error: txError } = await supabase.from("transactions").insert(txRows);
        if (txError) throw txError;
      }

      // Log audit
      await supabase.from("audit_logs").insert({
        action: `Uploaded batch ${batch.batch_number} (${validRows.length} records, ZMW ${totalAmount.toLocaleString()})`,
        action_type: "upload",
        user_name: profile?.full_name || "Unknown",
        user_role: role || "initiator",
      });

      toast.success(`Batch ${batch.batch_number} created — triggering disbursements...`);

      // Auto-approve and trigger disbursements for sandbox testing
      await supabase.from("batches").update({
        status: "approved",
        approved_by: "Auto (Sandbox)",
        approved_at: new Date().toISOString(),
      }).eq("id", batch.id);

      const { error: fnError } = await supabase.functions.invoke("process-disbursements", {
        body: { batchId: batch.id },
      });

      if (fnError) {
        console.error("Disbursement trigger error:", fnError);
        toast.error("Batch created but disbursement processing failed to start.");
      } else {
        toast.success("Disbursements are now processing via MTN MoMo sandbox!");
      }

      setFile(null);
      setValidated(false);
      setRows([]);
      setRawCsvContent("");
    } catch (err: any) {
      toast.error(err.message || "Failed to submit batch");
    } finally {
      setSubmitting(false);
    }
  };

  const errors = rows.filter((r) => r.error);
  const valid = rows.filter((r) => !r.error);
  const totalAmount = valid.reduce((sum, r) => sum + r.amount, 0);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-display text-2xl font-bold tracking-tight">Bulk Payment Upload</h1>
        <p className="text-sm text-muted-foreground mt-1">Upload CSV files to process bulk disbursements</p>
      </div>

      {/* Template Download */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-center gap-4 rounded-xl border border-border bg-card p-4"
      >
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-info/10 text-info">
          <Info size={20} />
        </div>
        <div className="flex-1">
          <p className="text-sm font-medium">Download Template</p>
          <p className="text-xs text-muted-foreground">
            Required columns: Recipient Name, Mobile Number, Amount (ZMW), Reference, Description
          </p>
        </div>
        <Button variant="outline" size="sm" className="gap-2" onClick={() => downloadTemplate("csv")}>
          <Download size={14} />
          CSV Template
        </Button>
      </motion.div>

      {/* Upload Zone */}
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}>
        {!file ? (
          <label
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
            className={`flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed p-12 transition-colors ${
              dragOver ? "border-primary bg-primary/5" : "border-border hover:border-primary/50 hover:bg-muted/50"
            }`}
          >
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-muted mb-4">
              <Upload size={24} className="text-muted-foreground" />
            </div>
            <p className="text-sm font-medium">Drop your file here, or click to browse</p>
            <p className="text-xs text-muted-foreground mt-1">Supports CSV — Max 50MB / 10,000 records</p>
            <input type="file" accept=".csv" onChange={handleFileSelect} className="hidden" />
          </label>
        ) : (
          <div className="rounded-xl border border-border bg-card p-5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <FileSpreadsheet size={20} />
                </div>
                <div>
                  <p className="text-sm font-semibold">{file.name}</p>
                  <p className="text-xs text-muted-foreground">{(file.size / 1024).toFixed(1)} KB</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {!validated && (
                  <Button size="sm" onClick={handleValidate} className="gap-2">
                    Validate File
                  </Button>
                )}
                <Button variant="ghost" size="sm" onClick={() => { setFile(null); setValidated(false); setRows([]); }}>
                  <X size={16} />
                </Button>
              </div>
            </div>
          </div>
        )}
      </motion.div>

      {/* Validation Results */}
      <AnimatePresence>
        {validated && rows.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            className="space-y-4"
          >
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
              <div className="rounded-lg border border-border bg-card p-4 text-center">
                <p className="text-2xl font-display font-bold">{rows.length}</p>
                <p className="text-xs text-muted-foreground">Total Records</p>
              </div>
              <div className="rounded-lg border border-success/20 bg-success/5 p-4 text-center">
                <p className="text-2xl font-display font-bold text-success">{valid.length}</p>
                <p className="text-xs text-muted-foreground">Valid</p>
              </div>
              <div className="rounded-lg border border-destructive/20 bg-destructive/5 p-4 text-center">
                <p className="text-2xl font-display font-bold text-destructive">{errors.length}</p>
                <p className="text-xs text-muted-foreground">Errors</p>
              </div>
              <div className="rounded-lg border border-border bg-card p-4 text-center">
                <p className="text-2xl font-display font-bold">ZMW {totalAmount.toLocaleString()}</p>
                <p className="text-xs text-muted-foreground">Batch Total</p>
              </div>
            </div>

            <div className="rounded-xl border border-border bg-card overflow-hidden">
              <div className="p-5 border-b border-border flex items-center justify-between">
                <h3 className="font-display text-base font-semibold">Validation Report</h3>
                {errors.length > 0 && (
                  <Badge variant="outline" className="bg-destructive/10 text-destructive border-destructive/20">
                    {errors.length} issues found
                  </Badge>
                )}
              </div>
              <div className="overflow-x-auto max-h-96">
                <table className="w-full text-sm">
                  <thead className="sticky top-0 bg-card">
                    <tr className="border-b border-border text-left text-xs font-medium text-muted-foreground">
                      <th className="px-5 py-3">Row</th>
                      <th className="px-5 py-3">Recipient Name</th>
                      <th className="px-5 py-3">Mobile Number</th>
                      <th className="px-5 py-3">Amount (ZMW)</th>
                      <th className="px-5 py-3">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row) => (
                      <tr key={row.row} className={`border-b border-border last:border-0 ${row.error ? "bg-destructive/[0.03]" : ""}`}>
                        <td className="px-5 py-3 text-muted-foreground">{row.row}</td>
                        <td className="px-5 py-3 font-medium">{row.name}</td>
                        <td className="px-5 py-3">{row.phone}</td>
                        <td className="px-5 py-3">{row.amount.toLocaleString()}</td>
                        <td className="px-5 py-3">
                          {row.error ? (
                            <Tooltip>
                              <TooltipTrigger>
                                <div className="flex items-center gap-1.5 text-destructive">
                                  <AlertTriangle size={14} />
                                  <span className="text-xs font-medium">Error</span>
                                </div>
                              </TooltipTrigger>
                              <TooltipContent>{row.error}</TooltipContent>
                            </Tooltip>
                          ) : (
                            <div className="flex items-center gap-1.5 text-success">
                              <CheckCircle2 size={14} />
                              <span className="text-xs font-medium">Valid</span>
                            </div>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="flex items-center justify-between rounded-xl border border-border bg-card p-5">
              <div>
                <p className="text-sm font-medium">Ready to submit?</p>
                <p className="text-xs text-muted-foreground">
                  {errors.length > 0
                    ? `${errors.length} errors will be excluded. ${valid.length} valid records will be submitted.`
                    : `All ${valid.length} records are valid and ready.`}
                </p>
              </div>
              <div className="flex gap-3">
                {errors.length > 0 && (
                  <Button variant="outline" size="sm" onClick={() => handleSubmit(true)} disabled={submitting || valid.length === 0}>
                    {submitting && <Loader2 size={14} className="mr-2 animate-spin" />}
                    Exclude Errors & Submit ({valid.length})
                  </Button>
                )}
                <Button size="sm" onClick={() => handleSubmit(false)} disabled={submitting || errors.length > 0}>
                  {submitting && <Loader2 size={14} className="mr-2 animate-spin" />}
                  Submit All
                </Button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default BulkUpload;
