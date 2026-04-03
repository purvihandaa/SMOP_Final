import { useAuth, UserRole } from "@/context/AuthContext";
import { useQuery } from "@tanstack/react-query";
import { reportsApi } from "@/lib/api";
import {
  FileSearch, FileText, ShoppingCart, Package, ClipboardCheck,
  Boxes, Wrench, BarChart3, ShoppingBag, TrendingUp, AlertTriangle, CheckCircle2, Clock, Loader2
} from "lucide-react";
import { useNavigate } from "react-router-dom";

interface KPI {
  label: string;
  value: string;
  change?: string;
  icon: React.ElementType;
  color: string;
}

interface QuickLink {
  label: string;
  url: string;
  icon: React.ElementType;
}

const quickLinksConfig: Record<UserRole, { title: string; links: QuickLink[] }> = {
  admin: {
    title: "Admin Dashboard",
    links: [
      { label: "Supplier Enquiries", url: "/enquiries", icon: FileSearch },
      { label: "Purchase Orders", url: "/purchase-orders", icon: ShoppingCart },
      { label: "Inventory", url: "/inventory", icon: Boxes },
      { label: "Orders", url: "/orders", icon: ShoppingBag },
    ],
  },
  purchase: {
    title: "Purchase Dashboard",
    links: [
      { label: "Supplier Enquiries", url: "/enquiries", icon: FileSearch },
      { label: "Quotations", url: "/quotations", icon: FileText },
      { label: "Purchase Orders", url: "/purchase-orders", icon: ShoppingCart },
    ],
  },
  stores: {
    title: "Stores Dashboard",
    links: [
      { label: "Material Receipt", url: "/material-receipt", icon: Package },
      { label: "Inspection", url: "/inspection", icon: ClipboardCheck },
      { label: "Inventory", url: "/inventory", icon: Boxes },
    ],
  },
  manufacturing: {
    title: "Manufacturing Dashboard",
    links: [
      { label: "BOM Management", url: "/bom", icon: Wrench },
      { label: "Feasibility Analyzer", url: "/feasibility", icon: BarChart3 },
    ],
  },
  sales: {
    title: "Sales Dashboard",
    links: [
      { label: "Orders", url: "/orders", icon: ShoppingBag },
    ],
  },
};

// Map backend dashboard data into KPI cards
function buildKPIs(data: Record<string, unknown> | undefined, role: UserRole): KPI[] {
  if (!data) return [];

  const d = data as Record<string, number | undefined>;

  const allKpis: KPI[] = [
    { label: "Active POs", value: String(d.activePurchaseOrders ?? d.totalPurchaseOrders ?? 0), icon: ShoppingCart, color: "text-primary" },
    { label: "Pending Inspections", value: String(d.pendingInspections ?? 0), icon: AlertTriangle, color: "text-warning" },
    { label: "Inventory Items", value: String(d.totalInventoryItems ?? d.totalMaterials ?? 0), icon: Boxes, color: "text-success" },
    { label: "Open Orders", value: String(d.openOrders ?? d.totalOrders ?? 0), icon: ShoppingBag, color: "text-primary" },
  ];

  const roleKpis: Record<UserRole, KPI[]> = {
    admin: allKpis,
    purchase: [
      { label: "Open Enquiries", value: String(d.openEnquiries ?? d.totalEnquiries ?? 0), icon: FileSearch, color: "text-primary" },
      { label: "Pending Quotations", value: String(d.pendingQuotations ?? d.totalQuotations ?? 0), icon: Clock, color: "text-warning" },
      { label: "Active POs", value: String(d.activePurchaseOrders ?? d.totalPurchaseOrders ?? 0), icon: ShoppingCart, color: "text-success" },
      { label: "Completed POs", value: String(d.completedPurchaseOrders ?? 0), icon: CheckCircle2, color: "text-muted-foreground" },
    ],
    stores: [
      { label: "Pending Receipts", value: String(d.pendingReceipts ?? 0), icon: Package, color: "text-warning" },
      { label: "Awaiting Inspection", value: String(d.pendingInspections ?? 0), icon: ClipboardCheck, color: "text-primary" },
      { label: "Low Stock Items", value: String(d.lowStockItems ?? 0), icon: AlertTriangle, color: "text-destructive" },
      { label: "Total Materials", value: String(d.totalMaterials ?? d.totalInventoryItems ?? 0), icon: Boxes, color: "text-success" },
    ],
    manufacturing: [
      { label: "Active BOMs", value: String(d.totalBOMs ?? d.activeBOMs ?? 0), icon: Wrench, color: "text-primary" },
      { label: "Feasible Products", value: String(d.feasibleProducts ?? 0), icon: CheckCircle2, color: "text-success" },
      { label: "Material Shortage", value: String(d.materialShortages ?? 0), icon: AlertTriangle, color: "text-destructive" },
      { label: "Efficiency", value: `${d.efficiency ?? 0}%`, icon: TrendingUp, color: "text-success" },
    ],
    sales: [
      { label: "Open Orders", value: String(d.openOrders ?? d.totalOrders ?? 0), icon: ShoppingBag, color: "text-primary" },
      { label: "Pending Confirmation", value: String(d.pendingOrders ?? 0), icon: Clock, color: "text-warning" },
      { label: "Confirmed Orders", value: String(d.confirmedOrders ?? 0), icon: CheckCircle2, color: "text-success" },
      { label: "Revenue (₹)", value: d.totalRevenue ? `${(Number(d.totalRevenue) / 100000).toFixed(1)}L` : "0", icon: TrendingUp, color: "text-success" },
    ],
  };

  return roleKpis[role] || allKpis;
}

const Dashboard = () => {
  const { role } = useAuth();
  const navigate = useNavigate();
  const cfg = quickLinksConfig[role];

  const { data: dashboardRes, isLoading } = useQuery({
    queryKey: ["dashboard"],
    queryFn: () => reportsApi.dashboard(),
  });

  const kpis = buildKPIs(dashboardRes?.data as Record<string, unknown> | undefined, role);

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-bold text-foreground">{cfg.title}</h1>

      {/* KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {isLoading
          ? Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="kpi-card flex items-center justify-center h-24">
                <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
              </div>
            ))
          : kpis.map((kpi, i) => (
              <div key={i} className="kpi-card flex items-start justify-between" style={{ animationDelay: `${i * 80}ms` }}>
                <div>
                  <p className="text-xs font-medium text-muted-foreground mb-1">{kpi.label}</p>
                  <p className="text-2xl font-bold text-foreground">{kpi.value}</p>
                  {kpi.change && <span className="text-xs text-success font-medium">{kpi.change}</span>}
                </div>
                <div className={`p-2 rounded-lg bg-muted ${kpi.color}`}>
                  <kpi.icon className="w-5 h-5" />
                </div>
              </div>
            ))}
      </div>

      {/* Quick Links */}
      <div>
        <h2 className="text-sm font-semibold text-foreground mb-3">Quick Access</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {cfg.links.map((link, i) => (
            <button
              key={i}
              onClick={() => navigate(link.url)}
              className="flex items-center gap-3 p-4 rounded-xl bg-card border border-border hover:border-primary/30 hover:shadow-sm transition-all text-left group"
            >
              <div className="p-2 rounded-lg bg-primary/10 text-primary group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
                <link.icon className="w-4 h-4" />
              </div>
              <span className="text-sm font-medium text-foreground">{link.label}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
