import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { LucideIcon } from "lucide-react";

interface StatCardProps {
  title: string;
  value: string;
  subtitle?: string;
  icon: LucideIcon;
  trend?: { value: string; positive: boolean };
  variant?: "default" | "primary" | "accent" | "success";
}

const variantStyles = {
  default: "bg-card border border-border",
  primary: "bg-primary text-primary-foreground",
  accent: "bg-accent text-accent-foreground",
  success: "bg-success text-success-foreground",
};

const iconVariantStyles = {
  default: "bg-muted text-muted-foreground",
  primary: "bg-primary-foreground/20 text-primary-foreground",
  accent: "bg-accent-foreground/10 text-accent-foreground",
  success: "bg-success-foreground/20 text-success-foreground",
};

const StatCard = ({ title, value, subtitle, icon: Icon, trend, variant = "default" }: StatCardProps) => (
  <motion.div
    initial={{ opacity: 0, y: 12 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ duration: 0.35 }}
    className={cn("rounded-xl p-5", variantStyles[variant])}
  >
    <div className="flex items-start justify-between">
      <div className="space-y-1">
        <p className={cn("text-sm font-medium", variant === "default" ? "text-muted-foreground" : "opacity-80")}>
          {title}
        </p>
        <p className="font-display text-2xl font-bold tracking-tight">{value}</p>
        {subtitle && (
          <p className={cn("text-xs", variant === "default" ? "text-muted-foreground" : "opacity-60")}>{subtitle}</p>
        )}
        {trend && (
          <p className={cn("text-xs font-medium", trend.positive ? "text-success" : "text-destructive")}>
            {trend.positive ? "↑" : "↓"} {trend.value}
          </p>
        )}
      </div>
      <div className={cn("flex h-10 w-10 items-center justify-center rounded-lg", iconVariantStyles[variant])}>
        <Icon size={20} />
      </div>
    </div>
  </motion.div>
);

export default StatCard;
