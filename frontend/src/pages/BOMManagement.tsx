import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { manufacturingApi, materialsApi, inventoryApi } from "@/lib/api";
import { Plus, Loader2, X, ChevronDown, ChevronUp } from "lucide-react";
import { Modal, StatusBadge } from "./SupplierEnquiry";
import { toast } from "sonner";

const BOMManagement = () => {
  const queryClient = useQueryClient();
  const [showModal, setShowModal] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [form, setForm] = useState({
    name: "",
    productName: "",
    description: "",
    items: [{ materialId: "", quantity: "", unit: "pcs" }],
  });

  const { data: bomsRes, isLoading } = useQuery({
    queryKey: ["boms"],
    queryFn: () => manufacturingApi.viewBOMs(),
  });

  const { data: materialsRes } = useQuery({
    queryKey: ["materials"],
    queryFn: () => materialsApi.list(),
  });

  const { data: inventoryRes } = useQuery({
    queryKey: ["inventory-for-bom"],
    queryFn: () => inventoryApi.view({ limit: 500 }),
  });

  const createMutation = useMutation({
    mutationFn: () =>
      manufacturingApi.createBOM({
        name: form.name,
        productName: form.productName,
        description: form.description || undefined,
        items: form.items
          .filter((i) => i.materialId && i.quantity)
          .map((i) => ({ materialId: i.materialId, quantity: Number(i.quantity), unit: i.unit })),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["boms"] });
      setShowModal(false);
      setForm({ name: "", productName: "", description: "", items: [{ materialId: "", quantity: "", unit: "pcs" }] });
      toast.success("BOM created");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const boms = (bomsRes?.data ?? []) as Array<Record<string, unknown>>;
  const materials = (materialsRes?.data ?? []) as Array<{ id: string; name: string; code: string }>;

  // Build inventory lookup for warnings
  const inventoryItems = (inventoryRes?.data ?? []) as Array<Record<string, unknown>>;
  const inventoryMap = new Map<string, number>();
  inventoryItems.forEach(inv => {
    const matId = (inv.material as Record<string, unknown> | undefined)?.id as string;
    if (matId) {
      inventoryMap.set(matId, (inventoryMap.get(matId) || 0) + Number(inv.availableQty ?? inv.quantity ?? 0));
    }
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-foreground">BOM Management</h1>
        <button onClick={() => setShowModal(true)} className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors">
          <Plus className="w-4 h-4" /> Create BOM
        </button>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center p-12"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
      ) : (
        <div className="grid gap-4">
          {boms.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground bg-card rounded-xl border border-border">No BOMs found</div>
          ) : boms.map((bom) => {
            const bomItems = (bom.items ?? []) as Array<Record<string, unknown>>;
            const isExpanded = expandedId === (bom.id as string);
            const status = (bom.status ?? "DRAFT") as string;
            const version = Number(bom.version ?? 1);

            return (
              <div key={bom.id as string} className="bg-card rounded-xl border border-border overflow-hidden">
                <div
                  className="flex items-center justify-between p-5 cursor-pointer hover:bg-muted/20 transition-colors"
                  onClick={() => setExpandedId(isExpanded ? null : bom.id as string)}
                >
                  <div className="flex items-center gap-3">
                    <div>
                      <h3 className="text-base font-semibold text-foreground">{(bom.productName ?? bom.name) as string}</h3>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-xs font-mono text-muted-foreground">{(bom.bomNumber ?? "") as string}</span>
                        <span className="text-xs text-muted-foreground">v{version}</span>
                        <span className="text-xs text-muted-foreground">·</span>
                        <span className="text-xs text-muted-foreground">{bomItems.length} materials</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <StatusBadge status={status} />
                    {isExpanded ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
                  </div>
                </div>

                {isExpanded && (
                  <div className="border-t border-border">
                    {bom.description && <p className="px-5 py-2 text-xs text-muted-foreground bg-muted/20">{bom.description as string}</p>}
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead><tr className="border-b border-border bg-muted/30">
                          <th className="text-left px-5 py-2.5 font-medium text-muted-foreground">Material</th>
                          <th className="text-left px-5 py-2.5 font-medium text-muted-foreground">Code</th>
                          <th className="text-left px-5 py-2.5 font-medium text-muted-foreground">Required Qty</th>
                          <th className="text-left px-5 py-2.5 font-medium text-muted-foreground">Unit</th>
                          <th className="text-left px-5 py-2.5 font-medium text-muted-foreground">In Stock</th>
                        </tr></thead>
                        <tbody>
                          {bomItems.map((item, i) => {
                            const mat = item.material as Record<string, unknown> | undefined;
                            const matId = (item.materialId ?? mat?.id ?? "") as string;
                            const inStock = inventoryMap.get(matId) ?? 0;
                            const required = Number(item.quantity ?? 0);
                            const isShort = inStock < required;

                            return (
                              <tr key={i} className="border-b border-border/50">
                                <td className="px-5 py-2.5 text-foreground">{(mat?.name ?? item.materialName ?? "—") as string}</td>
                                <td className="px-5 py-2.5 font-mono text-xs text-muted-foreground">{(mat?.code ?? "—") as string}</td>
                                <td className="px-5 py-2.5 text-foreground">{required}</td>
                                <td className="px-5 py-2.5 text-foreground text-xs">{(item.unit ?? mat?.unit ?? "pcs") as string}</td>
                                <td className={`px-5 py-2.5 font-medium text-sm ${isShort ? "text-destructive" : "text-success"}`}>
                                  {inStock} {isShort && <span className="text-xs">⚠ short</span>}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {showModal && (
        <Modal title="Create BOM" onClose={() => setShowModal(false)}>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-foreground mb-1.5">BOM Name</label>
              <input type="text" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="w-full rounded-lg border border-input bg-background px-3.5 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring/30 focus:border-primary transition-colors" placeholder="e.g. Speed Motor 500W BOM" />
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground mb-1.5">Product Name</label>
              <input type="text" value={form.productName} onChange={(e) => setForm({ ...form, productName: e.target.value })}
                className="w-full rounded-lg border border-input bg-background px-3.5 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring/30 focus:border-primary transition-colors" placeholder="e.g. Speed Motor 500W" />
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground mb-1.5">Description</label>
              <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })}
                className="w-full rounded-lg border border-input bg-background px-3.5 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring/30 focus:border-primary transition-colors" rows={2} placeholder="Optional" />
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground mb-1.5">Materials</label>
              {form.items.map((item, idx) => (
                <div key={idx} className="flex gap-2 items-end mb-2">
                  <div className="flex-1">
                    <select value={item.materialId} onChange={(e) => {
                      const newItems = [...form.items];
                      newItems[idx] = { ...item, materialId: e.target.value };
                      setForm({ ...form, items: newItems });
                    }} className="w-full rounded-lg border border-input bg-background px-3.5 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring/30 focus:border-primary transition-colors">
                      <option value="">Select material</option>
                      {materials.map((m) => <option key={m.id} value={m.id}>{m.name} ({m.code})</option>)}
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
                className="text-xs text-primary hover:underline">+ Add material</button>
            </div>
            <button onClick={() => createMutation.mutate()} disabled={createMutation.isPending || !form.name || !form.productName}
              className="w-full py-2.5 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-50 flex items-center justify-center gap-2">
              {createMutation.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
              Create BOM
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
};

export default BOMManagement;
