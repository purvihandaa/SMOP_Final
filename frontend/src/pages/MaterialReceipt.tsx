import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { materialsApi, purchaseOrdersApi } from "@/lib/api";
import { Plus, Loader2, X, Package } from "lucide-react";
import { Modal, StatusBadge } from "./SupplierEnquiry";
import { toast } from "sonner";

const MaterialReceipt = () => {
  const queryClient = useQueryClient();
  const [showModal, setShowModal] = useState(false);
  const [selectedPOId, setSelectedPOId] = useState("");
  const [remarks, setRemarks] = useState("");
  const [receiptItems, setReceiptItems] = useState<Array<{ materialId: string; materialName: string; quantity: string; ordered: number; received: number }>>([]);

  const { data: receiptsRes, isLoading } = useQuery({
    queryKey: ["receipts"],
    queryFn: () => materialsApi.listReceipts({ limit: 100 }),
  });

  const { data: posRes } = useQuery({
    queryKey: ["purchaseOrders-receivable"],
    queryFn: () => purchaseOrdersApi.list({ limit: 100 }),
  });

  const createMutation = useMutation({
    mutationFn: () =>
      materialsApi.recordReceipt({
        purchaseOrderId: selectedPOId,
        items: receiptItems
          .filter((i) => i.materialId && Number(i.quantity) > 0)
          .map((i) => ({ materialId: i.materialId, quantity: Number(i.quantity) })),
        remarks: remarks || undefined,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["receipts"] });
      queryClient.invalidateQueries({ queryKey: ["purchaseOrders"] });
      queryClient.invalidateQueries({ queryKey: ["purchaseOrders-receivable"] });
      setShowModal(false);
      setSelectedPOId("");
      setReceiptItems([]);
      setRemarks("");
      toast.success("Material receipt recorded");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const receipts = (receiptsRes?.data ?? []) as Array<Record<string, unknown>>;
  const pos = (posRes?.data ?? []) as Array<Record<string, unknown>>;

  // Filter to POs that can receive materials
  const receivablePOs = pos.filter(po => {
    const status = po.status as string;
    return ["APPROVED", "SENT_TO_SUPPLIER", "PARTIALLY_DELIVERED"].includes(status);
  });

  const handlePOSelect = (poId: string) => {
    setSelectedPOId(poId);
    const po = pos.find(p => p.id === poId);
    if (po) {
      const poItems = (po.items ?? []) as Array<Record<string, unknown>>;
      setReceiptItems(poItems.map(item => {
        const mat = item.material as Record<string, unknown> | undefined;
        const ordered = Number(item.quantity ?? 0);
        const received = Number(item.receivedQty ?? 0);
        return {
          materialId: item.materialId as string,
          materialName: (mat?.name ?? "Unknown") as string,
          quantity: String(Math.max(ordered - received, 0)),
          ordered,
          received,
        };
      }));
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-foreground">Material Receipt</h1>
        <button onClick={() => setShowModal(true)} className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors">
          <Plus className="w-4 h-4" /> Record Receipt
        </button>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center p-12"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
      ) : (
        <div className="bg-card rounded-xl border border-border overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="border-b border-border bg-muted/50">
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Receipt #</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">PO #</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Supplier</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Items</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Received Date</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Received By</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Status</th>
              </tr></thead>
              <tbody>
                {receipts.length === 0 ? (
                  <tr><td colSpan={7} className="text-center py-8 text-muted-foreground">No receipts found</td></tr>
                ) : receipts.map((r) => {
                  const po = r.purchaseOrder as Record<string, unknown> | undefined;
                  const supplier = po?.supplier as Record<string, unknown> | undefined;
                  const items = (r.items ?? []) as Array<Record<string, unknown>>;
                  const receivedBy = r.receivedBy as Record<string, unknown> | undefined;

                  return (
                    <tr key={r.id as string} className="border-b border-border/50 hover:bg-muted/30 transition-colors">
                      <td className="px-4 py-3 font-mono text-foreground text-xs">{r.receiptNo as string}</td>
                      <td className="px-4 py-3 font-mono text-foreground text-xs">{(po?.poNumber ?? "—") as string}</td>
                      <td className="px-4 py-3 text-foreground">{(supplier?.name ?? "—") as string}</td>
                      <td className="px-4 py-3 text-foreground">
                        <div className="flex items-center gap-1">
                          <Package className="w-3.5 h-3.5 text-muted-foreground" />
                          {items.length} batches
                        </div>
                      </td>
                      <td className="px-4 py-3 text-foreground text-xs">{r.receivedDate ? new Date(r.receivedDate as string).toLocaleDateString() : r.createdAt ? new Date(r.createdAt as string).toLocaleDateString() : "—"}</td>
                      <td className="px-4 py-3 text-foreground text-xs">{(receivedBy?.fullName ?? "—") as string}</td>
                      <td className="px-4 py-3"><StatusBadge status={r.status as string} /></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {showModal && (
        <Modal title="Record Material Receipt" onClose={() => setShowModal(false)}>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-foreground mb-1.5">Purchase Order</label>
              <select value={selectedPOId} onChange={(e) => handlePOSelect(e.target.value)}
                className="w-full rounded-lg border border-input bg-background px-3.5 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring/30 focus:border-primary transition-colors">
                <option value="">Select PO</option>
                {receivablePOs.map((po) => {
                  const supplier = po.supplier as Record<string, unknown> | undefined;
                  return <option key={po.id as string} value={po.id as string}>{po.poNumber as string} — {(supplier?.name ?? "") as string}</option>;
                })}
              </select>
            </div>

            {receiptItems.length > 0 && (
              <div>
                <label className="block text-sm font-medium text-foreground mb-1.5">Items to Receive</label>
                <div className="space-y-3">
                  {receiptItems.map((item, idx) => (
                    <div key={idx} className="p-3 rounded-lg bg-muted/30 border border-border/50">
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-sm font-medium text-foreground">{item.materialName}</span>
                        <span className="text-xs text-muted-foreground">Ordered: {item.ordered} | Already received: {item.received}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <label className="text-xs text-muted-foreground">Receive:</label>
                        <input type="number" value={item.quantity} min={0} max={item.ordered - item.received}
                          onChange={(e) => {
                            const newItems = [...receiptItems];
                            newItems[idx] = { ...item, quantity: e.target.value };
                            setReceiptItems(newItems);
                          }}
                          className="w-24 rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring/30 focus:border-primary transition-colors" />
                        <span className="text-xs text-muted-foreground">/ {item.ordered - item.received} remaining</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-foreground mb-1.5">Remarks</label>
              <textarea value={remarks} onChange={(e) => setRemarks(e.target.value)}
                className="w-full rounded-lg border border-input bg-background px-3.5 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring/30 focus:border-primary transition-colors"
                rows={2} placeholder="Optional remarks" />
            </div>

            <button onClick={() => createMutation.mutate()}
              disabled={createMutation.isPending || !selectedPOId || receiptItems.every(i => Number(i.quantity) <= 0)}
              className="w-full py-2.5 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-50 flex items-center justify-center gap-2">
              {createMutation.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
              Record Receipt
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
};

export default MaterialReceipt;
