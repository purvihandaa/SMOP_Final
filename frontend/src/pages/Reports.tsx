import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { reportsApi } from "@/lib/api";
import {
  Loader2, TrendingUp, Calendar, DollarSign,
  Package, ShoppingCart, ClipboardCheck, BarChart3,
} from "lucide-react";

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

const Reports = () => {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [activeTab, setActiveTab] = useState<"monthly" | "annual" | "trends">("monthly");

  const { data: monthlyData, isLoading: monthlyLoading } = useQuery({
    queryKey: ["reports-monthly", year, month],
    queryFn: () => reportsApi.monthly(year, month),
    enabled: activeTab === "monthly",
  });

  const { data: annualData, isLoading: annualLoading } = useQuery({
    queryKey: ["reports-annual", year],
    queryFn: () => reportsApi.annual(year),
    enabled: activeTab === "annual",
  });

  const { data: trendsData, isLoading: trendsLoading } = useQuery({
    queryKey: ["reports-trends"],
    queryFn: () => reportsApi.trends(30),
    enabled: activeTab === "trends",
  });

  const monthly = monthlyData?.data as Record<string, unknown> | undefined;
  const annual = annualData?.data as Record<string, unknown> | undefined;
  const trends = trendsData?.data as Record<string, unknown> | undefined;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <TrendingUp className="w-5 h-5 text-primary" />
          <h1 className="text-xl font-bold text-foreground">Reports & Analytics</h1>
        </div>
      </div>

      {/* Tab bar */}
      <div className="flex gap-1 p-1 bg-muted/50 rounded-lg w-fit">
        {(["monthly", "annual", "trends"] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              activeTab === tab
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {tab.charAt(0).toUpperCase() + tab.slice(1)}
          </button>
        ))}
      </div>

      {/* ── Monthly Report ─────────────────────────────────────────────── */}
      {activeTab === "monthly" && (
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-muted-foreground" />
              <select
                value={month}
                onChange={(e) => setMonth(Number(e.target.value))}
                className="rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring/30"
              >
                {MONTHS.map((m, i) => (
                  <option key={i} value={i + 1}>{m}</option>
                ))}
              </select>
            </div>
            <select
              value={year}
              onChange={(e) => setYear(Number(e.target.value))}
              className="rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring/30"
            >
              {[2024, 2025, 2026, 2027].map(y => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
          </div>

          {monthlyLoading ? (
            <div className="flex items-center justify-center p-12"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
          ) : monthly ? (
            <div className="space-y-4">
              {/* KPI cards */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                <KpiCard
                  icon={ShoppingCart}
                  label="POs Created"
                  value={String((monthly.purchaseOrders as any)?.created ?? 0)}
                  color="text-blue-400"
                />
                <KpiCard
                  icon={Package}
                  label="POs Delivered"
                  value={String((monthly.purchaseOrders as any)?.delivered ?? 0)}
                  color="text-emerald-400"
                />
                <KpiCard
                  icon={ClipboardCheck}
                  label="Material Receipts"
                  value={String((monthly.materials as any)?.receipts ?? 0)}
                  color="text-amber-400"
                />
                <KpiCard
                  icon={ClipboardCheck}
                  label="Inspections"
                  value={String((monthly.materials as any)?.inspections ?? 0)}
                  color="text-purple-400"
                />
              </div>

              {/* Financial */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="kpi-card">
                  <p className="text-xs text-muted-foreground mb-1">Orders Confirmed</p>
                  <p className="text-2xl font-bold text-foreground">{(monthly.sales as any)?.ordersConfirmed ?? 0}</p>
                </div>
                <div className="kpi-card">
                  <p className="text-xs text-muted-foreground mb-1">Purchase Value</p>
                  <p className="text-2xl font-bold text-rose-400">₹{Number((monthly.purchaseOrders as any)?.totalValue ?? 0).toLocaleString()}</p>
                </div>
                <div className="kpi-card">
                  <p className="text-xs text-muted-foreground mb-1">Sales Revenue</p>
                  <p className="text-2xl font-bold text-emerald-400">₹{Number((monthly.sales as any)?.totalValue ?? 0).toLocaleString()}</p>
                </div>
              </div>
            </div>
          ) : (
            <p className="text-muted-foreground text-sm">No data available</p>
          )}
        </div>
      )}

      {/* ── Annual Report ──────────────────────────────────────────────── */}
      {activeTab === "annual" && (
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <Calendar className="w-4 h-4 text-muted-foreground" />
            <select
              value={year}
              onChange={(e) => setYear(Number(e.target.value))}
              className="rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring/30"
            >
              {[2024, 2025, 2026, 2027].map(y => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
          </div>

          {annualLoading ? (
            <div className="flex items-center justify-center p-12"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
          ) : annual ? (
            <div className="space-y-4">
              {/* Annual totals */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="kpi-card">
                  <p className="text-xs text-muted-foreground mb-1">Total Purchase Value ({year})</p>
                  <p className="text-2xl font-bold text-rose-400">
                    ₹{Number((annual.totals as any)?.purchaseValue ?? 0).toLocaleString()}
                  </p>
                </div>
                <div className="kpi-card">
                  <p className="text-xs text-muted-foreground mb-1">Total Sales Value ({year})</p>
                  <p className="text-2xl font-bold text-emerald-400">
                    ₹{Number((annual.totals as any)?.salesValue ?? 0).toLocaleString()}
                  </p>
                </div>
              </div>

              {/* Monthly breakdown table */}
              <div className="bg-card rounded-xl border border-border overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead><tr className="border-b border-border bg-muted/50">
                      <th className="text-left px-4 py-3 font-medium text-muted-foreground">Month</th>
                      <th className="text-right px-4 py-3 font-medium text-muted-foreground">Purchase Orders</th>
                      <th className="text-right px-4 py-3 font-medium text-muted-foreground">Purchase Value (₹)</th>
                      <th className="text-right px-4 py-3 font-medium text-muted-foreground">Customer Orders</th>
                      <th className="text-right px-4 py-3 font-medium text-muted-foreground">Sales Value (₹)</th>
                    </tr></thead>
                    <tbody>
                      {((annual.monthly as any[]) ?? []).map((row: any) => (
                        <tr key={row.month} className="border-b border-border/50 hover:bg-muted/20 transition-colors">
                          <td className="px-4 py-3 text-foreground">{MONTHS[row.month - 1]}</td>
                          <td className="px-4 py-3 text-right text-foreground">{row.purchaseOrders}</td>
                          <td className="px-4 py-3 text-right text-rose-400 font-medium">₹{Number(row.purchaseValue).toLocaleString()}</td>
                          <td className="px-4 py-3 text-right text-foreground">{row.customerOrders}</td>
                          <td className="px-4 py-3 text-right text-emerald-400 font-medium">₹{Number(row.salesValue).toLocaleString()}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          ) : (
            <p className="text-muted-foreground text-sm">No data available</p>
          )}
        </div>
      )}

      {/* ── Trends (30 days) ──────────────────────────────────────────── */}
      {activeTab === "trends" && (
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">Activity over the last 30 days</p>

          {trendsLoading ? (
            <div className="flex items-center justify-center p-12"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
          ) : trends ? (
            <div className="space-y-4">
              {/* PO trend */}
              <div className="bg-card rounded-xl border border-border p-4">
                <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
                  <ShoppingCart className="w-4 h-4 text-blue-400" /> Purchase Orders by Status
                </h3>
                <div className="flex flex-wrap gap-2">
                  {((trends.purchaseOrders as any[]) ?? []).map((item: any) => (
                    <div key={item.status} className="flex items-center gap-2 px-3 py-2 rounded-lg bg-muted/30 border border-border/50">
                      <span className="text-xs text-muted-foreground">{item.status}</span>
                      <span className="text-sm font-bold text-foreground">{item.count}</span>
                    </div>
                  ))}
                  {((trends.purchaseOrders as any[]) ?? []).length === 0 && (
                    <p className="text-xs text-muted-foreground">No purchase order activity</p>
                  )}
                </div>
              </div>

              {/* Customer order trend */}
              <div className="bg-card rounded-xl border border-border p-4">
                <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
                  <BarChart3 className="w-4 h-4 text-emerald-400" /> Customer Orders by Status
                </h3>
                <div className="flex flex-wrap gap-2">
                  {((trends.customerOrders as any[]) ?? []).map((item: any) => (
                    <div key={item.status} className="flex items-center gap-2 px-3 py-2 rounded-lg bg-muted/30 border border-border/50">
                      <span className="text-xs text-muted-foreground">{item.status}</span>
                      <span className="text-sm font-bold text-foreground">{item.count}</span>
                    </div>
                  ))}
                  {((trends.customerOrders as any[]) ?? []).length === 0 && (
                    <p className="text-xs text-muted-foreground">No customer order activity</p>
                  )}
                </div>
              </div>

              {/* Inventory activity */}
              <div className="bg-card rounded-xl border border-border p-4">
                <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
                  <Package className="w-4 h-4 text-amber-400" /> Inventory Transactions
                </h3>
                <div className="flex flex-wrap gap-2">
                  {((trends.inventoryActivity as any[]) ?? []).map((item: any) => (
                    <div key={item.type} className="flex items-center gap-2 px-3 py-2 rounded-lg bg-muted/30 border border-border/50">
                      <span className="text-xs text-muted-foreground">{item.type}</span>
                      <span className="text-sm font-bold text-foreground">{item.count} txns</span>
                      <span className="text-xs text-muted-foreground">({item.totalQuantity} units)</span>
                    </div>
                  ))}
                  {((trends.inventoryActivity as any[]) ?? []).length === 0 && (
                    <p className="text-xs text-muted-foreground">No inventory activity</p>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <p className="text-muted-foreground text-sm">No data available</p>
          )}
        </div>
      )}
    </div>
  );
};

// ── KPI Card helper ─────────────────────────────────────────────────────────
function KpiCard({ icon: Icon, label, value, color }: { icon: React.ElementType; label: string; value: string; color: string }) {
  return (
    <div className="kpi-card">
      <div className="flex items-center gap-2 mb-1">
        <Icon className={`w-4 h-4 ${color}`} />
        <p className="text-xs text-muted-foreground">{label}</p>
      </div>
      <p className="text-2xl font-bold text-foreground">{value}</p>
    </div>
  );
}

export default Reports;
