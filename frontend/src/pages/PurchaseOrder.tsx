import React from "react";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { purchaseOrdersApi, suppliersApi, materialsApi } from "@/lib/api";
import { Plus, Loader2, X, ChevronDown, ChevronUp } from "lucide-react";
import { Modal, StatusBadge } from "./SupplierEnquiry";
import { toast } from "sonner";

const PO_ACTIONS: Record<string, { label: string; next: string; color: string }[]> = {
  DRAFT: [
    { label: "Submit for Approval", next: "PENDING_APPROVAL", color: "bg-blue-500/10 text-blue-500" },
    { label: "Cancel", next: "CANCELLED", color: "bg-destructive/10 text-destructive" },
  ],
  PENDING_APPROVAL: [
    { label: "Approve", next: "APPROVED", color: "bg-success/10 text-success" },
    { label: "Cancel", next: "CANCELLED", color: "bg-destructive/10 text-destructive" },
  ],
  APPROVED: [
    { label: "Send to Supplier", next: "SENT_TO_SUPPLIER", color: "bg-blue-500/10 text-blue-500" },
    { label: "Cancel", next: "CANCELLED", color: "bg-destructive/10 text-destructive" },
  ],
  SENT_TO_SUPPLIER: [
    { label: "Mark Delivered", next: "DELIVERED", color: "bg-success/10 text-success" },
  ],
  DELIVERED: [
    { label: "Close", next: "CLOSED", color: "bg-muted text-muted-foreground" },
  ],
};

