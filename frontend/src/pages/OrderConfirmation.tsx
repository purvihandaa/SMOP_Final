import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { salesApi } from "@/lib/api";
import { Plus, Loader2 } from "lucide-react";
import { StatusBadge, Modal } from "./SupplierEnquiry";
import { toast } from "sonner";
import { useLocation } from "react-router-dom";

const OrderConfirmation = () => {
  const queryClient = useQueryClient();
  const location = useLocation();
  const prefill = location.state as { productName?: string; quantity?: number } | null;

  const [showModal, setShowModal] = useState(!!prefill);
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
    queryKey: ["orders"],
    queryFn: () => salesApi.listOrders({ limit: 100 }),
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
      setForm({ customerName: "", customerEmail: "", customerPhone: "", productName: "", quantity: "", totalAmount: "", expectedDelivery: "", remarks: "" });
      toast.success("Order confirmed — inventory updated!");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const orders = (ordersRes?.data ?? []) as Array<Record<string, unknown>>;

  // Summary stats
  const confirmed = orders.filter(o => o.status === "CONFIRMED").length;
  const inProduction = orders.filter(o => o.status === "IN_PRODUCTION").length;
  const totalRevenue = orders.reduce((sum, o) => sum + Number(o.totalAmount ?? 0), 0);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-foreground">Orders</h1>
        <button onClick={() => setShowModal(true)} className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors">
          <Plus className="w-4 h-4" /> New Order
        </button>
      </div>

      {/* Summary KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="kpi-card">
          <p className="text-xs font-medium text-muted-foreground mb-1">Total Orders</p>
          <p className="text-2xl font-bold text-foreground">{orders.length}</p>
        </div>
        <div className="kpi-card">
          <p className="text-xs font-medium text-muted-foreground mb-1">Confirmed / In Production</p>
          <p className="text-2xl font-bold text-foreground">{confirmed} <span className="text-sm font-normal text-muted-foreground">/ {inProduction}</span></p>
        </div>
        <div className="kpi-card">
          <p className="text-xs font-medium text-muted-foreground mb-1">Total Revenue</p>
          <p className="text-2xl font-bold text-foreground">₹{totalRevenue.toLocaleString()}</p>
        </div>
      </div>

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
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Date</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Expected</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Status</th>
              </tr></thead>
              <tbody>
                {orders.length === 0 ? (
                  <tr><td colSpan={8} className="text-center py-8 text-muted-foreground">No orders found</td></tr>
                ) : orders.map((o) => (
                  <tr key={o.id as string} className="border-b border-border/50 hover:bg-muted/30 transition-colors">
                    <td className="px-4 py-3 font-mono text-foreground text-xs">{(o.orderNo ?? o.id) as string}</td>
                    <td className="px-4 py-3 text-foreground">{(o.customerName ?? "") as string}</td>
                    <td className="px-4 py-3 text-foreground">{(o.productName ?? "") as string}</td>
                    <td className="px-4 py-3 text-foreground">{String(o.quantity ?? "")}</td>
                    <td className="px-4 py-3 text-foreground font-medium">₹{o.totalAmount ? Number(o.totalAmount).toLocaleString() : "—"}</td>
                    <td className="px-4 py-3 text-foreground text-xs">{o.createdAt ? new Date(o.createdAt as string).toLocaleDateString() : "—"}</td>
                    <td className="px-4 py-3 text-foreground text-xs">{o.expectedDelivery ? new Date(o.expectedDelivery as string).toLocaleDateString() : "—"}</td>
                    <td className="px-4 py-3"><StatusBadge status={o.status as string} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* New Order Modal */}
      {showModal && (
        <Modal title="Confirm New Order" onClose={() => { setShowModal(false); setForm({ customerName: "", customerEmail: "", customerPhone: "", productName: prefill?.productName || "", quantity: prefill?.quantity ? String(prefill.quantity) : "", totalAmount: "", expectedDelivery: "", remarks: "" }); }}>
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
