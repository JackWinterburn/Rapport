import { lazy, Suspense } from "react";
import { BrowserRouter, Navigate, Route, Routes } from "react-router";
import { QueryClientProvider } from "@tanstack/react-query";
import { ApiError } from "@rapport/core";
import { Spinner, ToastProvider } from "./ui";
import { queryClient, useMe } from "./lib/api";
import { AppShell } from "./app/AppShell";
import { LoginPage } from "./app/LoginPage";
import { ContactsPage } from "./app/ContactsPage";
import { ContactPage } from "./app/ContactPage";
import { ContactFormPage } from "./app/ContactFormPage";
import { CapturePage } from "./app/CapturePage";
import { UpcomingPage } from "./app/UpcomingPage";
import { SettingsPage } from "./app/SettingsPage";
import { NotFoundPage } from "./app/NotFoundPage";

// The living style guide is only needed occasionally; keep it out of the main bundle.
const DesignSystemPage = lazy(() => import("./app/DesignSystemPage"));

function Splash() {
  return (
    <div className="splash" role="status" aria-label="Loading">
      <Spinner size={22} />
    </div>
  );
}

function RequireAuth() {
  const { data, error, isPending } = useMe();
  if (isPending) return <Splash />;
  if (error instanceof ApiError && error.status === 401) return <Navigate to="/login" replace />;
  if (!data) return <Splash />;
  return <AppShell />;
}

export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route element={<RequireAuth />}>
              <Route index element={<ContactsPage />} />
              <Route path="contacts/new" element={<ContactFormPage />} />
              <Route path="contacts/:id" element={<ContactPage />} />
              <Route path="contacts/:id/edit" element={<ContactFormPage />} />
              <Route path="capture" element={<CapturePage />} />
              <Route path="upcoming" element={<UpcomingPage />} />
              <Route path="settings" element={<SettingsPage />} />
              <Route
                path="design-system"
                element={
                  <Suspense fallback={<Splash />}>
                    <DesignSystemPage />
                  </Suspense>
                }
              />
              <Route path="*" element={<NotFoundPage />} />
            </Route>
          </Routes>
        </BrowserRouter>
      </ToastProvider>
    </QueryClientProvider>
  );
}
