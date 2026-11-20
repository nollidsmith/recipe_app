import { useState } from "react";
import { useAuth } from "./AuthProvider";
import RecipeHubPage from "./RecipeHubPage";
import AppNav from "../components/AppNav";

export default function HubPage() {
  const { session, firstName, signOut } = useAuth();
  const [error, setError] = useState("");

  const logout = async () => {
    try {
      await signOut();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to sign out.");
    }
  };

  return (
    <main className="hub-shell">
      <header className="hub-header">
        <div><h1>Welcome back{firstName ? `, ${firstName}` : ""}</h1><p className="muted">Your recipes, pantry, and next meal in one calm command center.</p></div>
      </header>
      {error && <div className="notice error" role="alert">{error}</div>}
      <RecipeHubPage />
      <p className="hub-footer">Signed in as {session?.user.email}</p>
      <AppNav onSignOut={logout} />
    </main>
  );
}