const PurchaseOrder = () => {
  const queryClient = useQueryClient();
  const [showModal, setShowModal] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [form, setForm] = useState({
    supplierId: "",
    expectedDate: "",
    remarks: "",
    items: [{ materialId: "", quantity: "", unitPrice: "", unit: "pcs" }],
  });

  const { data: posRes, isLoading } = useQuery({
    queryKey: ["purchaseOrders"],
    queryFn: () => purchaseOrdersApi.list({ limit: 100 }),
  });

  const { data: suppliersRes } = useQuery({
    queryKey: ["suppliers"],
    queryFn: () => suppliersApi.list(),
  });

  const { data: materialsRes } = useQuery({
    queryKey: ["materials"],
    queryFn: () => materialsApi.list(),
  });

  const createMutation = useMutation({
    mutationFn: () =>
      purchaseOrdersApi.create({
        supplierId: form.supplierId,
        expectedDate: form.expectedDate ? new Date(form.expectedDate).toISOString() : undefined,
        remarks: form.remarks || undefined,
        items: form.items
          .filter((i) => i.materialId && i.quantity && i.unitPrice)
          .map((i) => ({ materialId: i.materialId, quantity: Number(i.quantity), unitPrice: Number(i.unitPrice), unit: i.unit })),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["purchaseOrders"] });
      setShowModal(false);
      setForm({ supplierId: "", expectedDate: "", remarks: "", items: [{ materialId: "", quantity: "", unitPrice: "", unit: "pcs" }] });
      toast.success("Purchase Order created");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const statusMutation = useMutation({
    mutationFn: (data: { id: string; status: string }) => purchaseOrdersApi.updateStatus(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["purchaseOrders"] });
      toast.success("PO status updated");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const pos = (posRes?.data ?? []) as Array<Record<string, unknown>>;
  const suppliers = (suppliersRes?.data ?? []) as Array<{ id: string; name: string }>;
  const materials = (materialsRes?.data ?? []) as Array<{ id: string; name: string }>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-foreground">Purchase Orders</h1>
        <button onClick={() => setShowModal(true)} className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors">
          <Plus className="w-4 h-4" /> New PO
        </button>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center p-12"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
      ) : (
        <div className="bg-card rounded-xl border border-border overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="border-b border-border bg-muted/50">
                <th className="w-8" />
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">PO #</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Supplier</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Total (₹)</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Expected</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Status</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Actions</th>
              </tr></thead>
              <tbody>
                {pos.length === 0 ? (
                  <tr><td colSpan={7} className="text-center py-8 text-muted-foreground">No purchase orders found</td></tr>
                ) : pos.map((po) => {
                  const supplier = po.supplier as Record<string, unknown> | undefined;
                  const items = (po.items ?? []) as Array<Record<string, unknown>>;
                  const receipts = (po.receipts ?? []) as Array<Record<string, unknown>>;
                  const isExpanded = expandedId === (po.id as string);
                  const status = po.status as string;
                  const actions = PO_ACTIONS[status] || [];

                  // Calculate received quantities per material
                  const receivedMap = new Map<string, number>();
                  receipts.forEach(r => {
                    const rItems = (r.items ?? []) as Array<Record<string, unknown>>;
                    rItems.forEach(ri => {
                      const batch = ri.batch as Record<string, unknown> | undefined;
                      const matId = (batch?.materialId ?? ri.materialId ?? "") as string;
                      if (matId) receivedMap.set(matId, (receivedMap.get(matId) || 0) + Number(ri.quantity ?? 0));
                    });
                  });

                  return (
                    <React.Fragment key={po.id as string}>
                      <tr className="border-b border-border/50 hover:bg-muted/30 transition-colors">
                        <td className="px-2 py-3">
                          <button onClick={() => setExpandedId(isExpanded ? null : po.id as string)} className="p-1 hover:bg-muted rounded">
                            {isExpanded ? <ChevronUp className="w-3.5 h-3.5 text-muted-foreground" /> : <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />}
                          </button>
                        </td>
                        <td className="px-4 py-3 font-mono text-foreground text-xs">{po.poNumber as string}</td>
                        <td className="px-4 py-3 text-foreground">{(supplier?.name ?? "—") as string}</td>
                        <td className="px-4 py-3 text-foreground font-medium">₹{po.totalAmount ? Number(po.totalAmount).toLocaleString() : "0"}</td>
                        <td className="px-4 py-3 text-foreground text-xs">{po.expectedDate ? new Date(po.expectedDate as string).toLocaleDateString() : "—"}</td>
                        <td className="px-4 py-3"><StatusBadge status={status} /></td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            {actions.map((action) => (
                              <button key={action.next} onClick={() => statusMutation.mutate({ id: po.id as string, status: action.next })}
                                className={`px-2.5 py-1.5 rounded-md text-xs font-medium hover:opacity-80 transition-colors ${action.color}`}>
                                {action.label}
                              </button>
                            ))}
                          </div>
                        </td>
                      </tr>
                      {isExpanded && (
                        <tr className="bg-muted/20">
                          <td colSpan={7} className="px-8 py-3">
                            <div className="flex items-center gap-2 mb-2">
                              <span className="text-xs font-medium text-muted-foreground">Receipts: {receipts.length}</span>
                              {po.remarks && <span className="text-xs text-muted-foreground">| {po.remarks as string}</span>}
                            </div>
                            <table className="w-full text-xs">
                              <thead><tr className="border-b border-border/50">
                                <th className="text-left py-1.5 font-medium text-muted-foreground">Material</th>
                                <th className="text-left py-1.5 font-medium text-muted-foreground">Ordered</th>
                                <th className="text-left py-1.5 font-medium text-muted-foreground">Received</th>
                                <th className="text-left py-1.5 font-medium text-muted-foreground">Unit Price</th>
                                <th className="text-left py-1.5 font-medium text-muted-foreground">Progress</th>
                              </tr></thead>
                              <tbody>
                                {items.map((item, idx) => {
                                  const mat = item.material as Record<string, unknown> | undefined;
                                  const ordered = Number(item.quantity ?? 0);
                                  const received = Number(item.receivedQty ?? 0) || receivedMap.get(item.materialId as string) || 0;
                                  const pct = ordered > 0 ? Math.round((received / ordered) * 100) : 0;
                                  return (
                                    <tr key={idx} className="border-b border-border/30">
                                      <td className="py-1.5 text-foreground">{(mat?.name ?? "—") as string}</td>
                                      <td className="py-1.5 text-foreground">{ordered}</td>
                                      <td className="py-1.5 text-foreground">{received}</td>
                                      <td className="py-1.5 text-foreground">₹{Number(item.unitPrice ?? 0).toLocaleString()}</td>
                                      <td className="py-1.5 w-32">
                                        <div className="flex items-center gap-2">
                                          <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
                                            <div className={`h-full rounded-full ${pct >= 100 ? "bg-success" : pct > 0 ? "bg-warning" : "bg-muted"}`}
                                              style={{ width: `${Math.min(pct, 100)}%` }} />
                                          </div>
                                          <span className="text-xs text-muted-foreground w-8">{pct}%</span>
                                        </div>
                                      </td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {showModal && (
        <Modal title="Create Purchase Order" onClose={() => setShowModal(false)}>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-foreground mb-1.5">Supplier</label>
              <select value={form.supplierId} onChange={(e) => setForm({ ...form, supplierId: e.target.value })}
                className="w-full rounded-lg border border-input bg-background px-3.5 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring/30 focus:border-primary transition-colors">
                <option value="">Select supplier</option>
                {suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground mb-1.5">Expected Delivery Date</label>
              <input type="date" value={form.expectedDate} onChange={(e) => setForm({ ...form, expectedDate: e.target.value })}
                className="w-full rounded-lg border border-input bg-background px-3.5 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring/30 focus:border-primary transition-colors" />
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground mb-1.5">Items</label>
              {form.items.map((item, idx) => (
                <div key={idx} className="flex gap-2 items-end mb-2">
                  <div className="flex-1">
                    <select value={item.materialId} onChange={(e) => {
                      const newItems = [...form.items];
                      newItems[idx] = { ...item, materialId: e.target.value };
                      setForm({ ...form, items: newItems });
                    }} className="w-full rounded-lg border border-input bg-background px-3.5 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring/30 focus:border-primary transition-colors">
                      <option value="">Material</option>
                      {materials.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
                    </select>
                  </div>
                  <div className="w-20">
                    <input type="number" value={item.quantity} onChange={(e) => {
                      const newItems = [...form.items];
                      newItems[idx] = { ...item, quantity: e.target.value };
                      setForm({ ...form, items: newItems });
                    }} className="w-full rounded-lg border border-input bg-background px-3.5 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring/30 focus:border-primary transition-colors" placeholder="Qty" />
                  </div>
                  <div className="w-24">
                    <input type="number" value={item.unitPrice} onChange={(e) => {
                      const newItems = [...form.items];
                      newItems[idx] = { ...item, unitPrice: e.target.value };
                      setForm({ ...form, items: newItems });
                    }} className="w-full rounded-lg border border-input bg-background px-3.5 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring/30 focus:border-primary transition-colors" placeholder="Price" />
                  </div>
                  {form.items.length > 1 && (
                    <button onClick={() => setForm({ ...form, items: form.items.filter((_, i) => i !== idx) })}
                      className="p-2 text-destructive hover:bg-destructive/10 rounded-lg transition-colors"><X className="w-4 h-4" /></button>
                  )}
                </div>
              ))}
              <button type="button" onClick={() => setForm({ ...form, items: [...form.items, { materialId: "", quantity: "", unitPrice: "", unit: "pcs" }] })}
                className="text-xs text-primary hover:underline">+ Add item</button>
            </div>
            <button onClick={() => createMutation.mutate()} disabled={createMutation.isPending || !form.supplierId || form.items.every(i => !i.materialId)}
              className="w-full py-2.5 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-50 flex items-center justify-center gap-2">
              {createMutation.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
              Create PO
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
};

export default PurchaseOrder;
