import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Loader2, Search, Filter, Eye, RefreshCw, ChevronLeft, ChevronRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

const typeColor: Record<string, string> = {
  upload: "bg-info/10 text-info border-info/20",
  approve: "bg-success/10 text-success border-success/20",
  system: "bg-muted text-muted-foreground border-border",
  submit: "bg-primary/10 text-primary border-primary/20",
  config: "bg-warning/10 text-warning border-warning/20",
  download: "bg-muted text-muted-foreground border-border",
  reject: "bg-destructive/10 text-destructive border-destructive/20",
  login: "bg-info/10 text-info border-info/20",
  logout: "bg-muted text-muted-foreground border-border",
};

const PAGE_SIZE = 20;

const AuditLog = () => {
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [roleFilter, setRoleFilter] = useState<string>("all");
  const [page, setPage] = useState(0);
  const [selectedLog, setSelectedLog] = useState<any | null>(null);

  const { data: logs, isLoading, refetch, isFetching } = useQuery({
    queryKey: ["audit_logs"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("audit_logs")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(500);
      if (error) throw error;
      return data;
    },
  });

  const actionTypes = useMemo(() => {
    if (!logs) return [];
    return [...new Set(logs.map((l) => l.action_type))].sort();
  }, [logs]);

  const roles = useMemo(() => {
    if (!logs) return [];
    return [...new Set(logs.map((l) => l.user_role).filter(Boolean))].sort();
  }, [logs]);

  const filtered = useMemo(() => {
    if (!logs) return [];
    return logs.filter((log) => {
      const matchesSearch =
        !search ||
        log.action.toLowerCase().includes(search.toLowerCase()) ||
        (log.user_name || "").toLowerCase().includes(search.toLowerCase());
      const matchesType = typeFilter === "all" || log.action_type === typeFilter;
      const matchesRole = roleFilter === "all" || log.user_role === roleFilter;
      return matchesSearch && matchesType && matchesRole;
    });
  }, [logs, search, typeFilter, roleFilter]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paginated = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  // Reset page when filters change
  const handleSearchChange = (v: string) => { setSearch(v); setPage(0); };
  const handleTypeChange = (v: string) => { setTypeFilter(v); setPage(0); };
  const handleRoleChange = (v: string) => { setRoleFilter(v); setPage(0); };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight">Audit Log</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Complete trail of all system actions and events
            {logs && <span className="ml-1">({filtered.length} of {logs.length} entries)</span>}
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching}>
          <RefreshCw className={`h-4 w-4 mr-1.5 ${isFetching ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search actions or users..."
            value={search}
            onChange={(e) => handleSearchChange(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={typeFilter} onValueChange={handleTypeChange}>
          <SelectTrigger className="w-[160px]">
            <Filter className="h-4 w-4 mr-1.5 text-muted-foreground" />
            <SelectValue placeholder="Action type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All types</SelectItem>
            {actionTypes.map((t) => (
              <SelectItem key={t} value={t}>{t}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={roleFilter} onValueChange={handleRoleChange}>
          <SelectTrigger className="w-[160px]">
            <Filter className="h-4 w-4 mr-1.5 text-muted-foreground" />
            <SelectValue placeholder="Role" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All roles</SelectItem>
            {roles.map((r) => (
              <SelectItem key={r!} value={r!}>{r}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="rounded-xl border border-border bg-card overflow-hidden"
      >
        {filtered.length === 0 ? (
          <div className="p-12 text-center text-muted-foreground">
            <p className="text-sm">
              {logs && logs.length > 0 ? "No logs match your filters." : "No audit events recorded yet."}
            </p>
          </div>
        ) : (
          <>
            <ScrollArea className="max-h-[60vh]">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-card z-10">
                  <tr className="border-b border-border text-left text-xs font-medium text-muted-foreground">
                    <th className="px-5 py-3">Time</th>
                    <th className="px-5 py-3">User</th>
                    <th className="px-5 py-3">Role</th>
                    <th className="px-5 py-3">Action</th>
                    <th className="px-5 py-3">Type</th>
                    <th className="px-5 py-3 text-right">Details</th>
                  </tr>
                </thead>
                <tbody>
                  <AnimatePresence mode="popLayout">
                    {paginated.map((log) => (
                      <motion.tr
                        key={log.id}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="border-b border-border last:border-0 hover:bg-muted/50 transition-colors cursor-pointer"
                        onClick={() => setSelectedLog(log)}
                      >
                        <td className="px-5 py-3 font-mono text-xs text-muted-foreground">
                          {new Date(log.created_at).toLocaleString()}
                        </td>
                        <td className="px-5 py-3 font-medium">{log.user_name || "System"}</td>
                        <td className="px-5 py-3 text-muted-foreground">{log.user_role || "—"}</td>
                        <td className="px-5 py-3 max-w-[300px] truncate" title={log.action}>{log.action}</td>
                        <td className="px-5 py-3">
                          <Badge variant="outline" className={typeColor[log.action_type] || typeColor.system}>
                            {log.action_type}
                          </Badge>
                        </td>
                        <td className="px-5 py-3 text-right">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 px-2"
                            onClick={(e) => { e.stopPropagation(); setSelectedLog(log); }}
                          >
                            <Eye className="h-3.5 w-3.5" />
                          </Button>
                        </td>
                      </motion.tr>
                    ))}
                  </AnimatePresence>
                </tbody>
              </table>
            </ScrollArea>

            {/* Pagination */}
            <div className="flex items-center justify-between border-t border-border px-5 py-3">
              <p className="text-xs text-muted-foreground">
                Showing {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, filtered.length)} of {filtered.length}
              </p>
              <div className="flex items-center gap-1">
                <Button variant="ghost" size="sm" disabled={page === 0} onClick={() => setPage(page - 1)}>
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <span className="text-xs text-muted-foreground px-2">
                  Page {page + 1} of {totalPages}
                </span>
                <Button variant="ghost" size="sm" disabled={page >= totalPages - 1} onClick={() => setPage(page + 1)}>
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </>
        )}
      </motion.div>

      {/* Detail Dialog */}
      <Dialog open={!!selectedLog} onOpenChange={(open) => !open && setSelectedLog(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Audit Event Details</DialogTitle>
          </DialogHeader>
          {selectedLog && (
            <ScrollArea className="max-h-[60vh]">
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <p className="text-xs text-muted-foreground mb-0.5">Time</p>
                    <p className="font-mono text-xs">{new Date(selectedLog.created_at).toLocaleString()}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground mb-0.5">Type</p>
                    <Badge variant="outline" className={typeColor[selectedLog.action_type] || typeColor.system}>
                      {selectedLog.action_type}
                    </Badge>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground mb-0.5">User</p>
                    <p className="font-medium">{selectedLog.user_name || "System"}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground mb-0.5">Role</p>
                    <p>{selectedLog.user_role || "—"}</p>
                  </div>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Action</p>
                  <p className="text-sm whitespace-pre-wrap break-words">{selectedLog.action}</p>
                </div>
                {selectedLog.details && (
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Details (JSON)</p>
                    <pre className="text-xs font-mono bg-muted/50 rounded-md p-3 whitespace-pre-wrap break-words overflow-auto">
                      {JSON.stringify(selectedLog.details, null, 2)}
                    </pre>
                  </div>
                )}
              </div>
            </ScrollArea>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AuditLog;
