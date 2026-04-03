import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { manufacturingApi } from "@/lib/api";
import { CheckCircle2, XCircle, Loader2, ShoppingBag } from "lucide-react";
import { useNavigate } from "react-router-dom";

interface FeasibilityResult {
  feasible: boolean;
  productName: string;
  requestedQuantity: number;
  maxProducibleQuantity: number;
  materials: Array<{
    materialName: string;
    requiredQty: number;
    availableQty: number;
    shortage: number;
    isSufficient: boolean;
  }>;
}

const FeasibilityAnalyzer = () => {
  const navigate = useNavigate();
  const [selectedBomId, setSelectedBomId] = useState("");
  const [quantity, setQuantity] = useState("");
  const [result, setResult] = useState<FeasibilityResult | null>(null);
  const [scenarios, setScenarios] = useState<Array<{ qty: number; result: FeasibilityResult }>>([]);

  const { data: bomsRes } = useQuery({
    queryKey: ["boms"],
    queryFn: () => manufacturingApi.viewBOMs(),
  });

  const boms = (bomsRes?.data ?? []) as Array<Record<string, unknown>>;
  const selectedBom = boms.find(b => b.id === selectedBomId);

  const analyzeMutation = useMutation({
    mutationFn: () => manufacturingApi.analyzeFeasibility({ bomId: selectedBomId, quantity: Number(quantity) }),
    onSuccess: (res) => {
      if (res.data) {
        const r = res.data as unknown as FeasibilityResult;
        setResult(r);
        // Add to scenarios if not already there
        setScenarios(prev => {
          const exists = prev.some(s => s.qty === Number(quantity));
          if (exists) return prev.map(s => s.qty === Number(quantity) ? { ...s, result: r } : s);
          return [...prev, { qty: Number(quantity), result: r }];
        });
      }
    },
    onError: (err: Error) => {
      setResult({ feasible: false, productName: "Error", requestedQuantity: 0, maxProducibleQuantity: 0, materials: [{ materialName: err.message, requiredQty: 0, availableQty: 0, shortage: 0, isSufficient: false }] });
    },
  });

  const handleBomChange = (bomId: string) => {
    setSelectedBomId(bomId);
    setResult(null);
    setScenarios([]);
  };

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-bold text-foreground">Feasibility Analyzer</h1>

      <div className="bg-card rounded-xl border border-border p-6 max-w-lg">
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">Product (BOM)</label>
            <select value={selectedBomId} onChange={(e) => handleBomChange(e.target.value)}
              className="w-full rounded-lg border border-input bg-background px-3.5 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring/30 focus:border-primary transition-colors">
              <option value="">Select a BOM</option>
              {boms.map((b) => (
                <option key={b.id as string} value={b.id as string}>
                  {(b.productName ?? b.name) as string} {b.bomNumber ? `(${b.bomNumber})` : ""}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">Quantity</label>
            <input type="number" value={quantity} onChange={(e) => setQuantity(e.target.value)}
              className="w-full rounded-lg border border-input bg-background px-3.5 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring/30 focus:border-primary transition-colors"
              placeholder="e.g. 100" />
          </div>
          <button onClick={() => analyzeMutation.mutate()} disabled={analyzeMutation.isPending || !selectedBomId || !quantity}
            className="w-full py-2.5 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-50 flex items-center justify-center gap-2">
            {analyzeMutation.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
            Analyze Feasibility
          </button>
        </div>
      </div>

      {/* Scenario Comparison */}
      {scenarios.length > 1 && (
        <div className="bg-card rounded-xl border border-border p-5">
          <h2 className="text-sm font-semibold text-foreground mb-3">Scenario Comparison</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {scenarios.sort((a, b) => a.qty - b.qty).map(s => (
              <div key={s.qty} className={`p-3 rounded-lg border ${s.result.feasible ? "bg-success/5 border-success/30" : "bg-destructive/5 border-destructive/30"}`}>
                <div className="flex items-center gap-1.5 mb-1">
                  {s.result.feasible
                    ? <CheckCircle2 className="w-3.5 h-3.5 text-success" />
                    : <XCircle className="w-3.5 h-3.5 text-destructive" />}
                  <span className="text-xs font-medium text-foreground">{s.qty} units</span>
                </div>
                <p className="text-xs text-muted-foreground">
                  Max: {s.result.maxProducibleQuantity}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Result */}
      {result && (
        <div className={`rounded-xl border p-6 animate-fade-in ${result.feasible ? "bg-success/5 border-success/30" : "bg-destructive/5 border-destructive/30"}`}>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              {result.feasible ? (
                <><CheckCircle2 className="w-6 h-6 text-success" /><h3 className="text-lg font-semibold text-success">Feasible</h3></>
              ) : (
                <><XCircle className="w-6 h-6 text-destructive" /><h3 className="text-lg font-semibold text-destructive">Not Feasible</h3></>
              )}
            </div>
            {result.feasible && result.productName !== "Error" && (
              <button
                onClick={() => navigate("/orders", { state: { productName: result.productName, quantity: result.requestedQuantity } })}
                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-success text-white text-sm font-medium hover:bg-success/90 transition-colors">
                <ShoppingBag className="w-4 h-4" /> Create Order
              </button>
            )}
          </div>

          {result.productName && result.productName !== "Error" && (
            <div className="mb-4 text-sm text-foreground grid grid-cols-3 gap-4">
              <div><span className="text-xs text-muted-foreground block">Product</span><strong>{result.productName}</strong></div>
              <div><span className="text-xs text-muted-foreground block">Requested</span><strong>{result.requestedQuantity} units</strong></div>
              <div><span className="text-xs text-muted-foreground block">Max Producible</span><strong>{result.maxProducibleQuantity} units</strong></div>
            </div>
          )}

          {result.materials.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr className="border-b border-border">
                  <th className="text-left px-3 py-2 font-medium text-muted-foreground">Material</th>
                  <th className="text-left px-3 py-2 font-medium text-muted-foreground">Required</th>
                  <th className="text-left px-3 py-2 font-medium text-muted-foreground">Available</th>
                  <th className="text-left px-3 py-2 font-medium text-muted-foreground">Shortage</th>
                  <th className="text-left px-3 py-2 font-medium text-muted-foreground">Status</th>
                </tr></thead>
                <tbody>
                  {result.materials.map((m, i) => (
                    <tr key={i} className="border-b border-border/50">
                      <td className="px-3 py-2 text-foreground">{m.materialName}</td>
                      <td className="px-3 py-2 text-foreground">{m.requiredQty}</td>
                      <td className="px-3 py-2 text-foreground">{m.availableQty}</td>
                      <td className="px-3 py-2 text-destructive font-medium">{m.shortage > 0 ? m.shortage : "—"}</td>
                      <td className="px-3 py-2">
                        {m.isSufficient
                          ? <span className="inline-flex items-center gap-1 text-xs text-success font-medium"><CheckCircle2 className="w-3 h-3" /> OK</span>
                          : <span className="inline-flex items-center gap-1 text-xs text-destructive font-medium"><XCircle className="w-3 h-3" /> Short</span>
                        }
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default FeasibilityAnalyzer;
