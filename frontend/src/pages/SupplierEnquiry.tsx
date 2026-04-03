import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { suppliersApi, materialsApi } from "@/lib/api";
import { Plus, Loader2, Send, X, ChevronDown, ChevronUp } from "lucide-react";
import { toast } from "sonner";

// Shared Modal component
export const Modal = ({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) => (
  <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 animate-fade-in">
    <div className="bg-card rounded-xl border border-border shadow-xl w-full max-w-lg mx-4 max-h-[85vh] overflow-y-auto">
      <div className="flex items-center justify-between px-6 py-4 border-b border-border">
        <h2 className="text-base font-semibold text-foreground">{title}</h2>
        <button onClick={onClose} className="p-1 rounded-lg hover:bg-muted transition-colors"><X className="w-4 h-4 text-muted-foreground" /></button>
      </div>
      <div className="p-6">{children}</div>
    </div>
  </div>
);

// Shared StatusBadge component
const STATUS_COLORS: Record<string, string> = {
  DRAFT: "bg-muted text-muted-foreground",
  SENT: "bg-blue-500/10 text-blue-500",
  RESPONDED: "bg-success/10 text-success",
  CLOSED: "bg-muted text-muted-foreground",
  RECEIVED: "bg-blue-500/10 text-blue-500",
  UNDER_REVIEW: "bg-warning/10 text-warning",
  APPROVED: "bg-success/10 text-success",
  REJECTED: "bg-destructive/10 text-destructive",
  PENDING_APPROVAL: "bg-warning/10 text-warning",
  SENT_TO_SUPPLIER: "bg-blue-500/10 text-blue-500",
  PARTIALLY_DELIVERED: "bg-warning/10 text-warning",
  DELIVERED: "bg-success/10 text-success",
  CANCELLED: "bg-destructive/10 text-destructive",
  PENDING_INSPECTION: "bg-warning/10 text-warning",
  INSPECTED: "bg-success/10 text-success",
  NEW: "bg-blue-500/10 text-blue-500",
  IN_PROGRESS: "bg-warning/10 text-warning",
  QUOTED: "bg-success/10 text-success",
  CONFIRMED: "bg-success/10 text-success",
  IN_PRODUCTION: "bg-blue-500/10 text-blue-500",
  READY_TO_DISPATCH: "bg-warning/10 text-warning",
  DISPATCHED: "bg-blue-500/10 text-blue-500",
  ACTIVE: "bg-success/10 text-success",
  DEPRECATED: "bg-muted text-muted-foreground",
  ACCEPTED: "bg-success/10 text-success",
  EXPIRED: "bg-muted text-muted-foreground",
};

export const StatusBadge = ({ status }: { status: string }) => (
  <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${STATUS_COLORS[status] || "bg-muted text-muted-foreground"}`}>
    {status?.replace(/_/g, " ")}
  </span>
);

// ─── Main Page ────────────────────────────────────────────────────────────
const SupplierEnquiry = () => {
  const queryClient = useQueryClient();
  const [showModal, setShowModal] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [form, setForm] = useState({
    supplierId: "",
    remarks: "",
    items: [{ materialId: "", quantity: "", unit: "pcs" }],
  });

  const { data: enquiriesRes, isLoading } = useQuery({
    queryKey: ["enquiries"],
    queryFn: () => suppliersApi.listEnquiries({ limit: 100 }),
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
      suppliersApi.createEnquiry({
        supplierId: form.supplierId,
        remarks: form.remarks || undefined,
        items: form.items
          .filter((i) => i.materialId && i.quantity)
          .map((i) => ({ materialId: i.materialId, quantity: Number(i.quantity), unit: i.unit })),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["enquiries"] });
      setShowModal(false);
      setForm({ supplierId: "", remarks: "", items: [{ materialId: "", quantity: "", unit: "pcs" }] });
      toast.success("Enquiry created");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const statusMutation = useMutation({
    mutationFn: (data: { id: string; status: string }) =>
      suppliersApi.updateEnquiryStatus(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["enquiries"] });
      toast.success("Status updated");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const enquiries = (enquiriesRes?.data ?? []) as Array<Record<string, unknown>>;
  const suppliers = (suppliersRes?.data ?? []) as Array<{ id: string; name: string }>;
  const materials = (materialsRes?.data ?? []) as Array<{ id: string; name: string }>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-foreground">Supplier Enquiries</h1>
        <button onClick={() => setShowModal(true)} className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors">
          <Plus className="w-4 h-4" /> New Enquiry
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
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Enquiry #</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Supplier</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Items</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Date</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Status</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Actions</th>
              </tr></thead>
              <tbody>
                {enquiries.length === 0 ? (
                  <tr><td colSpan={7} className="text-center py-8 text-muted-foreground">No enquiries found</td></tr>
                ) : enquiries.map((e) => {
                  const supplier = e.supplier as Record<string, unknown> | undefined;
                  const items = (e.items ?? []) as Array<Record<string, unknown>>;
                  const quotations = (e.quotations ?? []) as Array<Record<string, unknown>>;
                  const isExpanded = expandedId === (e.id as string);
                  const status = e.status as string;

                  return (
                    <>
                      <tr key={e.id as string} className="border-b border-border/50 hover:bg-muted/30 transition-colors">
                        <td className="px-2 py-3">
                          <button onClick={() => setExpandedId(isExpanded ? null : e.id as string)} className="p-1 hover:bg-muted rounded">
                            {isExpanded ? <ChevronUp className="w-3.5 h-3.5 text-muted-foreground" /> : <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />}
                          </button>
                        </td>
                        <td className="px-4 py-3 font-mono text-foreground text-xs">{e.enquiryNo as string}</td>
                        <td className="px-4 py-3 text-foreground">{(supplier?.name ?? "—") as string}</td>
                        <td className="px-4 py-3 text-foreground">{items.length} items</td>
                        <td className="px-4 py-3 text-foreground text-xs">{e.createdAt ? new Date(e.createdAt as string).toLocaleDateString() : "—"}</td>
                        <td className="px-4 py-3"><StatusBadge status={status} /></td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1.5">
                            {status === "DRAFT" && (
                              <button onClick={() => statusMutation.mutate({ id: e.id as string, status: "SENT" })}
                                className="flex items-center gap-1 px-2.5 py-1.5 rounded-md bg-blue-500/10 text-blue-500 text-xs font-medium hover:bg-blue-500/20 transition-colors">
                                <Send className="w-3 h-3" /> Send
                              </button>
                            )}
                            {(status === "DRAFT" || status === "SENT" || status === "RESPONDED") && (
                              <button onClick={() => statusMutation.mutate({ id: e.id as string, status: "CLOSED" })}
                                className="px-2.5 py-1.5 rounded-md bg-muted text-muted-foreground text-xs font-medium hover:bg-muted/80 transition-colors">
                                Close
                              </button>
                            )}
                            {quotations.length > 0 && (
                              <span className="text-xs text-success font-medium">{quotations.length} quot.</span>
                            )}
                          </div>
                        </td>
                      </tr>
                      {isExpanded && (
                        <tr key={`${e.id}-detail`} className="bg-muted/20">
                          <td colSpan={7} className="px-8 py-3">
                            <table className="w-full text-xs">
                              <thead><tr className="border-b border-border/50">
                                <th className="text-left py-1.5 font-medium text-muted-foreground">Material</th>
                                <th className="text-left py-1.5 font-medium text-muted-foreground">Code</th>
                                <th className="text-left py-1.5 font-medium text-muted-foreground">Qty</th>
                                <th className="text-left py-1.5 font-medium text-muted-foreground">Unit</th>
                              </tr></thead>
                              <tbody>
                                {items.map((item, idx) => {
                                  const mat = item.material as Record<string, unknown> | undefined;
                                  return (
                                    <tr key={idx} className="border-b border-border/30">
                                      <td className="py-1.5 text-foreground">{(mat?.name ?? "—") as string}</td>
                                      <td className="py-1.5 font-mono text-foreground">{(mat?.code ?? "—") as string}</td>
                                      <td className="py-1.5 text-foreground">{String(item.quantity ?? 0)}</td>
                                      <td className="py-1.5 text-foreground">{(item.unit ?? mat?.unit ?? "pcs") as string}</td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                          </td>
                        </tr>
                      )}
                    </>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {showModal && (
        <Modal title="Create Supplier Enquiry" onClose={() => setShowModal(false)}>
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
              <label className="block text-sm font-medium text-foreground mb-1.5">Remarks</label>
              <textarea value={form.remarks} onChange={(e) => setForm({ ...form, remarks: e.target.value })}
                className="w-full rounded-lg border border-input bg-background px-3.5 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring/30 focus:border-primary transition-colors"
                rows={2} placeholder="Optional remarks" />
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
                      <option value="">Select material</option>
                      {materials.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
                    </select>
                  </div>
                  <div className="w-24">
                    <input type="number" value={item.quantity} onChange={(e) => {
                      const newItems = [...form.items];
                      newItems[idx] = { ...item, quantity: e.target.value };
                      setForm({ ...form, items: newItems });
                    }} className="w-full rounded-lg border border-input bg-background px-3.5 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring/30 focus:border-primary transition-colors" placeholder="Qty" />
                  </div>
                  {form.items.length > 1 && (
                    <button onClick={() => setForm({ ...form, items: form.items.filter((_, i) => i !== idx) })}
                      className="p-2 text-destructive hover:bg-destructive/10 rounded-lg transition-colors"><X className="w-4 h-4" /></button>
                  )}
                </div>
              ))}
              <button type="button" onClick={() => setForm({ ...form, items: [...form.items, { materialId: "", quantity: "", unit: "pcs" }] })}
                className="text-xs text-primary hover:underline">+ Add item</button>
            </div>
            <button onClick={() => createMutation.mutate()} disabled={createMutation.isPending || !form.supplierId || form.items.every(i => !i.materialId)}
              className="w-full py-2.5 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-50 flex items-center justify-center gap-2">
              {createMutation.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
              Create Enquiry
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
};

export default SupplierEnquiry;
