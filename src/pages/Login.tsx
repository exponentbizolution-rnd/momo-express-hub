import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Zap, Eye, EyeOff, Lock, Mail, User, ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const Login = () => {
  const navigate = useNavigate();
  const [isSignUp, setIsSignUp] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [loading, setLoading] = useState(false);
  const [lockout, setLockout] = useState<{ locked: boolean; lockedUntil?: string; attempts: number }>({ locked: false, attempts: 0 });
  const [forgotOpen, setForgotOpen] = useState(false);
  const [resetEmail, setResetEmail] = useState("");
  const [isResetting, setIsResetting] = useState(false);

  // Handle email confirmation redirect — sign out the auto-session and prompt manual login
  useEffect(() => {
    const hash = window.location.hash;
    if (hash && hash.includes("type=signup")) {
      supabase.auth.signOut().then(() => {
        toast.success("Email confirmed! Please sign in.");
        window.history.replaceState(null, "", window.location.pathname);
      });
    }
  }, []);

  const checkLockout = async () => {
    if (!email) return;
    const { data } = await supabase.rpc("check_login_lockout", { p_email: email });
    const d = data as Record<string, any> | null;
    if (d?.locked) {
      setLockout({ locked: true, lockedUntil: d.locked_until, attempts: d.attempts });
    } else {
      setLockout({ locked: false, attempts: d?.attempts ?? 0 });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (isSignUp) {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: { full_name: fullName },
            emailRedirectTo: window.location.origin + '/login',
          },
        });
        if (error) throw error;
        toast.success("Check your email for a confirmation link!");
      } else {
        // Check lockout before attempting login
        const { data: lockRaw } = await supabase.rpc("check_login_lockout", { p_email: email });
        const lockData = lockRaw as Record<string, any> | null;
        if (lockData?.locked) {
          const until = new Date(lockData.locked_until);
          const mins = Math.ceil((until.getTime() - Date.now()) / 60000);
          setLockout({ locked: true, lockedUntil: lockData.locked_until, attempts: lockData.attempts });
          toast.error(`Account locked. Try again in ${mins} minute${mins !== 1 ? "s" : ""}.`);
          setLoading(false);
          return;
        }

        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) {
          // Record failed attempt
          const { data: failRaw } = await supabase.rpc("record_failed_login", { p_email: email });
          const failData = failRaw as Record<string, any> | null;
          if (failData?.locked) {
            setLockout({ locked: true, lockedUntil: failData.locked_until, attempts: failData.attempts });
            toast.error("Too many failed attempts. Account locked for 15 minutes.");
          } else {
            const remaining = 5 - (failData?.attempts ?? 0);
            setLockout({ locked: false, attempts: failData?.attempts ?? 0 });
            toast.error(`Invalid credentials. ${remaining} attempt${remaining !== 1 ? "s" : ""} remaining.`);
          }
          setLoading(false);
          return;
        }

        // Success — clear failed attempts
        await supabase.rpc("clear_failed_logins", { p_email: email });
        setLockout({ locked: false, attempts: 0 });
        navigate("/dashboard");
      }
    } catch (err: any) {
      toast.error(err.message || "Authentication failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen">
      {/* Left Panel */}
      <div className="hidden lg:flex lg:w-1/2 flex-col justify-between bg-secondary p-12">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-accent">
            <Zap className="h-5 w-5 text-accent-foreground" strokeWidth={2.5} />
          </div>
          <span className="font-display text-2xl font-bold text-secondary-foreground">
            Expo<span className="text-accent">Pay</span>
          </span>
        </div>

        <div className="space-y-6">
          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="font-display text-4xl font-bold leading-tight text-secondary-foreground"
          >
            Bulk Mobile Money
            <br />
            Payments, <span className="text-accent">Simplified.</span>
          </motion.h1>
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="text-lg text-secondary-foreground/70 max-w-md"
          >
            Process thousands of MTN MoMo disbursements with enterprise-grade security and dual authorization.
          </motion.p>
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="grid grid-cols-3 gap-4 pt-6"
          >
            {[
              { label: "Transactions/mo", value: "500K+" },
              { label: "Success Rate", value: "99.2%" },
              { label: "Avg. Speed", value: "<3s" },
            ].map((stat) => (
              <div key={stat.label} className="rounded-lg bg-secondary-foreground/5 p-4">
                <p className="font-display text-xl font-bold text-accent">{stat.value}</p>
                <p className="text-xs text-secondary-foreground/60">{stat.label}</p>
              </div>
            ))}
          </motion.div>
        </div>
        <p className="text-xs text-secondary-foreground/40">© 2026 ExpoPay. All rights reserved.</p>
      </div>

      {/* Right Panel */}
      <div className="flex flex-1 items-center justify-center p-8">
        <motion.div
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          className="w-full max-w-sm"
        >
          <div className="mb-8 flex items-center gap-2.5 lg:hidden">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-accent">
              <Zap className="h-5 w-5 text-accent-foreground" strokeWidth={2.5} />
            </div>
            <span className="font-display text-xl font-bold">
              Expo<span className="text-accent">Pay</span>
            </span>
          </div>

          <div className="mb-6">
            <h2 className="font-display text-xl font-bold">
              {isSignUp ? "Create an account" : "Welcome back"}
            </h2>
            <p className="text-sm text-muted-foreground mt-1">
              {isSignUp ? "Sign up for ExpoPay" : "Sign in to your ExpoPay account"}
            </p>
          </div>

          {lockout.locked && (
            <div className="mb-4 flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
              <ShieldAlert size={18} className="shrink-0" />
              <span>
                Account locked due to too many failed attempts. Try again in{" "}
                {lockout.lockedUntil
                  ? `${Math.max(1, Math.ceil((new Date(lockout.lockedUntil).getTime() - Date.now()) / 60000))} minutes`
                  : "15 minutes"}.
              </span>
            </div>
          )}

          {!lockout.locked && lockout.attempts > 0 && !isSignUp && (
            <div className="mb-4 flex items-center gap-2 rounded-lg border border-orange-300 bg-orange-50 p-3 text-sm text-orange-700 dark:border-orange-700 dark:bg-orange-950/30 dark:text-orange-400">
              <ShieldAlert size={18} className="shrink-0" />
              <span>{5 - lockout.attempts} login attempt{5 - lockout.attempts !== 1 ? "s" : ""} remaining before lockout.</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {isSignUp && (
              <div className="space-y-2">
                <Label htmlFor="fullName">Full Name</Label>
                <div className="relative">
                  <User size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="fullName"
                    type="text"
                    placeholder="John Mwale"
                    className="pl-9"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    required
                  />
                </div>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="email">Email Address</Label>
              <div className="relative">
                <Mail size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="email"
                  type="email"
                  placeholder="you@company.com"
                  className="pl-9"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <div className="relative">
                <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="••••••••"
                  className="pl-9 pr-9"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={6}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            <Button type="submit" className="w-full" disabled={loading || lockout.locked}>
              {loading ? "Please wait..." : lockout.locked ? "Account Locked" : isSignUp ? "Create Account" : "Sign In"}
            </Button>
          </form>

          {!isSignUp && (
            <div className="mt-4 text-center">
              <button
                type="button"
                className="text-sm text-primary font-medium hover:underline"
                onClick={() => {
                  setResetEmail("");
                  setForgotOpen(true);
                }}
              >
                Forgot password?
              </button>
            </div>
          )}

          <Dialog open={forgotOpen} onOpenChange={setForgotOpen}>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>Reset your password</DialogTitle>
                <DialogDescription>
                  Enter your email address and we'll send you a link to reset your password.
                </DialogDescription>
              </DialogHeader>
              <form
                onSubmit={async (e) => {
                  e.preventDefault();
                  if (!resetEmail) return;
                  setIsResetting(true);
                  try {
                    const { error } = await supabase.auth.resetPasswordForEmail(resetEmail, {
                      redirectTo: `${window.location.origin}/reset-password`,
                    });
                    if (error) throw error;
                    toast.success("Password reset link sent! Check your email.");
                    setForgotOpen(false);
                  } catch (err: any) {
                    toast.error(err.message || "Failed to send reset link.");
                  } finally {
                    setIsResetting(false);
                  }
                }}
                className="space-y-4"
              >
                <div className="space-y-2">
                  <Label htmlFor="resetEmail">Email Address</Label>
                  <div className="relative">
                    <Mail size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      id="resetEmail"
                      type="email"
                      placeholder="you@company.com"
                      className="pl-9"
                      value={resetEmail}
                      onChange={(e) => setResetEmail(e.target.value)}
                      required
                      autoFocus
                    />
                  </div>
                </div>
                <Button type="submit" className="w-full" disabled={isResetting}>
                  {isResetting ? "Sending..." : "Send Reset Link"}
                </Button>
              </form>
            </DialogContent>
          </Dialog>

          <p className="mt-4 text-center text-sm text-muted-foreground">
            {isSignUp ? "Already have an account?" : "Don't have an account?"}{" "}
            <button
              className="text-primary font-medium hover:underline"
              onClick={() => setIsSignUp(!isSignUp)}
            >
              {isSignUp ? "Sign in" : "Sign up"}
            </button>
          </p>

          {!isSignUp && (
            <p className="mt-2 text-center text-xs text-muted-foreground">
              A Super Admin must assign your role after signup.
            </p>
          )}
        </motion.div>
      </div>
    </div>
  );
};

export default Login;
