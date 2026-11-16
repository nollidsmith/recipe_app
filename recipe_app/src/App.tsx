import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { AuthProvider, useAuth } from "./app/AuthProvider";
import HubPage from "./app/HubPage";
import LoginPage from "./app/LoginPage";
import ProtectedRoute from "./app/ProtectedRoute";

function LoadingScreen() {
  return <main className="loading-shell"><div className="loading-mark">PP</div><p>Opening your kitchen…</p></main>;
}

function AppRoutes() {
  const { loading } = useAuth();
  if (loading) return <LoadingScreen />;
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route element={<ProtectedRoute />}>
        <Route path="/" element={<HubPage />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

function App() {
  return <BrowserRouter><AuthProvider><AppRoutes /></AuthProvider></BrowserRouter>;
}

export default App;
