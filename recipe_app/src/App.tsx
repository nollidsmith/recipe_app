import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { lazy, Suspense } from "react";
import { AuthProvider, useAuth } from "./app/AuthProvider";
import LoginPage from "./app/LoginPage";
import ProtectedRoute from "./app/ProtectedRoute";
import OAuthCallbackPage from "./app/OAuthCallbackPage";
import { isOAuthCallbackUrl } from "./app/oauth";

const HubPage = lazy(() => import("./app/HubPage"));
const ResetPasswordPage = lazy(() => import("./app/ResetPasswordPage"));
const RecipeFormPage = lazy(() => import("./app/RecipeFormPage"));
const PantryPage = lazy(() => import("./app/PantryPage"));
const ComingSoonPage = lazy(() => import("./app/ComingSoonPage"));

function LoadingScreen() {
  return <main className="loading-shell"><div className="loading-mark" aria-hidden="true">PP</div><p role="status" aria-live="polite">Opening your kitchen…</p></main>;
}

function AppRoutes() {
  const { loading } = useAuth();
  if (loading) return <LoadingScreen />;
  if (isOAuthCallbackUrl()) return <OAuthCallbackPage />;
  return (
    <Suspense fallback={<LoadingScreen />}><Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/reset-password" element={<ResetPasswordPage />} />
      <Route element={<ProtectedRoute />}>
        <Route path="/" element={<HubPage />} />
        <Route path="/recipes/new" element={<RecipeFormPage />} />
        <Route path="/pantry" element={<PantryPage />} />
        <Route path="/shopping" element={<ComingSoonPage title="Shopping list" description="Turn missing and low-stock ingredients into one simple list." />} />
        <Route path="/popular" element={<ComingSoonPage title="Most popular recipe" description="Popular recipes will appear here once favorites and recipe activity are connected." />} />
        <Route path="/profile" element={<ComingSoonPage title="Your profile" description="Account settings and preferences are coming next." />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes></Suspense>
  );
}

function App() {
  return <BrowserRouter><AuthProvider><AppRoutes /></AuthProvider></BrowserRouter>;
}

export default App;
