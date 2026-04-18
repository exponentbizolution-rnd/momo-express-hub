import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { Stethoscope, Play, Loader2, Copy, CheckCheck } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Navigate } from "react-router-dom";
import { toast } from "sonner";

const DiagnoseMtn = () => {
  const { role } = useAuth();
  const [result, setResult] = useState<Record<string, unknown> | null>(null);
  const [copied, setCopied] = useState(false);

  const diagnose = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke("mtn-diagnose");
      if (error) throw error;
      return data as Record<string, unknown>;
    },
    onSuccess: (data) => setResult(data),
    onError: (err: Error) => toast.error(err.message),
  });

  if (role !== "super_admin") {
    return <Navigate to="/dashboard" replace />;
  }

  const copyJson = async () => {
    if (!result) return;
    await navigator.clipboard.writeText(JSON.stringify(result, null, 2));
    setCopied(true);
    toast.success("Diagnostics copied to clipboard");
    setTimeout(() => setCopied(false), 2000);
  };

  const renderStep = (key: string, label: string) => {
    const step = result?.[key] as Record<string, unknown> | undefined;
    if (!step) return null;
    const response = step.response as
      | { status?: number; statusText?: string; latencyMs?: number; body?: string; headers?: Record<string, string> }
      | undefined;
    const fetchError = step.fetchError as string | undefined;
    const ok = response && response.status && response.status >= 200 && response.status < 300;

    return (
      <Card key={key}>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between gap-2">
            <CardTitle className="text-base">{label}</CardTitle>
            {fetchError ? (
              <Badge variant="destructive">Network Error</Badge>
            ) : response?.status ? (
              <Badge
                variant="outline"
                className={
                  ok
                    ? "bg-success/10 text-success border-success/20"
                    : "bg-destructive/10 text-destructive border-destructive/20"
                }
              >
                {response.status} {response.statusText} · {response.latencyMs}ms
              </Badge>
            ) : null}
          </div>
        </CardHeader>
        <CardContent className="space-y-3 text-xs">
          <div>
            <div className="font-semibold text-muted-foreground mb-1">Request</div>
            <pre className="bg-muted/50 rounded p-3 overflow-x-auto">
              {JSON.stringify(
                {
                  method: step.method,
                  url: step.url,
                  headers: step.headers,
                  body: step.body,
                },
                null,
                2
              )}
            </pre>
          </div>
          {response && (
            <div>
              <div className="font-semibold text-muted-foreground mb-1">Response</div>
              <pre className="bg-muted/50 rounded p-3 overflow-x-auto">
                {JSON.stringify(response, null, 2)}
              </pre>
            </div>
          )}
          {fetchError && (
            <div className="text-destructive">Fetch error: {fetchError}</div>
          )}
        </CardContent>
      </Card>
    );
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold tracking-tight flex items-center gap-2">
          <Stethoscope size={24} />
          Diagnose MTN
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Inspect raw request/response from the MTN MoMo OAuth and balance endpoints to debug provisioning.
        </p>
      </div>

      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
        <div className="flex flex-wrap gap-2">
          <Button onClick={() => diagnose.mutate()} disabled={diagnose.isPending}>
            {diagnose.isPending ? (
              <>
                <Loader2 size={16} className="mr-2 animate-spin" />
                Running diagnostics...
              </>
            ) : (
              <>
                <Play size={16} className="mr-2" />
                Run Diagnostics
              </>
            )}
          </Button>
          {result && (
            <Button variant="outline" onClick={copyJson}>
              {copied ? <CheckCheck size={16} className="mr-2" /> : <Copy size={16} className="mr-2" />}
              Copy JSON
            </Button>
          )}
        </div>

        {result && (
          <>
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Configured Secrets</CardTitle>
                <CardDescription>Masked for safety — confirms what the edge function sees.</CardDescription>
              </CardHeader>
              <CardContent>
                <pre className="bg-muted/50 rounded p-3 overflow-x-auto text-xs">
                  {JSON.stringify(result.secrets, null, 2)}
                </pre>
              </CardContent>
            </Card>

            {renderStep("step1_apiUserCheck", "Step 1 — API User Validation (GET /v1_0/apiuser/{user})")}
            {renderStep("step2_tokenPrimary", "Step 2 — OAuth Token (Primary Key)")}

            {Array.isArray(result.step3_balanceProbes) && (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">
                    Step 3 — Balance Probes (X-Target-Environment candidates)
                  </CardTitle>
                  <CardDescription>
                    The token worked — testing different environment header values to find what your tenant accepts.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <pre className="bg-muted/50 rounded p-3 overflow-x-auto text-xs">
                    {JSON.stringify(result.step3_balanceProbes, null, 2)}
                  </pre>
                </CardContent>
              </Card>
            )}

            {renderStep("step4_tokenSecondary", "Step 4 — OAuth Token (Secondary Key)")}

            {(result.error || result.fatalError) && (
              <Card className="border-destructive/40">
                <CardContent className="pt-6 text-sm text-destructive">
                  {(result.error as string) || (result.fatalError as string)}
                </CardContent>
              </Card>
            )}
          </>
        )}
      </motion.div>
    </div>
  );
};

export default DiagnoseMtn;
