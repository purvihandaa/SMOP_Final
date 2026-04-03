import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { inventoryApi, materialsApi } from "@/lib/api";
import { Loader2, AlertTriangle, ArrowRightLeft } from "lucide-react";
import { Modal } from "./SupplierEnquiry";
import { toast } from "sonner";

const Inventory = () => {
  const queryClient = useQueryClient();
  const [transferModal, setTransferModal] = useState<{ id: string; materialName: string; available: number } | null>(null);
  const [transferForm, setTransferForm] = useState({ newLocationId: "", quantity: "" });

  const { data: inventoryRes, isLoading } = useQuery({
    queryKey: ["inventory"],
    queryFn: () => inventoryApi.view({ limit: 200 }),
  });

  const { data: locationsRes } = useQuery({
    queryKey: ["locations"],
    queryFn: () => materialsApi.locations(),
  });

  const transferMutation = useMutation({
    mutationFn: () =>
      inventoryApi.updateLocation({
        inventoryId: transferModal!.id,
        newLocationId: transferForm.newLocationId,
        quantity: Number(transferForm.quantity),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["inventory"] });
      setTransferModal(null);
      setTransferForm({ newLocationId: "", quantity: "" });
      toast.success("Location transfer completed");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const items = (inventoryRes?.data ?? []) as Array<Record<string, unknown>>;
  const locations = (locationsRes?.data ?? []) as Array<{ id: string; name: string }>;

  // Separate low-stock items
  const lowStockItems = items.filter(item => {
    const qty = Number(item.quantity ?? 0);
    const minStock = Number(item.minStockLevel ?? 0);
    return minStock > 0 && qty <= minStock;
  });

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-bold text-foreground">Inventory Dashboard</h1>

      {isLoading ? (
        <div className="flex items-center justify-center p-16"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
      ) : (
        <>
          {/* Low Stock Alerts */}
          {lowStockItems.length > 0 && (
            <div className="bg-destructive/5 border border-destructive/20 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-3">
                <AlertTriangle className="w-4 h-4 text-destructive" />
                <h2 className="text-sm font-semibold text-destructive">Low Stock Alerts ({lowStockItems.length})</h2>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                {lowStockItems.map(item => {
                  const material = item.material as Record<string, unknown> | undefined;
                  const qty = Number(item.quantity ?? 0);
                  const minStock = Number(item.minStockLevel ?? 0);
                  return (
                    <div key={item.id as string} className="flex items-center justify-between px-3 py-2 rounded-lg bg-card border border-border">
                      <span className="text-sm text-foreground font-medium">{(material?.name ?? "Unknown") as string}</span>
                      <span className="text-xs text-destructive font-medium">{qty} / {minStock} min</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Stock Level Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {items.map((item) => {
              const material = item.material as Record<string, unknown> | undefined;
              const location = item.location as Record<string, unknown> | undefined;
              const qty = Number(item.quantity ?? 0);
              const available = Number(item.availableQty ?? qty);
              const reserved = Number(item.reservedQty ?? 0);
              const maxQty = Number(item.maxStockLevel ?? 0) || (qty * 2) || 1;
              const minQty = Number(item.minStockLevel ?? 0);
              const pct = Math.round((qty / maxQty) * 100);
              const barColor = (minQty > 0 && qty <= minQty) ? "bg-destructive" : pct < 40 ? "bg-warning" : "bg-success";
              const unit = (material?.unit ?? "") as string;
              const name = (material?.name ?? "Unknown") as string;
              const loc = (location?.name ?? "—") as string;

              return (
                <div key={item.id as string} className="kpi-card">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-sm font-semibold text-foreground">{name}</h3>
                    <span className="text-xs text-muted-foreground">{loc}</span>
                  </div>
                  <p className="text-2xl font-bold text-foreground mb-1">
                    {qty} <span className="text-sm font-normal text-muted-foreground">{unit}</span>
                  </p>
                  <div className="flex items-center gap-3 text-xs text-muted-foreground mb-2">
                    <span>Available: <strong className="text-foreground">{available}</strong></span>
                    {reserved > 0 && <span>Reserved: <strong className="text-warning">{reserved}</strong></span>}
                  </div>
                  <div className="w-full h-2 rounded-full bg-muted overflow-hidden">
                    <div className={`h-full rounded-full ${barColor} transition-all`} style={{ width: `${Math.min(pct, 100)}%` }} />
                  </div>
                  <div className="flex items-center justify-between mt-1.5">
                    <p className="text-xs text-muted-foreground">{pct}% of max ({maxQty})</p>
                    <button
                      onClick={() => setTransferModal({ id: item.id as string, materialName: name, available })}
                      className="flex items-center gap-1 text-xs text-primary hover:text-primary/80 transition-colors">
                      <ArrowRightLeft className="w-3 h-3" /> Transfer
                    </button>
                  </div>
                </div>
              );
            })}
            {items.length === 0 && (
              <div className="col-span-3 text-center py-12 text-muted-foreground">No inventory items found</div>
            )}
          </div>

          {/* Full Table */}
          <div className="bg-card rounded-xl border border-border overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr className="border-b border-border bg-muted/50">
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Material</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Code</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Total</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Available</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Reserved</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Location</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Stock Level</th>
                </tr></thead>
                <tbody>
                  {items.map((item) => {
                    const material = item.material as Record<string, unknown> | undefined;
                    const location = item.location as Record<string, unknown> | undefined;
                    const qty = Number(item.quantity ?? 0);
                    const available = Number(item.availableQty ?? qty);
                    const reserved = Number(item.reservedQty ?? 0);
                    const maxQty = Number(item.maxStockLevel ?? 0) || (qty * 2) || 1;
                    const minQty = Number(item.minStockLevel ?? 0);
                    const pct = Math.round((qty / maxQty) * 100);
                    const barColor = (minQty > 0 && qty <= minQty) ? "bg-destructive" : pct < 40 ? "bg-warning" : "bg-success";

                    return (
                      <tr key={item.id as string} className="border-b border-border/50 hover:bg-muted/30 transition-colors">
                        <td className="px-4 py-3 text-foreground font-medium">{(material?.name ?? "—") as string}</td>
                        <td className="px-4 py-3 font-mono text-foreground text-xs">{(material?.code ?? "—") as string}</td>
                        <td className="px-4 py-3 text-foreground">{qty} {(material?.unit ?? "") as string}</td>
                        <td className="px-4 py-3 text-foreground">{available}</td>
                        <td className="px-4 py-3 text-foreground">{reserved > 0 ? <span className="text-warning">{reserved}</span> : "—"}</td>
                        <td className="px-4 py-3 text-foreground">{(location?.name ?? "—") as string}</td>
                        <td className="px-4 py-3 w-40">
                          <div className="flex items-center gap-2">
                            <div className="flex-1 h-2 rounded-full bg-muted overflow-hidden">
                              <div className={`h-full rounded-full ${barColor}`} style={{ width: `${Math.min(pct, 100)}%` }} />
                            </div>
                            <span className="text-xs text-muted-foreground w-8">{pct}%</span>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* Transfer Modal */}
      {transferModal && (
        <Modal title={`Transfer: ${transferModal.materialName}`} onClose={() => { setTransferModal(null); setTransferForm({ newLocationId: "", quantity: "" }); }}>
          <div className="space-y-4">
            <p className="text-xs text-muted-foreground">Available: {transferModal.available} units</p>
            <div>
              <label className="block text-sm font-medium text-foreground mb-1.5">Destination Location</label>
              <select value={transferForm.newLocationId} onChange={(e) => setTransferForm({ ...transferForm, newLocationId: e.target.value })}
                className="w-full rounded-lg border border-input bg-background px-3.5 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring/30 focus:border-primary transition-colors">
                <option value="">Select location</option>
                {locations.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground mb-1.5">Quantity</label>
              <input type="number" value={transferForm.quantity} max={transferModal.available}
                onChange={(e) => setTransferForm({ ...transferForm, quantity: e.target.value })}
                className="w-full rounded-lg border border-input bg-background px-3.5 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring/30 focus:border-primary transition-colors"
                placeholder="Quantity to transfer" />
            </div>
            <button onClick={() => transferMutation.mutate()}
              disabled={transferMutation.isPending || !transferForm.newLocationId || !transferForm.quantity}
              className="w-full py-2.5 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-50 flex items-center justify-center gap-2">
              {transferMutation.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
              Transfer
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
};

export default Inventory;
