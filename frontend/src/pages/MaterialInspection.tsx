import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { materialsApi } from "@/lib/api";
import { Loader2, CheckCircle2, XCircle, AlertTriangle } from "lucide-react";
import { StatusBadge } from "./SupplierEnquiry";
import { toast } from "sonner";

interface InspectionForm {
  batchId: string;
  batchNumber: string;
  materialName: string;
  quantity: number;
  result: "ACCEPTED" | "REJECTED" | "PARTIALLY_ACCEPTED";
  inspectedQty: string;
  acceptedQty: string;
  rejectedQty: string;
  remarks: string;
}

const MaterialInspection = () => {
  const queryClient = useQueryClient();
  const [inspecting, setInspecting] = useState<InspectionForm | null>(null);

  const { data: receiptsRes, isLoading } = useQuery({
    queryKey: ["receipts-for-inspection"],
    queryFn: () => materialsApi.listReceipts({ limit: 100 }),
  });

  const inspectMutation = useMutation({
    mutationFn: (form: InspectionForm) =>
      materialsApi.recordInspection({
        batchId: form.batchId,
        result: form.result,
        inspectedQty: Number(form.inspectedQty),
        acceptedQty: Number(form.acceptedQty),
        rejectedQty: Number(form.rejectedQty) || 0,
        remarks: form.remarks || undefined,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["receipts-for-inspection"] });
      queryClient.invalidateQueries({ queryKey: ["inventory"] });
      setInspecting(null);
      toast.success("Inspection recorded — inventory updated!");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const receipts = (receiptsRes?.data ?? []) as Array<Record<string, unknown>>;

  // Separate pending vs inspected
  const pendingReceipts = receipts.filter(r => r.status === "PENDING_INSPECTION");
  const inspectedReceipts = receipts.filter(r => r.status === "INSPECTED");

  const renderBatchRow = (item: Record<string, unknown>, receipt: Record<string, unknown>, canInspect: boolean) => {
    const batch = item.batch as Record<string, unknown> | undefined;
    const material = batch?.material as Record<string, unknown> | undefined;
    const inspections = (batch?.inspections ?? []) as Array<Record<string, unknown>>;
    const batchQty = Number(item.quantity ?? batch?.quantity ?? 0);
    const po = receipt.purchaseOrder as Record<string, unknown> | undefined;
    const hasInspection = inspections.length > 0;

    return (
      <tr key={item.id as string} className="border-b border-border/50 hover:bg-muted/30 transition-colors">
        <td className="px-4 py-3 font-mono text-foreground text-xs">{(batch?.batchNumber ?? "—") as string}</td>
        <td className="px-4 py-3 text-foreground">{(material?.name ?? "—") as string}</td>
        <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{(material?.code ?? "—") as string}</td>
        <td className="px-4 py-3 text-foreground">{batchQty} {(material?.unit ?? "pcs") as string}</td>
        <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{(receipt.receiptNo ?? "—") as string}</td>
        <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{(po?.poNumber ?? "—") as string}</td>
        <td className="px-4 py-3">
          {hasInspection ? (
            <div className="flex items-center gap-1.5">
              {inspections.map((ins, i) => {
                const result = ins.result as string;
                const Icon = result === "ACCEPTED" ? CheckCircle2 : result === "REJECTED" ? XCircle : AlertTriangle;
                const color = result === "ACCEPTED" ? "text-success" : result === "REJECTED" ? "text-destructive" : "text-warning";
                return (
                  <div key={i} className="flex items-center gap-1">
                    <Icon className={`w-3.5 h-3.5 ${color}`} />
                    <span className={`text-xs font-medium ${color}`}>
                      {ins.acceptedQty as number}✓ {Number(ins.rejectedQty ?? 0) > 0 ? `${ins.rejectedQty}✗` : ""}
                    </span>
                  </div>
                );
              })}
            </div>
          ) : (
            <span className="text-xs text-muted-foreground">Pending</span>
          )}
        </td>
        <td className="px-4 py-3">
          {canInspect && !hasInspection && (
            <button
              onClick={() => setInspecting({
                batchId: batch?.id as string,
                batchNumber: (batch?.batchNumber ?? "") as string,
                materialName: (material?.name ?? "") as string,
                quantity: batchQty,
                result: "ACCEPTED",
                inspectedQty: String(batchQty),
                acceptedQty: String(batchQty),
                rejectedQty: "0",
                remarks: "",
              })}
              className="px-2.5 py-1.5 rounded-md bg-primary/10 text-primary text-xs font-medium hover:bg-primary/20 transition-colors">
              Inspect
            </button>
          )}
        </td>
      </tr>
    );
  };

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-bold text-foreground">Material Inspection</h1>

      {isLoading ? (
        <div className="flex items-center justify-center p-12"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
      ) : (
        <>
          {/* Pending Inspection */}
          <div>
            <h2 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-warning" />
              Pending Inspection ({pendingReceipts.reduce((acc, r) => {
                const items = (r.items ?? []) as Array<Record<string, unknown>>;
                const uninspected = items.filter(item => {
                  const batch = item.batch as Record<string, unknown> | undefined;
                  const inspections = (batch?.inspections ?? []) as Array<unknown>;
                  return inspections.length === 0;
                });
                return acc + uninspected.length;
              }, 0)} batches)
            </h2>
            <div className="bg-card rounded-xl border border-border overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead><tr className="border-b border-border bg-muted/50">
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground">Batch #</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground">Material</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground">Code</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground">Quantity</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground">Receipt #</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground">PO #</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground">Result</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground">Action</th>
                  </tr></thead>
                  <tbody>
                    {pendingReceipts.length === 0 ? (
                      <tr><td colSpan={8} className="text-center py-6 text-muted-foreground">No batches pending inspection</td></tr>
                    ) : pendingReceipts.flatMap(r => {
                      const items = (r.items ?? []) as Array<Record<string, unknown>>;
                      return items.map(item => renderBatchRow(item, r, true));
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* Completed Inspections */}
          {inspectedReceipts.length > 0 && (
            <div>
              <h2 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-success" /> Completed Inspections
              </h2>
              <div className="bg-card rounded-xl border border-border overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead><tr className="border-b border-border bg-muted/50">
                      <th className="text-left px-4 py-3 font-medium text-muted-foreground">Batch #</th>
                      <th className="text-left px-4 py-3 font-medium text-muted-foreground">Material</th>
                      <th className="text-left px-4 py-3 font-medium text-muted-foreground">Code</th>
                      <th className="text-left px-4 py-3 font-medium text-muted-foreground">Quantity</th>
                      <th className="text-left px-4 py-3 font-medium text-muted-foreground">Receipt #</th>
                      <th className="text-left px-4 py-3 font-medium text-muted-foreground">PO #</th>
                      <th className="text-left px-4 py-3 font-medium text-muted-foreground">Result</th>
                      <th className="w-8" />
                    </tr></thead>
                    <tbody>
                      {inspectedReceipts.flatMap(r => {
                        const items = (r.items ?? []) as Array<Record<string, unknown>>;
                        return items.map(item => renderBatchRow(item, r, false));
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </>
      )}

      {/* Inspection Modal */}
      {inspecting && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 animate-fade-in">
          <div className="bg-card rounded-xl border border-border shadow-xl w-full max-w-md mx-4">
            <div className="px-6 py-4 border-b border-border">
              <h2 className="text-base font-semibold text-foreground">Inspect Batch {inspecting.batchNumber}</h2>
              <p className="text-xs text-muted-foreground mt-1">{inspecting.materialName} — {inspecting.quantity} units</p>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-foreground mb-1.5">Result</label>
                <div className="flex gap-2">
                  {(["ACCEPTED", "PARTIALLY_ACCEPTED", "REJECTED"] as const).map(r => (
                    <button key={r} onClick={() => {
                      const accepted = r === "ACCEPTED" ? String(inspecting.quantity) : r === "REJECTED" ? "0" : inspecting.acceptedQty;
                      const rejected = r === "REJECTED" ? String(inspecting.quantity) : r === "ACCEPTED" ? "0" : inspecting.rejectedQty;
                      setInspecting({ ...inspecting, result: r, acceptedQty: accepted, rejectedQty: rejected });
                    }}
                      className={`flex-1 py-2 rounded-lg text-xs font-medium transition-colors ${
                        inspecting.result === r
                          ? r === "ACCEPTED" ? "bg-success text-white" : r === "REJECTED" ? "bg-destructive text-white" : "bg-warning text-white"
                          : "bg-muted text-muted-foreground hover:bg-muted/80"
                      }`}>
                      {r === "PARTIALLY_ACCEPTED" ? "Partial" : r.charAt(0) + r.slice(1).toLowerCase()}
                    </button>
                  ))}
                </div>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1">Inspected</label>
                  <input type="number" value={inspecting.inspectedQty} onChange={(e) => setInspecting({ ...inspecting, inspectedQty: e.target.value })}
                    className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring/30" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1">Accepted</label>
                  <input type="number" value={inspecting.acceptedQty} onChange={(e) => setInspecting({ ...inspecting, acceptedQty: e.target.value })}
                    className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring/30" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1">Rejected</label>
                  <input type="number" value={inspecting.rejectedQty} onChange={(e) => setInspecting({ ...inspecting, rejectedQty: e.target.value })}
                    className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring/30" />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">Remarks</label>
                <textarea value={inspecting.remarks} onChange={(e) => setInspecting({ ...inspecting, remarks: e.target.value })}
                  className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring/30" rows={2} />
              </div>
              <div className="flex gap-3">
                <button onClick={() => setInspecting(null)} className="flex-1 py-2.5 rounded-lg bg-muted text-muted-foreground text-sm font-medium hover:bg-muted/80 transition-colors">Cancel</button>
                <button onClick={() => inspectMutation.mutate(inspecting)} disabled={inspectMutation.isPending}
                  className="flex-1 py-2.5 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-50 flex items-center justify-center gap-2">
                  {inspectMutation.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
                  Submit Inspection
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MaterialInspection;
