import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Zap, Eye, EyeOff, Lock, Mail, Smartphone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";

const Login = () => {
  const navigate = useNavigate();
  const [step, setStep] = useState<"login" | "2fa">("login");
  const [showPassword, setShowPassword] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [otp, setOtp] = useState("");

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setStep("2fa");
  };

  const handleVerify = () => {
    navigate("/dashboard");
  };

  return (
    <div className="flex min-h-screen">
      {/* Left Panel - Branding */}
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

      {/* Right Panel - Form */}
      <div className="flex flex-1 items-center justify-center p-8">
        <motion.div
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          className="w-full max-w-sm"
        >
          {/* Mobile logo */}
          <div className="mb-8 flex items-center gap-2.5 lg:hidden">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-accent">
              <Zap className="h-5 w-5 text-accent-foreground" strokeWidth={2.5} />
            </div>
            <span className="font-display text-xl font-bold">
              Expo<span className="text-accent">Pay</span>
            </span>
          </div>

          {step === "login" ? (
            <>
              <div className="mb-6">
                <h2 className="font-display text-xl font-bold">Welcome back</h2>
                <p className="text-sm text-muted-foreground mt-1">Sign in to your ExpoPay account</p>
              </div>

              <form onSubmit={handleLogin} className="space-y-4">
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

                <div className="flex items-center justify-between text-sm">
                  <label className="flex items-center gap-2 text-muted-foreground">
                    <input type="checkbox" className="rounded border-border" />
                    Remember me
                  </label>
                  <a href="#" className="text-primary font-medium hover:underline">
                    Forgot password?
                  </a>
                </div>

                <Button type="submit" className="w-full">
                  Sign In
                </Button>
              </form>

              <p className="mt-6 text-center text-xs text-muted-foreground">
                Account locked after 5 failed attempts · 30-min session timeout
              </p>
            </>
          ) : (
            <>
              <div className="mb-6">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 mb-4">
                  <Smartphone size={22} className="text-primary" />
                </div>
                <h2 className="font-display text-xl font-bold">Two-Factor Authentication</h2>
                <p className="text-sm text-muted-foreground mt-1">
                  Enter the 6-digit code sent to your registered phone number
                </p>
              </div>

              <div className="space-y-6">
                <InputOTP maxLength={6} value={otp} onChange={setOtp}>
                  <InputOTPGroup className="gap-2 w-full justify-center">
                    {[0, 1, 2, 3, 4, 5].map((i) => (
                      <InputOTPSlot key={i} index={i} className="h-12 w-12 text-lg" />
                    ))}
                  </InputOTPGroup>
                </InputOTP>

                <Button onClick={handleVerify} className="w-full" disabled={otp.length < 6}>
                  Verify & Continue
                </Button>

                <p className="text-center text-sm text-muted-foreground">
                  Didn't receive the code?{" "}
                  <button className="text-primary font-medium hover:underline">Resend</button>
                </p>
              </div>
            </>
          )}
        </motion.div>
      </div>
    </div>
  );
};

export default Login;
