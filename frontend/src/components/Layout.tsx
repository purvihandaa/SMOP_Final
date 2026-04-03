import { ReactNode } from "react";
import AppSidebar from "./AppSidebar";
import { useAuth } from "@/context/AuthContext";

const roleLabels: Record<string, string> = {
  admin: "Admin",
  purchase: "Purchase Handler",
  stores: "Stores Handler",
  manufacturing: "Manufacturing Supervisor",
  sales: "Sales Handler",
  // Backend role enum values (fallback)
  ADMINISTRATOR: "Admin",
  PURCHASE_HANDLER: "Purchase Handler",
  STORES_HANDLER: "Stores Handler",
  MANUFACTURING_SUPERVISOR: "Manufacturing Supervisor",
  MANUFACTURING_WORKER: "Manufacturing Worker",
  SALES_HANDLER: "Sales Handler",
  MANAGEMENT: "Management",
};

const Layout = ({ children }: { children: ReactNode }) => {
  const { role, user } = useAuth();

  const displayRole = roleLabels[role] || roleLabels[user?.backendRole ?? ""] || role;
  const displayName = user?.fullName || user?.username || "";

  return (
    <div className="min-h-screen flex">
      <AppSidebar />
      <div className="flex-1 lg:ml-64 flex flex-col min-h-screen">
        <header className="sticky top-0 z-20 h-14 flex items-center justify-between px-6 bg-card/80 backdrop-blur-md border-b border-border">
          <div className="pl-10 lg:pl-0">
            <h2 className="text-sm font-semibold text-foreground">Speedage Manufacturing Operations</h2>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs px-2.5 py-1 rounded-full bg-primary/10 text-primary font-medium">{displayRole}</span>
            <span className="text-sm text-muted-foreground hidden sm:inline">{displayName}</span>
          </div>
        </header>
        <main className="flex-1 p-4 sm:p-6 animate-fade-in">
          {children}
        </main>
      </div>
    </div>
  );
};

export default Layout;
