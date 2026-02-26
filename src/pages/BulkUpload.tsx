import { useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Upload, FileSpreadsheet, AlertTriangle, CheckCircle2, Download, X, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

interface ValidationRow {
  row: number;
  name: string;
  phone: string;
  amount: string;
  error?: string;
}

const mockValidation: ValidationRow[] = [
  { row: 1, name: "Grace Banda", phone: "260975123456", amount: "2,500.00" },
  { row: 2, name: "Peter Mulenga", phone: "260966789012", amount: "1,800.00" },
  { row: 3, name: "Mary Phiri", phone: "26095534", amount: "3,200.00", error: "Invalid mobile number format" },
  { row: 4, name: "David Tembo", phone: "260977654321", amount: "950.00" },
  { row: 5, name: "Joyce Mumba", phone: "260966111222", amount: "55,000.00", error: "Amount exceeds ZMW 50,000 limit" },
  { row: 6, name: "Peter Mulenga", phone: "260966789012", amount: "1,800.00", error: "Duplicate entry (same as row 2)" },
  { row: 7, name: "Ruth Zulu", phone: "260955333444", amount: "4,100.00" },
];

const BulkUpload = () => {
  const [file, setFile] = useState<File | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [validated, setValidated] = useState(false);

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

  const errors = mockValidation.filter((r) => r.error);
  const valid = mockValidation.filter((r) => !r.error);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-display text-2xl font-bold tracking-tight">Bulk Payment Upload</h1>
        <p className="text-sm text-muted-foreground mt-1">Upload CSV or Excel files to process bulk disbursements</p>
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
            Use our template with the required columns: Recipient Name, Mobile Number, Amount, Reference, Description
          </p>
        </div>
        <Button variant="outline" size="sm" className="gap-2">
          <Download size={14} />
          CSV Template
        </Button>
        <Button variant="outline" size="sm" className="gap-2">
          <Download size={14} />
          Excel Template
        </Button>
      </motion.div>

      {/* Upload Zone */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.05 }}
      >
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
            <p className="text-xs text-muted-foreground mt-1">Supports CSV and Excel (.xlsx) — Max 50MB / 10,000 records</p>
            <input type="file" accept=".csv,.xlsx" onChange={handleFileSelect} className="hidden" />
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
                  <Button size="sm" onClick={() => setValidated(true)} className="gap-2">
                    Validate File
                  </Button>
                )}
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => { setFile(null); setValidated(false); }}
                >
                  <X size={16} />
                </Button>
              </div>
            </div>
          </div>
        )}
      </motion.div>

      {/* Validation Results */}
      <AnimatePresence>
        {validated && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            className="space-y-4"
          >
            {/* Summary */}
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
              <div className="rounded-lg border border-border bg-card p-4 text-center">
                <p className="text-2xl font-display font-bold">{mockValidation.length}</p>
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
                <p className="text-2xl font-display font-bold">ZMW 14,350</p>
                <p className="text-xs text-muted-foreground">Batch Total</p>
              </div>
            </div>

            {/* Validation Report Table */}
            <div className="rounded-xl border border-border bg-card overflow-hidden">
              <div className="p-5 border-b border-border flex items-center justify-between">
                <h3 className="font-display text-base font-semibold">Validation Report</h3>
                <Badge variant="outline" className="bg-destructive/10 text-destructive border-destructive/20">
                  {errors.length} issues found
                </Badge>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border text-left text-xs font-medium text-muted-foreground">
                      <th className="px-5 py-3">Row</th>
                      <th className="px-5 py-3">Recipient Name</th>
                      <th className="px-5 py-3">Mobile Number</th>
                      <th className="px-5 py-3">Amount (ZMW)</th>
                      <th className="px-5 py-3">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {mockValidation.map((row) => (
                      <tr key={row.row} className={`border-b border-border last:border-0 ${row.error ? "bg-destructive/[0.03]" : ""}`}>
                        <td className="px-5 py-3 text-muted-foreground">{row.row}</td>
                        <td className="px-5 py-3 font-medium">{row.name}</td>
                        <td className="px-5 py-3">{row.phone}</td>
                        <td className="px-5 py-3">{row.amount}</td>
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

            {/* Actions */}
            <div className="flex items-center justify-between rounded-xl border border-border bg-card p-5">
              <div>
                <p className="text-sm font-medium">Ready to submit?</p>
                <p className="text-xs text-muted-foreground">{errors.length} errors must be fixed or excluded before processing</p>
              </div>
              <div className="flex gap-3">
                <Button variant="outline" size="sm">
                  Exclude Errors & Submit
                </Button>
                <Button size="sm" disabled={errors.length > 0}>
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
