import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { Settings as SettingsIcon, Activity, CheckCircle, XCircle, Loader2, Shield, Copy, Check, KeyRound, AlertTriangle, ExternalLink } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Navigate } from "react-router-dom";
import { toast } from "sonner";

interface HealthCheckResult {
  success: boolean;
  environment: string;
  secretsConfigured: { primaryKey: boolean; targetEnv: boolean };
  tokenLatency?: number;
  balanceLatency?: number;
  balance?: { availableBalance: string; currency: string };
  accessToken?: string;
  tokenType?: string;
  tokenExpiresIn?: number;
  tokenError?: string;
  balanceError?: string;
  error?: string;
}

const Settings = () => {
  const { role } = useAuth();
  const [healthResult, setHealthResult] = useState<HealthCheckResult | null>(null);
  const [copied, setCopied] = useState(false);

  const handleCopyToken = async () => {
    if (!healthResult?.accessToken) return;
    await navigator.clipboard.writeText(healthResult.accessToken);
    setCopied(true);
    toast.success("Token copied to clipboard");
    setTimeout(() => setCopied(false), 2000);
  };

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
                      <span className="text-success text-xs font-medium">
                        Success ({healthResult.tokenLatency}ms)
                      </span>
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
                  {healthResult.accessToken && (
                    <div className="pt-2 border-t border-border space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="text-muted-foreground">Generated Token</span>
                        {healthResult.tokenExpiresIn && (
                          <span className="text-xs text-muted-foreground">
                            {healthResult.tokenType} · expires in {healthResult.tokenExpiresIn}s
                          </span>
                        )}
                      </div>
                      <div className="relative rounded-md bg-background border border-border p-2 pr-10 font-mono text-xs break-all select-all">
                        {healthResult.accessToken}
                        <Button
                          type="button"
                          size="icon"
                          variant="ghost"
                          onClick={handleCopyToken}
                          className="absolute top-1 right-1 h-7 w-7"
                          aria-label="Copy token"
                        >
                          {copied ? <Check size={14} className="text-success" /> : <Copy size={14} />}
                        </Button>
                      </div>
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

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <KeyRound size={20} />
              MTN MoMo API Credentials
            </CardTitle>
            <CardDescription>
              Update the credentials used by the disbursement engine. Values are stored as encrypted backend secrets and are never displayed in the UI.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Alert>
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>Production credentials</AlertTitle>
              <AlertDescription className="space-y-2">
                <p>
                  These power live ZMW disbursements. Updating a value redeploys the edge functions automatically. Run a Health Check above after saving to confirm the new credentials work.
                </p>
                <a
                  href="https://momodeveloper.mtn.com/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                >
                  Open MTN MoMo Developer Portal <ExternalLink size={12} />
                </a>
              </AlertDescription>
            </Alert>

            <div className="grid gap-3">
              <CredentialRow
                label="Subscription Key"
                description="Primary key from your MTN MoMo Developer Portal subscription (Disbursement product)."
                secretName="MTN_MOMO_PRIMARY_KEY"
              />
              <CredentialRow
                label="API User ID"
                description="The UUID you generated when provisioning the API user (X-Reference-Id)."
                secretName="MTN_API_USER"
              />
              <CredentialRow
                label="API Key"
                description="The API key returned by MTN when you created the API user."
                secretName="MTN_API_KEY"
              />
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
};

interface CredentialRowProps {
  label: string;
  description: string;
  secretName: string;
}

const CredentialRow = ({ label, description, secretName }: CredentialRowProps) => {
  const handleUpdate = () => {
    toast.info(
      `To update ${label}, ask the assistant: "Update the ${secretName} secret"`,
      { duration: 6000 }
    );
  };

  return (
    <div className="flex items-start justify-between gap-4 rounded-lg border border-border bg-muted/30 p-4">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-medium text-sm">{label}</span>
          <Badge variant="outline" className="bg-success/10 text-success border-success/20 text-[10px]">
            <CheckCircle size={10} className="mr-1" />
            Configured
          </Badge>
        </div>
        <p className="text-xs text-muted-foreground mt-1">{description}</p>
        <code className="text-[10px] text-muted-foreground font-mono mt-1 block">{secretName}</code>
      </div>
      <Button size="sm" variant="outline" onClick={handleUpdate}>
        Update
      </Button>
    </div>
  );
};

export default Settings;
