import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { salesApi } from "@/lib/api";
import {
  Plus, Loader2, ChevronRight, X, ArrowRight,
  Package, Truck, CheckCircle2, XCircle, Factory, Clock,
} from "lucide-react";
import { StatusBadge, Modal } from "./SupplierEnquiry";
import { toast } from "sonner";
import { useLocation } from "react-router-dom";

// ── Status pipeline config ──────────────────────────────────────────────────
const STATUS_PIPELINE = [
  "CONFIRMED",
  "IN_PRODUCTION",
  "READY_TO_DISPATCH",
  "DISPATCHED",
  "DELIVERED",
] as const;

const STATUS_META: Record<string, { label: string; icon: React.ElementType; color: string }> = {
  CONFIRMED:         { label: "Confirmed",        icon: CheckCircle2, color: "text-blue-400" },
  IN_PRODUCTION:     { label: "In Production",    icon: Factory,      color: "text-amber-400" },
  READY_TO_DISPATCH: { label: "Ready to Dispatch", icon: Package,     color: "text-purple-400" },
  DISPATCHED:        { label: "Dispatched",       icon: Truck,        color: "text-cyan-400" },
  DELIVERED:         { label: "Delivered",         icon: CheckCircle2, color: "text-emerald-400" },
  CANCELLED:         { label: "Cancelled",         icon: XCircle,     color: "text-destructive" },
};

const NEXT_STATUS: Record<string, string> = {
  CONFIRMED: "IN_PRODUCTION",
  IN_PRODUCTION: "READY_TO_DISPATCH",
  READY_TO_DISPATCH: "DISPATCHED",
  DISPATCHED: "DELIVERED",
};

const NEXT_LABEL: Record<string, string> = {
  CONFIRMED: "Start Production",
  IN_PRODUCTION: "Mark Ready",
  READY_TO_DISPATCH: "Mark Dispatched",
  DISPATCHED: "Mark Delivered",
};

