/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useEffect } from "react";
import { createBrowserRouter, RouterProvider, Navigate, Outlet } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Layout } from "./components/layout/Layout";
import { Feed } from "./pages/Feed";
import { SubmitProblem } from "./pages/SubmitProblem";
import { SubmitBuild } from "./pages/SubmitBuild";
import { SubmitSolution } from "./pages/SubmitSolution";
import { ProblemDetail } from "./pages/ProblemDetail";
import { Profile } from "./pages/Profile";
import { Search } from "./pages/Search";
import { Settings } from "./pages/Settings";
import { Notifications } from "./pages/Notifications";
import { BoostSetup } from "./pages/BoostSetup";
import { Onboarding } from "./pages/Onboarding";
import { PrivacyPolicy } from "./pages/PrivacyPolicy";
import { TermsAndConditions } from "./pages/TermsAndConditions";
import { UserGuidance } from "./pages/UserGuidance";
import { AuthProvider } from "./contexts/AuthContext";
import { SettingsProvider } from "./contexts/SettingsContext";
import { Toaster, toast } from 'sonner';
import { ScrollToTop } from "./components/ScrollToTop";
import { PullToRefresh } from "./components/PullToRefresh";

const RootLayout = () => {
  useEffect(() => {
    const handleOffline = () => {
      toast("You are currently offline", {
        duration: 2000,
        id: "offline-status-toast"
      });
    };

    if (!navigator.onLine) {
      handleOffline();
    }

    window.addEventListener("offline", handleOffline);
    return () => {
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  return (
    <>
      <ScrollToTop />
      <PullToRefresh>
        <Toaster 
          position="bottom-center" 
          theme="dark" 
          duration={1800}
          toastOptions={{
            className: "font-mono border border-buildops-border bg-buildops-card text-buildops-text text-[11px] rounded-none shadow-[0_10px_40px_-10px_rgba(0,0,0,0.9)] tracking-wide flex items-center justify-between p-3.5 gap-4",
            classNames: {
              actionButton: "bg-white text-black hover:bg-neutral-200 uppercase tracking-widest text-[9px] px-3.5 py-2.5 font-extrabold font-mono rounded-none cursor-pointer select-none transition-colors ml-auto border-0 shrink-0",
              cancelButton: "bg-transparent text-buildops-text-secondary hover:text-white uppercase tracking-widest text-[9px] px-3.5 py-2.5 font-mono rounded-none cursor-pointer transition-colors shrink-0",
            },
            style: {
              background: '#11141B',
              borderColor: '#222834',
              borderRadius: '0px',
              fontFamily: "'JetBrains Mono', monospace",
              color: '#F4F7FB',
              boxShadow: '0 10px 40px -10px rgba(0,0,0,0.9), inset 0 1px 0 rgba(255,255,255,0.05)',
              ['--normal-transition' as any]: '120ms cubic-bezier(0.16, 1, 0.3, 1)',
            }
          }}
        />
        <Layout />
      </PullToRefresh>
    </>
  );
};

const router = createBrowserRouter([
  {
    path: "/",
    element: <RootLayout />,
    children: [
      { index: true, element: <Navigate to="/explore" replace /> },
      { path: "onboarding", element: <Onboarding /> },
      { path: "explore", element: <Feed /> },
      { path: "problems", element: <Navigate to="/explore" replace /> },
      { path: "problems/new", element: <SubmitProblem /> },
      { path: "builds/new", element: <SubmitBuild /> },
      { path: "problems/:id", element: <ProblemDetail /> },
      { path: "problems/:id/submit", element: <SubmitSolution /> },
      { path: "search", element: <Search /> },
      { path: "profile", element: <Profile /> },
      { path: "profile/:id", element: <Profile /> },
      { path: "saved", element: <Navigate to="/settings/activity" replace /> },
      { path: "settings", element: <Settings /> },
      { path: "settings/:tab", element: <Settings /> },
      { path: "notifications", element: <Notifications /> },
      { path: "boost/:id", element: <BoostSetup /> },
      { path: "privacy-policy", element: <PrivacyPolicy /> },
      { path: "terms", element: <TermsAndConditions /> },
      { path: "user-guidance", element: <UserGuidance /> },
      { path: "*", element: <Navigate to="/" replace /> }
    ]
  }
]);

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 5, // 5 seconds default staleTime for stale-while-revalidate
      gcTime: 1000 * 60 * 10, // 10 minutes cache retention
      refetchOnWindowFocus: false, // disable frequent refetches on focus
    },
  },
});

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <SettingsProvider>
        <AuthProvider>
          <RouterProvider router={router} />
        </AuthProvider>
      </SettingsProvider>
    </QueryClientProvider>
  );
}
