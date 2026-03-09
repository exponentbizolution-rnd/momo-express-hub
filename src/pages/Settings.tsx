import { useState, useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { Settings as SettingsIcon, Activity, CheckCircle, XCircle, Loader2, Shield, AlertTriangle, Save } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Navigate } from "react-router-dom";
import { useMtnEnvironment } from "@/hooks/useMtnEnvironment";
import { toast } from "sonner";

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
  const { role, user } = useAuth();
  const queryClient = useQueryClient();
  const { environment: savedEnv, currency, isLoading: envLoading } = useMtnEnvironment();
  const [healthResult, setHealthResult] = useState<HealthCheckResult | null>(null);
  const [selectedEnv, setSelectedEnv] = useState<"sandbox" | "production">("sandbox");
  const [hasChanges, setHasChanges] = useState(false);

  useEffect(() => {
    if (!envLoading) {
      setSelectedEnv(savedEnv);
    }
  }, [savedEnv, envLoading]);

  useEffect(() => {
    setHasChanges(selectedEnv !== savedEnv);
  }, [selectedEnv, savedEnv]);

  const saveEnvMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("system_settings")
        .update({ value: selectedEnv, updated_at: new Date().toISOString(), updated_by: user?.id })
        .eq("key", "mtn_environment");
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["mtn-environment"] });
      toast.success(`Environment saved as ${selectedEnv}`);
      setHasChanges(false);
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const healthCheckMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke("mtn-health-check", {
        body: { environment: selectedEnv },
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

  const displayCurrency = selectedEnv === "production" ? "ZMW" : "EUR";

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold tracking-tight flex items-center gap-2">
          <SettingsIcon size={24} />
          Settings
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Manage MTN MoMo API configuration and run diagnostics
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
              API credentials and environment settings for disbursements
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Environment Mode</label>
              <Select value={selectedEnv} onValueChange={(v) => setSelectedEnv(v as "sandbox" | "production")}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="sandbox">
                    <div className="flex flex-col items-start">
                      <span>Sandbox</span>
                      <span className="text-xs text-muted-foreground">Test API • EUR currency</span>
                    </div>
                  </SelectItem>
                  <SelectItem value="production">
                    <div className="flex flex-col items-start">
                      <span>Production</span>
                      <span className="text-xs text-muted-foreground">Live API • ZMW currency</span>
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            {selectedEnv === "production" && (
              <Alert className="border-warning bg-warning/10">
                <AlertTriangle className="h-4 w-4 text-warning" />
                <AlertDescription className="text-warning">
                  Production mode uses real funds. Ensure all credentials are correctly configured.
                </AlertDescription>
              </Alert>
            )}

            <Button
              onClick={() => saveEnvMutation.mutate()}
              disabled={!hasChanges || saveEnvMutation.isPending}
              className="w-full"
              variant={hasChanges ? "default" : "secondary"}
            >
              {saveEnvMutation.isPending ? (
                <>
                  <Loader2 size={16} className="mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save size={16} className="mr-2" />
                  Save Environment
                </>
              )}
            </Button>

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
                <span className="text-muted-foreground">Active Environment</span>
                <Badge variant={selectedEnv === "production" ? "destructive" : "outline"}>
                  {selectedEnv}
                </Badge>
              </div>
              <div className="flex items-center justify-between py-2 border-b border-border">
                <span className="text-muted-foreground">Currency</span>
                <Badge variant="outline">{displayCurrency}</Badge>
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