// ── Component ───────────────────────────────────────────────────────────────
const OrderConfirmation = () => {
  const queryClient = useQueryClient();
  const location = useLocation();
  const prefill = location.state as { productName?: string; quantity?: number } | null;

  const [showModal, setShowModal] = useState(!!prefill);
  const [detailOrder, setDetailOrder] = useState<Record<string, unknown> | null>(null);
  const [cancelTarget, setCancelTarget] = useState<Record<string, unknown> | null>(null);
  const [cancelRemarks, setCancelRemarks] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [form, setForm] = useState({
    customerName: "",
    customerEmail: "",
    customerPhone: "",
    productName: prefill?.productName || "",
    quantity: prefill?.quantity ? String(prefill.quantity) : "",
    totalAmount: "",
    expectedDelivery: "",
    remarks: "",
  });

  const { data: ordersRes, isLoading } = useQuery({
    queryKey: ["orders", statusFilter],
    queryFn: () => salesApi.listOrders({ limit: 100, status: statusFilter || undefined }),
  });

  const confirmMutation = useMutation({
    mutationFn: () =>
      salesApi.confirmOrder({
        customerName: form.customerName,
        customerEmail: form.customerEmail || undefined,
        customerPhone: form.customerPhone || undefined,
        productName: form.productName,
        quantity: Number(form.quantity),
        totalAmount: Number(form.totalAmount),
        expectedDelivery: form.expectedDelivery ? new Date(form.expectedDelivery).toISOString() : undefined,
        remarks: form.remarks || undefined,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["orders"] });
      queryClient.invalidateQueries({ queryKey: ["inventory"] });
      setShowModal(false);
      resetForm();
      toast.success("Order confirmed — inventory updated!");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const statusMutation = useMutation({
    mutationFn: (data: { id: string; status: string; remarks?: string }) =>
      salesApi.updateOrderStatus(data),
    onSuccess: (_res, vars) => {
      queryClient.invalidateQueries({ queryKey: ["orders"] });
      queryClient.invalidateQueries({ queryKey: ["inventory"] });
      setDetailOrder(null);
      setCancelTarget(null);
      setCancelRemarks("");
      const label = STATUS_META[vars.status]?.label || vars.status;
      toast.success(`Order moved to ${label}`);
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const resetForm = () =>
    setForm({ customerName: "", customerEmail: "", customerPhone: "", productName: prefill?.productName || "", quantity: prefill?.quantity ? String(prefill.quantity) : "", totalAmount: "", expectedDelivery: "", remarks: "" });

  const orders = (ordersRes?.data ?? []) as Array<Record<string, unknown>>;

  // Summary stats
  const allOrders = orders;
  const confirmed = allOrders.filter(o => o.status === "CONFIRMED").length;
  const inProduction = allOrders.filter(o => o.status === "IN_PRODUCTION").length;
  const readyToDispatch = allOrders.filter(o => o.status === "READY_TO_DISPATCH").length;
  const dispatched = allOrders.filter(o => o.status === "DISPATCHED").length;
  const delivered = allOrders.filter(o => o.status === "DELIVERED").length;
  const cancelled = allOrders.filter(o => o.status === "CANCELLED").length;
  const totalRevenue = allOrders.filter(o => o.status !== "CANCELLED").reduce((sum, o) => sum + Number(o.totalAmount ?? 0), 0);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-foreground">Order Management</h1>
        <button onClick={() => setShowModal(true)} className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors">
          <Plus className="w-4 h-4" /> New Order
        </button>
      </div>

      {/* Pipeline KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
        {[
          { label: "Total", value: allOrders.length, color: "text-foreground", filter: "" },
          { label: "Confirmed", value: confirmed, color: "text-blue-400", filter: "CONFIRMED" },
          { label: "In Production", value: inProduction, color: "text-amber-400", filter: "IN_PRODUCTION" },
          { label: "Ready", value: readyToDispatch, color: "text-purple-400", filter: "READY_TO_DISPATCH" },
          { label: "Dispatched", value: dispatched, color: "text-cyan-400", filter: "DISPATCHED" },
          { label: "Delivered", value: delivered, color: "text-emerald-400", filter: "DELIVERED" },
          { label: "Cancelled", value: cancelled, color: "text-destructive", filter: "CANCELLED" },
        ].map((kpi) => (
          <button
            key={kpi.label}
            onClick={() => setStatusFilter(kpi.filter === statusFilter ? "" : kpi.filter)}
            className={`kpi-card text-left transition-all ${kpi.filter === statusFilter ? "ring-2 ring-primary" : ""}`}
          >
            <p className="text-[10px] font-medium text-muted-foreground mb-0.5">{kpi.label}</p>
            <p className={`text-lg font-bold ${kpi.color}`}>{kpi.value}</p>
          </button>
        ))}
      </div>

      {/* Revenue bar */}
      <div className="kpi-card flex items-center justify-between">
        <p className="text-xs font-medium text-muted-foreground">Total Revenue (excl. cancelled)</p>
        <p className="text-lg font-bold text-emerald-400">₹{totalRevenue.toLocaleString()}</p>
      </div>

      {/* Orders table */}
      <div className="bg-card rounded-xl border border-border overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center p-12"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="border-b border-border bg-muted/50">
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Order #</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Customer</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Product</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Qty</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Amount (₹)</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Expected</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Status</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Actions</th>
              </tr></thead>
              <tbody>
                {orders.length === 0 ? (
                  <tr><td colSpan={8} className="text-center py-8 text-muted-foreground">No orders found</td></tr>
                ) : orders.map((o) => {
                  const status = o.status as string;
                  const nextStatus = NEXT_STATUS[status];
                  const nextLabel = NEXT_LABEL[status];
                  const canCancel = ["CONFIRMED", "IN_PRODUCTION", "READY_TO_DISPATCH"].includes(status);
                  return (
                    <tr key={o.id as string} className="border-b border-border/50 hover:bg-muted/30 transition-colors">
                      <td className="px-4 py-3 font-mono text-foreground text-xs">{(o.orderNo ?? o.id) as string}</td>
                      <td className="px-4 py-3 text-foreground">{(o.customerName ?? "") as string}</td>
                      <td className="px-4 py-3 text-foreground">{(o.productName ?? "") as string}</td>
                      <td className="px-4 py-3 text-foreground">{String(o.quantity ?? "")}</td>
                      <td className="px-4 py-3 text-foreground font-medium">₹{o.totalAmount ? Number(o.totalAmount).toLocaleString() : "—"}</td>
                      <td className="px-4 py-3 text-foreground text-xs">{o.expectedDelivery ? new Date(o.expectedDelivery as string).toLocaleDateString() : "—"}</td>
                      <td className="px-4 py-3"><StatusBadge status={status} /></td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1.5">
                          {nextStatus && (
                            <button
                              onClick={() => statusMutation.mutate({ id: o.id as string, status: nextStatus })}
                              disabled={statusMutation.isPending}
                              className="flex items-center gap-1 px-2.5 py-1 rounded-md bg-primary/10 text-primary text-xs font-medium hover:bg-primary/20 transition-colors disabled:opacity-50"
                            >
                              <ArrowRight className="w-3 h-3" />
                              {nextLabel}
                            </button>
                          )}
                          {canCancel && (
                            <button
                              onClick={() => setCancelTarget(o)}
                              className="flex items-center gap-1 px-2.5 py-1 rounded-md bg-destructive/10 text-destructive text-xs font-medium hover:bg-destructive/20 transition-colors"
                            >
                              <XCircle className="w-3 h-3" />
                              Cancel
                            </button>
                          )}
                          <button
                            onClick={() => setDetailOrder(o)}
                            className="flex items-center gap-1 px-2 py-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted/50 text-xs transition-colors"
                          >
                            <ChevronRight className="w-3 h-3" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Order Detail Modal ─────────────────────────────────────────── */}
      {detailOrder && (
        <Modal title={`Order: ${(detailOrder.orderNo ?? detailOrder.id) as string}`} onClose={() => setDetailOrder(null)}>
          <div className="space-y-4">
            {/* Pipeline progress */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-2">
              {STATUS_PIPELINE.map((s, i) => {
                const meta = STATUS_META[s];
                const Icon = meta.icon;
                const currentIdx = STATUS_PIPELINE.indexOf(detailOrder.status as typeof STATUS_PIPELINE[number]);
                const isActive = i <= currentIdx;
                const isCurrent = s === detailOrder.status;
                return (
                  <div key={s} className="flex items-center gap-1.5 shrink-0">
                    {i > 0 && <div className={`w-4 h-0.5 rounded-full ${isActive ? "bg-primary" : "bg-muted"}`} />}
                    <div className={`flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium transition-colors ${
                      isCurrent ? "bg-primary/15 text-primary ring-1 ring-primary/30" : isActive ? "text-foreground" : "text-muted-foreground"
                    }`}>
                      <Icon className="w-3 h-3" />
                      {meta.label}
                    </div>
                  </div>
                );
              })}
              {detailOrder.status === "CANCELLED" && (
                <div className="flex items-center gap-1 px-2 py-1 rounded-md bg-destructive/15 text-destructive text-xs font-medium ring-1 ring-destructive/30">
                  <XCircle className="w-3 h-3" /> Cancelled
                </div>
              )}
            </div>

            {/* Detail fields */}
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <p className="text-xs text-muted-foreground">Customer</p>
                <p className="font-medium text-foreground">{(detailOrder.customerName ?? "—") as string}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Product</p>
                <p className="font-medium text-foreground">{(detailOrder.productName ?? "—") as string}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Quantity</p>
                <p className="font-medium text-foreground">{String(detailOrder.quantity ?? "—")}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Amount</p>
                <p className="font-medium text-emerald-400">₹{detailOrder.totalAmount ? Number(detailOrder.totalAmount).toLocaleString() : "—"}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Confirmed</p>
                <p className="font-medium text-foreground">{detailOrder.confirmedDate ? new Date(detailOrder.confirmedDate as string).toLocaleDateString() : "—"}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Expected Delivery</p>
                <p className="font-medium text-foreground">{detailOrder.expectedDelivery ? new Date(detailOrder.expectedDelivery as string).toLocaleDateString() : "—"}</p>
              </div>
              {detailOrder.customerEmail && (
                <div>
                  <p className="text-xs text-muted-foreground">Email</p>
                  <p className="font-medium text-foreground">{detailOrder.customerEmail as string}</p>
                </div>
              )}
              {detailOrder.customerPhone && (
                <div>
                  <p className="text-xs text-muted-foreground">Phone</p>
                  <p className="font-medium text-foreground">{detailOrder.customerPhone as string}</p>
                </div>
              )}
              {detailOrder.remarks && (
                <div className="col-span-2">
                  <p className="text-xs text-muted-foreground">Remarks</p>
                  <p className="text-foreground">{detailOrder.remarks as string}</p>
                </div>
              )}
            </div>

            {/* Action buttons */}
            {(() => {
              const status = detailOrder.status as string;
              const nextStatus = NEXT_STATUS[status];
              const nextLabel = NEXT_LABEL[status];
              const canCancel = ["CONFIRMED", "IN_PRODUCTION", "READY_TO_DISPATCH"].includes(status);
              if (!nextStatus && !canCancel) return null;
              return (
                <div className="flex items-center gap-2 pt-2 border-t border-border">
                  {nextStatus && (
                    <button
                      onClick={() => statusMutation.mutate({ id: detailOrder.id as string, status: nextStatus })}
                      disabled={statusMutation.isPending}
                      className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-50"
                    >
                      {statusMutation.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
                      <ArrowRight className="w-4 h-4" />
                      {nextLabel}
                    </button>
                  )}
                  {canCancel && (
                    <button
                      onClick={() => { setDetailOrder(null); setCancelTarget(detailOrder); }}
                      className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-destructive/10 text-destructive text-sm font-medium hover:bg-destructive/20 transition-colors"
                    >
                      <XCircle className="w-4 h-4" /> Cancel Order
                    </button>
                  )}
                </div>
              );
            })()}
          </div>
        </Modal>
      )}

      {/* ── Cancel Confirmation Modal ──────────────────────────────────── */}
      {cancelTarget && (
        <Modal title="Cancel Order" onClose={() => { setCancelTarget(null); setCancelRemarks(""); }}>
          <div className="space-y-4">
            <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-3 text-sm text-destructive">
              <p className="font-medium mb-1">⚠ This action will:</p>
              <ul className="list-disc ml-4 text-xs space-y-0.5">
                <li>Cancel order <strong>{(cancelTarget.orderNo ?? cancelTarget.id) as string}</strong></li>
                <li>Release all consumed raw materials back to inventory</li>
                <li>This cannot be undone</li>
              </ul>
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground mb-1.5">Reason for cancellation</label>
              <textarea
                value={cancelRemarks}
                onChange={(e) => setCancelRemarks(e.target.value)}
                className="w-full rounded-lg border border-input bg-background px-3.5 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring/30 focus:border-primary transition-colors"
                rows={2}
                placeholder="Why is this order being cancelled?"
              />
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => { setCancelTarget(null); setCancelRemarks(""); }}
                className="flex-1 py-2.5 rounded-lg border border-border text-sm font-medium text-foreground hover:bg-muted/30 transition-colors"
              >
                Keep Order
              </button>
              <button
                onClick={() => statusMutation.mutate({ id: cancelTarget.id as string, status: "CANCELLED", remarks: cancelRemarks || undefined })}
                disabled={statusMutation.isPending}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg bg-destructive text-destructive-foreground text-sm font-medium hover:bg-destructive/90 transition-colors disabled:opacity-50"
              >
                {statusMutation.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
                <XCircle className="w-4 h-4" /> Confirm Cancel
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* ── New Order Modal ────────────────────────────────────────────── */}
      {showModal && (
        <Modal title="Confirm New Order" onClose={() => { setShowModal(false); resetForm(); }}>
          <div className="space-y-4">
            <div className="bg-warning/10 border border-warning/20 rounded-lg p-3 text-xs text-warning">
              ⚠ Feasibility check is enforced — order will be blocked if materials are insufficient
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground mb-1.5">Customer Name</label>
              <input type="text" value={form.customerName} onChange={(e) => setForm({ ...form, customerName: e.target.value })}
                className="w-full rounded-lg border border-input bg-background px-3.5 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring/30 focus:border-primary transition-colors" placeholder="Customer name" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-foreground mb-1.5">Email</label>
                <input type="email" value={form.customerEmail} onChange={(e) => setForm({ ...form, customerEmail: e.target.value })}
                  className="w-full rounded-lg border border-input bg-background px-3.5 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring/30 focus:border-primary transition-colors" placeholder="Optional" />
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1.5">Phone</label>
                <input type="text" value={form.customerPhone} onChange={(e) => setForm({ ...form, customerPhone: e.target.value })}
                  className="w-full rounded-lg border border-input bg-background px-3.5 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring/30 focus:border-primary transition-colors" placeholder="Optional" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-foreground mb-1.5">Product Name</label>
                <input type="text" value={form.productName} onChange={(e) => setForm({ ...form, productName: e.target.value })}
                  className="w-full rounded-lg border border-input bg-background px-3.5 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring/30 focus:border-primary transition-colors" placeholder="Product" />
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1.5">Quantity</label>
                <input type="number" value={form.quantity} onChange={(e) => setForm({ ...form, quantity: e.target.value })}
                  className="w-full rounded-lg border border-input bg-background px-3.5 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring/30 focus:border-primary transition-colors" placeholder="Qty" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-foreground mb-1.5">Total Amount (₹)</label>
                <input type="number" value={form.totalAmount} onChange={(e) => setForm({ ...form, totalAmount: e.target.value })}
                  className="w-full rounded-lg border border-input bg-background px-3.5 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring/30 focus:border-primary transition-colors" placeholder="Amount" />
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1.5">Expected Delivery</label>
                <input type="date" value={form.expectedDelivery} onChange={(e) => setForm({ ...form, expectedDelivery: e.target.value })}
                  className="w-full rounded-lg border border-input bg-background px-3.5 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring/30 focus:border-primary transition-colors" />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground mb-1.5">Remarks</label>
              <textarea value={form.remarks} onChange={(e) => setForm({ ...form, remarks: e.target.value })}
                className="w-full rounded-lg border border-input bg-background px-3.5 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring/30 focus:border-primary transition-colors" rows={2} placeholder="Optional" />
            </div>
            <button onClick={() => confirmMutation.mutate()}
              disabled={confirmMutation.isPending || !form.customerName || !form.productName || !form.quantity || !form.totalAmount}
              className="w-full py-2.5 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-50 flex items-center justify-center gap-2">
              {confirmMutation.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
              Confirm Order
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
};

export default OrderConfirmation;
