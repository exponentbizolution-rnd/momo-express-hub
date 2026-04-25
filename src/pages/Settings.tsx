import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { Settings as SettingsIcon, Activity, CheckCircle, XCircle, Loader2, Shield, Copy, Check, KeyRound, AlertTriangle, ExternalLink, Eye, EyeOff } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
  const [credHealthResult, setCredHealthResult] = useState<HealthCheckResult | null>(null);
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

  const credHealthCheckMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke("mtn-health-check", {
        body: { environment: "production" },
      });
      if (error) throw error;
      return data as HealthCheckResult;
    },
    onSuccess: (data) => setCredHealthResult(data),
    onError: (err: Error) => {
      setCredHealthResult({
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
                  These power live ZMW disbursements. Saved values are stored encrypted at rest and used by the disbursement engine on the next call. Run a Health Check above after saving to confirm the new credentials work.
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

            <div className="pt-2 border-t border-border space-y-3">
              <Button
                onClick={() => credHealthCheckMutation.mutate()}
                disabled={credHealthCheckMutation.isPending}
                variant="outline"
                className="w-full"
              >
                {credHealthCheckMutation.isPending ? (
                  <>
                    <Loader2 size={16} className="mr-2 animate-spin" />
                    Testing credentials...
                  </>
                ) : (
                  <>
                    <Activity size={16} className="mr-2" />
                    Run Health Check
                  </>
                )}
              </Button>

              {credHealthResult && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  className="rounded-lg border border-border bg-muted/50 p-4 space-y-3"
                >
                  <div className="flex items-center gap-2">
                    {credHealthResult.success ? (
                      <CheckCircle className="text-success" size={20} />
                    ) : (
                      <XCircle className="text-destructive" size={20} />
                    )}
                    <span className="font-medium text-sm">
                      {credHealthResult.success
                        ? "Credentials are working"
                        : "Credential check failed"}
                    </span>
                  </div>
                  <div className="grid gap-2 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Token Generation</span>
                      {credHealthResult.tokenError ? (
                        <span className="text-destructive max-w-[60%] text-right break-words">
                          {credHealthResult.tokenError}
                        </span>
                      ) : credHealthResult.tokenLatency ? (
                        <Badge variant="outline" className="bg-success/10 text-success border-success/20">
                          ✓ {credHealthResult.tokenLatency}ms
                        </Badge>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Balance API</span>
                      {credHealthResult.balanceError ? (
                        <span className="text-destructive max-w-[60%] text-right break-words" title={credHealthResult.balanceError}>
                          {credHealthResult.balanceError}
                        </span>
                      ) : credHealthResult.balanceLatency ? (
                        <Badge variant="outline" className="bg-success/10 text-success border-success/20">
                          ✓ {credHealthResult.balanceLatency}ms
                        </Badge>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </div>
                    {credHealthResult.balance && (
                      <div className="flex items-center justify-between pt-2 border-t border-border">
                        <span className="text-muted-foreground">Available Balance</span>
                        <span className="font-semibold text-foreground">
                          {credHealthResult.balance.currency}{" "}
                          {Number(credHealthResult.balance.availableBalance).toLocaleString()}
                        </span>
                      </div>
                    )}
                    {credHealthResult.error && (
                      <div className="text-destructive mt-2">Error: {credHealthResult.error}</div>
                    )}
                  </div>
                </motion.div>
              )}
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
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState("");
  const [show, setShow] = useState(false);

  const saveMutation = useMutation({
    mutationFn: async (newValue: string) => {
      const { data, error } = await supabase.functions.invoke("update-mtn-credential", {
        body: { key: secretName, value: newValue },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data;
    },
    onSuccess: () => {
      toast.success(`${label} updated successfully`);
      setOpen(false);
      setValue("");
      setShow(false);
    },
    onError: (err: Error) => {
      toast.error(`Failed to update: ${err.message}`);
    },
  });

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!value.trim()) {
      toast.error("Please enter a value");
      return;
    }
    saveMutation.mutate(value);
  };

  return (
    <>
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
        <Button size="sm" variant="outline" onClick={() => setOpen(true)}>
          Update
        </Button>
      </div>

      <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) { setValue(""); setShow(false); } }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Update {label}</DialogTitle>
            <DialogDescription>
              Enter the new value from the MTN MoMo Developer Portal. The value will be encrypted and saved to the backend.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSave} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor={`cred-${secretName}`}>{label}</Label>
              <div className="relative">
                <Input
                  id={`cred-${secretName}`}
                  type={show ? "text" : "password"}
                  value={value}
                  onChange={(e) => setValue(e.target.value)}
                  placeholder={`Paste ${label.toLowerCase()} here`}
                  autoComplete="off"
                  className="pr-10 font-mono text-xs"
                  disabled={saveMutation.isPending}
                />
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  onClick={() => setShow((s) => !s)}
                  className="absolute top-1 right-1 h-7 w-7"
                  aria-label={show ? "Hide value" : "Show value"}
                >
                  {show ? <EyeOff size={14} /> : <Eye size={14} />}
                </Button>
              </div>
              <p className="text-[11px] text-muted-foreground">
                Stored as: <code className="font-mono">{secretName}</code>
              </p>
            </div>
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => setOpen(false)} disabled={saveMutation.isPending}>
                Cancel
              </Button>
              <Button type="submit" disabled={saveMutation.isPending || !value.trim()}>
                {saveMutation.isPending ? (
                  <>
                    <Loader2 size={14} className="mr-2 animate-spin" />
                    Saving...
                  </>
                ) : (
                  "Save"
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default Settings;
