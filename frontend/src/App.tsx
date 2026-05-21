import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, useLocation } from "react-router-dom";
import { useEffect } from "react";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import Index from "./pages/Index.tsx";
import Dashboard from "./pages/Dashboard.tsx";
import NotFound from "./pages/NotFound.tsx";
import Login from "./pages/Login.tsx";
import Register from "./pages/Register.tsx";
import Onboarding from "./pages/Onboarding.tsx";
import Settings from "./pages/Settings.tsx";
import { AuthProvider } from "./context/AuthContext.tsx";

const queryClient = new QueryClient();

const titles: Record<string, string> = {
  "/": "Insights — Home",
  "/login": "Insights — Login",
  "/register": "Insights — Create Account",
  "/onboarding": "Insights — Connect Platforms",
  "/dashboard": "Insights — Dashboard",
  "/settings": "Insights — Settings",
};

function PageTitleManager() {
  const location = useLocation();

  useEffect(() => {
    document.title = titles[location.pathname] || "Insights — Social Dashboard";
  }, [location.pathname]);

  return null;
}

const App = () => {
  return (

  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <PageTitleManager />
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route path="/onboarding" element={<Onboarding />} />
            <Route path="/settings" element={<Settings />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
  );
};

export default App;
