import { Zap } from "lucide-react";

const Logo = ({ collapsed = false }: { collapsed?: boolean }) => (
  <div className="flex items-center gap-2.5">
    <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-accent">
      <Zap className="h-5 w-5 text-accent-foreground" strokeWidth={2.5} />
    </div>
    {!collapsed && (
      <span className="font-display text-xl font-bold tracking-tight text-sidebar-foreground">
        Expo<span className="text-accent">Pay</span>
      </span>
    )}
  </div>
);

export default Logo;
