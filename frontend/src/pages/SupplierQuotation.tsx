import React from "react";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { suppliersApi, materialsApi, purchaseOrdersApi } from "@/lib/api";
import { Plus, Loader2, Check, X, ChevronDown, ChevronUp, ShoppingCart } from "lucide-react";
import { Modal, StatusBadge } from "./SupplierEnquiry";
import { toast } from "sonner";

const SupplierQuotation = () => {
  const queryClient = useQueryClient();
  const [showModal, setShowModal] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [form, setForm] = useState({
    supplierId: "",
    enquiryId: "",
    leadTimeDays: "",
    validUntil: "",
    remarks: "",
    items: [{ materialId: "", quantity: "", unitPrice: "", unit: "pcs" }],
  });

  const { data: quotationsRes, isLoading } = useQuery({
    queryKey: ["quotations"],
    queryFn: () => suppliersApi.listQuotations({ limit: 100 }),
  });

  const { data: enquiriesRes } = useQuery({
    queryKey: ["enquiries"],
    queryFn: () => suppliersApi.listEnquiries({ limit: 100, status: "SENT" }),
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
      suppliersApi.addQuotation({
        supplierId: form.supplierId,
        enquiryId: form.enquiryId || undefined,
        leadTimeDays: form.leadTimeDays ? Number(form.leadTimeDays) : undefined,
        validUntil: form.validUntil ? new Date(form.validUntil).toISOString() : undefined,
        remarks: form.remarks || undefined,
        items: form.items
          .filter((i) => i.materialId && i.quantity && i.unitPrice)
          .map((i) => ({ materialId: i.materialId, quantity: Number(i.quantity), unitPrice: Number(i.unitPrice), unit: i.unit })),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["quotations"] });
      queryClient.invalidateQueries({ queryKey: ["enquiries"] });
      setShowModal(false);
      setForm({ supplierId: "", enquiryId: "", leadTimeDays: "", validUntil: "", remarks: "", items: [{ materialId: "", quantity: "", unitPrice: "", unit: "pcs" }] });
      toast.success("Quotation added");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const statusMutation = useMutation({
    mutationFn: (data: { id: string; status: string }) => suppliersApi.updateQuotationStatus(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["quotations"] });
      toast.success("Quotation status updated");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const createPOMutation = useMutation({
    mutationFn: (quotationId: string) => purchaseOrdersApi.createFromQuotation({ quotationId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["purchaseOrders"] });
      toast.success("Purchase Order created from quotation!");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const quotations = (quotationsRes?.data ?? []) as Array<Record<string, unknown>>;
  const enquiries = (enquiriesRes?.data ?? []) as Array<Record<string, unknown>>;
  const suppliers = (suppliersRes?.data ?? []) as Array<{ id: string; name: string }>;
  const materials = (materialsRes?.data ?? []) as Array<{ id: string; name: string }>;

  // Auto-fill items from selected enquiry
  const handleEnquirySelect = (enquiryId: string) => {
    const enquiry = enquiries.find(e => e.id === enquiryId);
    if (enquiry) {
      const enquiryItems = (enquiry.items ?? []) as Array<Record<string, unknown>>;
      const supplier = enquiry.supplier as Record<string, unknown> | undefined;
      setForm({
        ...form,
        enquiryId,
        supplierId: (supplier?.id ?? form.supplierId) as string,
        items: enquiryItems.length > 0
          ? enquiryItems.map(item => ({
            materialId: item.materialId as string,
            quantity: String(item.quantity ?? ""),
            unitPrice: "",
            unit: (item.unit ?? "pcs") as string,
          }))
          : [{ materialId: "", quantity: "", unitPrice: "", unit: "pcs" }],
      });
    } else {
      setForm({ ...form, enquiryId });
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-foreground">Supplier Quotations</h1>
        <button onClick={() => setShowModal(true)} className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors">
          <Plus className="w-4 h-4" /> Add Quotation
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
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Quotation #</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Supplier</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Linked Enquiry</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Total (₹)</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Lead Time</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Status</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Actions</th>
              </tr></thead>
              <tbody>
                {quotations.length === 0 ? (
                  <tr><td colSpan={8} className="text-center py-8 text-muted-foreground">No quotations found</td></tr>
                ) : quotations.map((q) => {
                  const supplier = q.supplier as Record<string, unknown> | undefined;
                  const enquiry = q.enquiry as Record<string, unknown> | undefined;
                  const items = (q.items ?? []) as Array<Record<string, unknown>>;
                  const isExpanded = expandedId === (q.id as string);
                  const status = q.status as string;

                  return (
                    <React.Fragment key={q.id as string}>
                      <tr className="border-b border-border/50 hover:bg-muted/30 transition-colors">
                        <td className="px-2 py-3">
                          <button onClick={() => setExpandedId(isExpanded ? null : q.id as string)} className="p-1 hover:bg-muted rounded">
                            {isExpanded ? <ChevronUp className="w-3.5 h-3.5 text-muted-foreground" /> : <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />}
                          </button>
                        </td>
                        <td className="px-4 py-3 font-mono text-foreground text-xs">{q.quotationNo as string}</td>
                        <td className="px-4 py-3 text-foreground">{(supplier?.name ?? "—") as string}</td>
                        <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{(enquiry?.enquiryNo ?? "—") as string}</td>
                        <td className="px-4 py-3 text-foreground font-medium">₹{q.totalAmount ? Number(q.totalAmount).toLocaleString() : "0"}</td>
                        <td className="px-4 py-3 text-foreground">{q.leadTimeDays ? `${q.leadTimeDays} days` : "—"}</td>
                        <td className="px-4 py-3"><StatusBadge status={status} /></td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            {(status === "RECEIVED" || status === "UNDER_REVIEW") && (
                              <>
                                {status === "RECEIVED" && (
                                  <button onClick={() => statusMutation.mutate({ id: q.id as string, status: "UNDER_REVIEW" })}
                                    className="px-2.5 py-1.5 rounded-md bg-warning/10 text-warning text-xs font-medium hover:bg-warning/20 transition-colors">
                                    Review
                                  </button>
                                )}
                                <button onClick={() => statusMutation.mutate({ id: q.id as string, status: "APPROVED" })}
                                  className="flex items-center gap-1 px-2.5 py-1.5 rounded-md bg-success/10 text-success text-xs font-medium hover:bg-success/20 transition-colors">
                                  <Check className="w-3 h-3" /> Approve
                                </button>
                                <button onClick={() => statusMutation.mutate({ id: q.id as string, status: "REJECTED" })}
                                  className="flex items-center gap-1 px-2.5 py-1.5 rounded-md bg-destructive/10 text-destructive text-xs font-medium hover:bg-destructive/20 transition-colors">
                                  <X className="w-3 h-3" /> Reject
                                </button>
                              </>
                            )}
                            {status === "APPROVED" && (
                              <button onClick={() => createPOMutation.mutate(q.id as string)} disabled={createPOMutation.isPending}
                                className="flex items-center gap-1 px-2.5 py-1.5 rounded-md bg-primary/10 text-primary text-xs font-medium hover:bg-primary/20 transition-colors">
                                <ShoppingCart className="w-3 h-3" /> Create PO
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                      {isExpanded && (
                        <tr className="bg-muted/20">
                          <td colSpan={8} className="px-8 py-3">
                            <table className="w-full text-xs">
                              <thead><tr className="border-b border-border/50">
                                <th className="text-left py-1.5 font-medium text-muted-foreground">Material</th>
                                <th className="text-left py-1.5 font-medium text-muted-foreground">Qty</th>
                                <th className="text-left py-1.5 font-medium text-muted-foreground">Unit Price (₹)</th>
                                <th className="text-left py-1.5 font-medium text-muted-foreground">Total (₹)</th>
                              </tr></thead>
                              <tbody>
                                {items.map((item, idx) => {
                                  const mat = item.material as Record<string, unknown> | undefined;
                                  return (
                                    <tr key={idx} className="border-b border-border/30">
                                      <td className="py-1.5 text-foreground">{(mat?.name ?? "—") as string}</td>
                                      <td className="py-1.5 text-foreground">{String(item.quantity ?? 0)}</td>
                                      <td className="py-1.5 text-foreground">₹{Number(item.unitPrice ?? 0).toLocaleString()}</td>
                                      <td className="py-1.5 text-foreground font-medium">₹{Number(item.totalPrice ?? 0).toLocaleString()}</td>
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
        <Modal title="Add Supplier Quotation" onClose={() => setShowModal(false)}>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-foreground mb-1.5">Link to Enquiry (optional)</label>
              <select value={form.enquiryId} onChange={(e) => handleEnquirySelect(e.target.value)}
                className="w-full rounded-lg border border-input bg-background px-3.5 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring/30 focus:border-primary transition-colors">
                <option value="">No linked enquiry</option>
                {enquiries.map((e) => {
                  const s = e.supplier as Record<string, unknown> | undefined;
                  return <option key={e.id as string} value={e.id as string}>{e.enquiryNo as string} — {(s?.name ?? "") as string}</option>;
                })}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground mb-1.5">Supplier</label>
              <select value={form.supplierId} onChange={(e) => setForm({ ...form, supplierId: e.target.value })}
                className="w-full rounded-lg border border-input bg-background px-3.5 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring/30 focus:border-primary transition-colors">
                <option value="">Select supplier</option>
                {suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-foreground mb-1.5">Lead Time (days)</label>
                <input type="number" value={form.leadTimeDays} onChange={(e) => setForm({ ...form, leadTimeDays: e.target.value })}
                  className="w-full rounded-lg border border-input bg-background px-3.5 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring/30 focus:border-primary transition-colors" placeholder="e.g. 14" />
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1.5">Valid Until</label>
                <input type="date" value={form.validUntil} onChange={(e) => setForm({ ...form, validUntil: e.target.value })}
                  className="w-full rounded-lg border border-input bg-background px-3.5 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring/30 focus:border-primary transition-colors" />
              </div>
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
              Add Quotation
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
};

export default SupplierQuotation;
