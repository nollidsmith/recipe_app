import { useState } from "react";
import { useAuth } from "./AuthProvider";

export default function HubPage() {
  const { session, signOut } = useAuth();
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
        <div><p className="eyebrow">PantryPilot</p><h1>Your kitchen hub</h1></div>
        <button className="button button-secondary" type="button" onClick={logout}>Sign out</button>
      </header>
      {error && <div className="notice error" role="alert">{error}</div>}
      <section className="hub-grid" aria-label="PantryPilot sections">
        <article className="hub-card accent-blue"><span className="card-icon">✦</span><p className="eyebrow">Recipes</p><h2>Your recipe book is ready.</h2><p className="muted">Saved recipes and your own creations will live here.</p></article>
        <article className="hub-card accent-red"><span className="card-icon">◒</span><p className="eyebrow">Pantry</p><h2>Know what’s in stock.</h2><p className="muted">Track ingredients and get smart stocking suggestions.</p></article>
      </section>
      <p className="hub-footer">Signed in as {session?.user.email}</p>
    </main>
  );
}
