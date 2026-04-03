import { useAuth, UserRole } from "@/context/AuthContext";
import { NavLink } from "@/components/NavLink";
import { useLocation } from "react-router-dom";
import {
  Factory, LayoutDashboard, FileSearch, FileText, ShoppingCart,
  Package, ClipboardCheck, Boxes, Wrench, BarChart3, ShoppingBag,
  LogOut, Menu, X
} from "lucide-react";
import { useState } from "react";

interface NavItem {
  title: string;
  url: string;
  icon: React.ElementType;
  roles: UserRole[];
}

const navItems: NavItem[] = [
  { title: "Dashboard", url: "/", icon: LayoutDashboard, roles: ["admin", "purchase", "stores", "manufacturing", "sales"] },
  { title: "Supplier Enquiries", url: "/enquiries", icon: FileSearch, roles: ["admin", "purchase"] },
  { title: "Quotations", url: "/quotations", icon: FileText, roles: ["admin", "purchase"] },
  { title: "Purchase Orders", url: "/purchase-orders", icon: ShoppingCart, roles: ["admin", "purchase"] },
  { title: "Material Receipt", url: "/material-receipt", icon: Package, roles: ["admin", "stores"] },
  { title: "Inspection", url: "/inspection", icon: ClipboardCheck, roles: ["admin", "stores"] },
  { title: "Inventory", url: "/inventory", icon: Boxes, roles: ["admin", "stores"] },
  { title: "BOM Management", url: "/bom", icon: Wrench, roles: ["admin", "manufacturing"] },
  { title: "Feasibility Analyzer", url: "/feasibility", icon: BarChart3, roles: ["admin", "manufacturing"] },
  { title: "Orders", url: "/orders", icon: ShoppingBag, roles: ["admin", "sales"] },
];

const roleLabels: Record<UserRole, string> = {
  admin: "Admin",
  purchase: "Purchase Handler",
  stores: "Stores Handler",
  manufacturing: "Manufacturing Supervisor",
  sales: "Sales Handler",
};

const AppSidebar = () => {
  const { role, username, logout } = useAuth();
  const location = useLocation();
  const [collapsed, setCollapsed] = useState(false);

  const filtered = navItems.filter((item) => item.roles.includes(role));

  return (
    <>
      {/* Mobile overlay */}
      {!collapsed && (
        <div className="fixed inset-0 bg-foreground/20 z-30 lg:hidden" onClick={() => setCollapsed(true)} />
      )}

      {/* Mobile toggle */}
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="fixed top-3 left-3 z-50 lg:hidden p-2 rounded-lg bg-card border border-border shadow-sm"
      >
        {collapsed ? <Menu className="w-5 h-5 text-foreground" /> : <X className="w-5 h-5 text-foreground" />}
      </button>

      <aside
        className={`fixed top-0 left-0 z-40 h-screen flex flex-col bg-sidebar text-sidebar-foreground transition-transform duration-300 w-64 ${
          collapsed ? "-translate-x-full lg:translate-x-0 lg:w-16" : "translate-x-0"
        }`}
      >
        {/* Logo */}
        <div className="flex items-center gap-3 px-4 h-14 border-b border-sidebar-border shrink-0">
          <Factory className="w-6 h-6 text-sidebar-primary shrink-0" />
          {!collapsed && <span className="font-bold text-sidebar-accent-foreground text-sm tracking-wide">SMOP</span>}
        </div>

        {/* Desktop collapse toggle */}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="hidden lg:flex items-center justify-center h-8 text-sidebar-foreground hover:text-sidebar-accent-foreground mx-2 mt-2 rounded-md hover:bg-sidebar-accent transition-colors"
        >
          <Menu className="w-4 h-4" />
        </button>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto py-2 px-2 space-y-0.5">
          {filtered.map((item) => {
            const isActive = location.pathname === item.url;
            return (
              <NavLink
                key={item.url}
                to={item.url}
                end
                className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${
                  isActive
                    ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium"
                    : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                }`}
                activeClassName=""
              >
                <item.icon className="w-4.5 h-4.5 shrink-0" />
                {!collapsed && <span>{item.title}</span>}
              </NavLink>
            );
          })}
        </nav>

        {/* User / Logout */}
        <div className="border-t border-sidebar-border p-3 shrink-0">
          {!collapsed && (
            <div className="mb-2 px-1">
              <p className="text-xs font-medium text-sidebar-accent-foreground truncate">{username}</p>
              <p className="text-xs text-sidebar-foreground">{roleLabels[role]}</p>
            </div>
          )}
          <button
            onClick={logout}
            className="flex items-center gap-2 w-full px-3 py-2 rounded-lg text-sm text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground transition-colors"
          >
            <LogOut className="w-4 h-4 shrink-0" />
            {!collapsed && <span>Logout</span>}
          </button>
        </div>
      </aside>
    </>
  );
};

export default AppSidebar;
