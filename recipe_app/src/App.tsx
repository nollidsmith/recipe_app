import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { AuthProvider, useAuth } from "./app/AuthProvider";
import HubPage from "./app/HubPage";
import LoginPage from "./app/LoginPage";
import ProtectedRoute from "./app/ProtectedRoute";
import ResetPasswordPage from "./app/ResetPasswordPage";
import RecipeFormPage from "./app/RecipeFormPage";
import PantryPage from "./app/PantryPage";
import ComingSoonPage from "./app/ComingSoonPage";

function LoadingScreen() {
  return <main className="loading-shell"><div className="loading-mark">PP</div><p>Opening your kitchen…</p></main>;
}

function AppRoutes() {
  const { loading } = useAuth();
  if (loading) return <LoadingScreen />;
  return (
    <Routes>
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
    </Routes>
  );
}

function App() {
  return <BrowserRouter><AuthProvider><AppRoutes /></AuthProvider></BrowserRouter>;
}

export default App;
