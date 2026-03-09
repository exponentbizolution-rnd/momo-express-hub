import { Outlet } from "react-router-dom";
import AppSidebar, { MobileSidebarTrigger } from "./AppSidebar";
import { Bell } from "lucide-react";

const AppLayout = () => {
  return (
    <div className="flex min-h-screen bg-background">
      <AppSidebar />
      {/* lg:pl-64 matches the desktop sidebar width; on mobile sidebar is a sheet overlay */}
      <div className="flex-1 lg:pl-64">
        <header className="sticky top-0 z-20 flex h-14 items-center justify-between border-b border-border bg-background/80 px-4 sm:px-8 backdrop-blur-sm">
          <MobileSidebarTrigger />
          <div className="flex-1" />
          <div className="flex items-center gap-4">
            <button className="relative rounded-lg p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground">
              <Bell size={18} />
              <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-destructive" />
            </button>
          </div>
        </header>
        <main className="p-4 sm:p-6 lg:p-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
};

export default AppLayout;
