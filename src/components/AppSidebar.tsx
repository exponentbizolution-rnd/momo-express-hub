import { useState } from "react";
import { NavLink, useLocation, useNavigate } from "react-router-dom";
import {
  LayoutDashboard,
  Upload,
  ClipboardList,
  BarChart3,
  Shield,
  Settings,
  LogOut,
  Menu,
} from "lucide-react";
import Logo from "./Logo";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Sheet, SheetContent, SheetTrigger, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";

const navItems = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/upload", label: "Bulk Upload", icon: Upload, roles: ["initiator", "super_admin"] },
  { to: "/batches", label: "Batches", icon: ClipboardList },
  { to: "/reports", label: "Reports", icon: BarChart3 },
  { to: "/audit", label: "Audit Log", icon: Shield },
  { to: "/users", label: "User Management", icon: Settings, roles: ["super_admin"] },
  { to: "/settings", label: "Settings", icon: Settings, roles: ["super_admin"] },
];

function SidebarContent({ onNavigate }: { onNavigate?: () => void }) {
  const location = useLocation();
  const navigate = useNavigate();
  const { profile, role, signOut } = useAuth();

  const canApprove = role === "approver" || role === "super_admin";

  const { data: pendingCount } = useQuery({
    queryKey: ["pending-batches-count"],
    queryFn: async () => {
      const { count, error } = await supabase
        .from("batches")
        .select("*", { count: "exact", head: true })
        .eq("status", "pending");
      if (error) throw error;
      return count || 0;
    },
    enabled: canApprove,
    refetchInterval: 15000,
  });

  const handleLogout = async () => {
    await signOut();
    navigate("/login");
  };

  const visibleNav = navItems.filter(
    (item) => !item.roles || (role && item.roles.includes(role))
  );

  const initials = profile?.full_name
    ? profile.full_name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2)
    : "?";

  const roleLabel: Record<string, string> = {
    super_admin: "Super Admin",
    initiator: "Payment Initiator",
    approver: "Payment Approver",
    auditor: "Auditor",
  };

  return (
    <>
      <div className="flex h-16 items-center justify-between px-5 border-b border-sidebar-border">
        <Logo />
      </div>

      <nav className="flex-1 space-y-1 px-3 py-4 overflow-y-auto">
        {visibleNav.map((item) => {
          const isActive = location.pathname === item.to;
          const showBadge = item.to === "/batches" && canApprove && pendingCount && pendingCount > 0;
          return (
            <NavLink
              key={item.to}
              to={item.to}
              onClick={onNavigate}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                isActive
                  ? "bg-sidebar-accent text-sidebar-primary"
                  : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
              )}
            >
              <item.icon size={18} />
              <span className="flex-1">{item.label}</span>
              {showBadge && (
                <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-destructive px-1.5 text-[10px] font-bold text-destructive-foreground">
                  {pendingCount}
                </span>
              )}
            </NavLink>
          );
        })}
      </nav>

      <div className="space-y-1 border-t border-sidebar-border px-3 py-4">
        <button
          onClick={handleLogout}
          className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-destructive/80 transition-colors hover:bg-destructive/10 hover:text-destructive"
        >
          <LogOut size={18} />
          Logout
        </button>
      </div>

      <div className="border-t border-sidebar-border px-4 py-3">
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">
            {initials}
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-sidebar-foreground">
              {profile?.full_name || "User"}
            </p>
            <p className="truncate text-xs text-sidebar-foreground/50">
              {role ? roleLabel[role] || role : "No role assigned"}
            </p>
          </div>
        </div>
      </div>
    </>
  );
}

/** Desktop sidebar (hidden on mobile) */
function DesktopSidebar() {
  return (
    <aside className="hidden lg:flex fixed inset-y-0 left-0 z-30 w-64 flex-col bg-sidebar border-r border-sidebar-border">
      <SidebarContent />
    </aside>
  );
}

/** Mobile sidebar trigger button — exposed for AppLayout header */
export function MobileSidebarTrigger() {
  const [open, setOpen] = useState(false);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon" className="lg:hidden">
          <Menu size={20} />
          <span className="sr-only">Toggle menu</span>
        </Button>
      </SheetTrigger>
      <SheetContent side="left" className="w-64 p-0 bg-sidebar border-sidebar-border" aria-describedby={undefined}>
        <SheetTitle className="sr-only">Navigation Menu</SheetTitle>
        <SidebarContent onNavigate={() => setOpen(false)} />
      </SheetContent>
    </Sheet>
  );
}

const AppSidebar = () => {
  return <DesktopSidebar />;
};

export default AppSidebar;
