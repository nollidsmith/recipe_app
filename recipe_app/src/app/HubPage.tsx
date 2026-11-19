import { useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "./AuthProvider";
import RecipeHubPage from "./RecipeHubPage";
import MobileNav from "../components/MobileNav";

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
        <div><p className="eyebrow">PantryPilot</p><h1>Welcome back{firstName ? `, ${firstName}` : ""}</h1><p className="muted">Your recipes, pantry, and next meal in one calm command center.</p></div>
        <button className="button button-secondary" type="button" onClick={logout}>Sign out</button>
      </header>
      {error && <div className="notice error" role="alert">{error}</div>}
      <RecipeHubPage />
      <section className="hub-grid" aria-label="PantryPilot sections">
        <article className="hub-card accent-red"><span className="card-icon">◒</span><p className="eyebrow">Pantry</p><h2>Know what’s in stock.</h2><p className="muted">Track ingredients and get smart stocking suggestions.</p><Link className="text-link" to="/pantry">Open stock →</Link></article>
      </section>
      <p className="hub-footer">Signed in as {session?.user.email}</p>
      <MobileNav />
    </main>
  );
}
