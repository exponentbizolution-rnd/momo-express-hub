import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { Settings as SettingsIcon, Activity, CheckCircle, XCircle, Loader2, Shield } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Navigate } from "react-router-dom";

interface HealthCheckResult {
  success: boolean;
  environment: string;
  secretsConfigured: { primaryKey: boolean; targetEnv: boolean };
  tokenLatency?: number;
  balanceLatency?: number;
  balance?: { availableBalance: string; currency: string };
  tokenError?: string;
  balanceError?: string;
  error?: string;
}

const Settings = () => {
  const { role } = useAuth();
  const [healthResult, setHealthResult] = useState<HealthCheckResult | null>(null);

  const healthCheckMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke("mtn-health-check", {
        body: { environment: "production" },
      });
      if (error) throw error;
      return data as HealthCheckResult;
    },
    onSuccess: (data) => setHealthResult(data),
    onError: (err: Error) => {
      setHealthResult({
        success: false,
        environment: "unknown",
        secretsConfigured: { primaryKey: false, targetEnv: false },
        error: err.message,
      });
    },
  });

  if (role !== "super_admin") {
    return <Navigate to="/dashboard" replace />;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold tracking-tight flex items-center gap-2">
          <SettingsIcon size={24} />
          Settings
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          MTN MoMo API configuration and diagnostics
        </p>
      </div>

      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="grid gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield size={20} />
              MTN MoMo Configuration
            </CardTitle>
            <CardDescription>
              Production API credentials and diagnostics
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3 text-sm">
              <div className="flex items-center justify-between py-2 border-b border-border">
                <span className="text-muted-foreground">Primary Key</span>
                <Badge variant="outline" className="bg-success/10 text-success border-success/20">
                  <CheckCircle size={12} className="mr-1" />
                  Configured
                </Badge>
              </div>
              <div className="flex items-center justify-between py-2 border-b border-border">
                <span className="text-muted-foreground">Secondary Key</span>
                <Badge variant="outline" className="bg-success/10 text-success border-success/20">
                  <CheckCircle size={12} className="mr-1" />
                  Configured
                </Badge>
              </div>
              <div className="flex items-center justify-between py-2 border-b border-border">
                <span className="text-muted-foreground">Environment</span>
                <Badge variant="destructive">Production</Badge>
              </div>
              <div className="flex items-center justify-between py-2 border-b border-border">
                <span className="text-muted-foreground">Currency</span>
                <Badge variant="outline">ZMW</Badge>
              </div>
            </div>

            <Button
              onClick={() => healthCheckMutation.mutate()}
              disabled={healthCheckMutation.isPending}
              variant="outline"
              className="w-full"
            >
              {healthCheckMutation.isPending ? (
                <>
                  <Loader2 size={16} className="mr-2 animate-spin" />
                  Running Health Check...
                </>
              ) : (
                <>
                  <Activity size={16} className="mr-2" />
                  Run Health Check
                </>
              )}
            </Button>

            {healthResult && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                className="rounded-lg border border-border bg-muted/50 p-4 space-y-3"
              >
                <div className="flex items-center gap-2">
                  {healthResult.success ? (
                    <CheckCircle className="text-success" size={20} />
                  ) : (
                    <XCircle className="text-destructive" size={20} />
                  )}
                  <span className="font-medium">
                    {healthResult.success ? "All checks passed" : "Some checks failed"}
                  </span>
                </div>
                <div className="grid gap-2 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Token Generation</span>
                    {healthResult.tokenError ? (
                      <span className="text-destructive text-xs">{healthResult.tokenError}</span>
                    ) : healthResult.tokenLatency ? (
                      <Badge variant="outline" className="bg-success/10 text-success border-success/20">
                        ✓ {healthResult.tokenLatency}ms
                      </Badge>
                    ) : null}
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Balance API</span>
                    {healthResult.balanceError ? (
                      <span className="text-destructive text-xs max-w-[200px] truncate" title={healthResult.balanceError}>
                        {healthResult.balanceError}
                      </span>
                    ) : healthResult.balanceLatency ? (
                      <Badge variant="outline" className="bg-success/10 text-success border-success/20">
                        ✓ {healthResult.balanceLatency}ms
                      </Badge>
                    ) : null}
                  </div>
                  {healthResult.balance && (
                    <div className="flex items-center justify-between pt-2 border-t border-border">
                      <span className="text-muted-foreground">Available Balance</span>
                      <span className="font-semibold">
                        {healthResult.balance.currency} {Number(healthResult.balance.availableBalance).toLocaleString()}
                      </span>
                    </div>
                  )}
                  {healthResult.error && (
                    <div className="text-destructive text-xs mt-2">Error: {healthResult.error}</div>
                  )}
                </div>
              </motion.div>
            )}
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
};

export default Settings;
