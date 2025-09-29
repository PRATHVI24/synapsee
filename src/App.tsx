import { Layout } from "@/components/Layout";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";

import Dashboard from "./pages/Dashboard";
import HL7Page from "./pages/hl7/HL7Page";
import FinanceOCR from "./pages/FinanceOCR";
import AIInterview from "./pages/AIInterview";
import SalesManager from "./pages/SalesManager";
import OutboundCalls from "./pages/OutboundCalls";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Layout>
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/hl7" element={<HL7Page />} />
            <Route path="/finance-ocr" element={<FinanceOCR />} />
            <Route path="/ai-interview" element={<AIInterview />} />
            <Route path="/sales-manager" element={<SalesManager />} />
            <Route path="/outbound-calls" element={<OutboundCalls />} />
            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </Layout>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
