import React from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, useNavigate } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/context/AuthContext";
import Layout from "@/components/Layout";
import Login from "@/pages/Login";
import Dashboard from "@/pages/Dashboard";
import SupplierEnquiry from "@/pages/SupplierEnquiry";
import SupplierQuotation from "@/pages/SupplierQuotation";
import PurchaseOrder from "@/pages/PurchaseOrder";
import MaterialReceipt from "@/pages/MaterialReceipt";
import MaterialInspection from "@/pages/MaterialInspection";
import Inventory from "@/pages/Inventory";
import BOMManagement from "@/pages/BOMManagement";
import FeasibilityAnalyzer from "@/pages/FeasibilityAnalyzer";
import OrderConfirmation from "@/pages/OrderConfirmation";
import Copilot from "@/pages/Copilot";
import AuditLogs from "@/pages/AuditLogs";
import Reports from "@/pages/Reports";
import NotFound from "@/pages/NotFound";
import { Factory, Loader2 } from "lucide-react";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
      staleTime: 30_000,
    },
  },
});

const LoadingScreen = () => (
  <div className="min-h-screen flex items-center justify-center bg-background">
    <div className="text-center space-y-4 animate-fade-in">
      <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-primary/10">
        <Factory className="w-8 h-8 text-primary" />
      </div>
      <div className="flex items-center gap-2 text-muted-foreground">
        <Loader2 className="w-4 h-4 animate-spin" />
        <span className="text-sm">Loading SMOP…</span>
      </div>
    </div>
  </div>
);

const AppRoutes = () => {
  const { isLoggedIn, isLoading } = useAuth();
  const navigate = useNavigate();
  const wasLoggedIn = React.useRef(isLoggedIn);

  // On every fresh login (isLoggedIn goes false → true), navigate to dashboard
  React.useEffect(() => {
    if (isLoggedIn && !wasLoggedIn.current) {
      navigate("/", { replace: true });
    }
    wasLoggedIn.current = isLoggedIn;
  }, [isLoggedIn, navigate]);

  if (isLoading) return <LoadingScreen />;
  if (!isLoggedIn) return <Login />;

  return (
    <Layout>
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/enquiries" element={<SupplierEnquiry />} />
        <Route path="/quotations" element={<SupplierQuotation />} />
        <Route path="/purchase-orders" element={<PurchaseOrder />} />
        <Route path="/material-receipt" element={<MaterialReceipt />} />
        <Route path="/inspection" element={<MaterialInspection />} />
        <Route path="/inventory" element={<Inventory />} />
        <Route path="/bom" element={<BOMManagement />} />
        <Route path="/feasibility" element={<FeasibilityAnalyzer />} />
        <Route path="/orders" element={<OrderConfirmation />} />
        <Route path="/reports" element={<Reports />} />
        <Route path="/audit-logs" element={<AuditLogs />} />
        <Route path="/copilot" element={<Copilot />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </Layout>
  );
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Sonner />
      <AuthProvider>
        <BrowserRouter>
          <AppRoutes />
        </BrowserRouter>
      </AuthProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
