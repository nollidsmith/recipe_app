import { useState, type FormEvent } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { useAuth } from "./AuthProvider";
import { rememberOAuthReturnTo } from "./oauth";

type FormMode = "sign-in" | "sign-up" | "reset";

function readableError(message: string) {
  if (message.toLowerCase().includes("invalid login credentials")) {
    return "That email or password is not correct. Try again or create an account.";
  }
  return message;
}

export default function LoginPage() {
  const { session } = useAuth();
  const location = useLocation();
  const [mode, setMode] = useState<FormMode>("sign-in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [firstName, setFirstName] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  if (session) return <Navigate to="/" replace />;

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    setMessage("");
    setBusy(true);

    try {
      if (mode === "reset") {
        const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: `${window.location.origin}/reset-password`,
        });
        if (resetError) throw resetError;
        setMessage("If an account exists for that email, a reset link is on its way.");
      } else if (mode === "sign-up") {
        const { data, error: signUpError } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: window.location.origin,
            data: { first_name: firstName.trim() },
          },
        });
        if (signUpError) throw signUpError;
        setMessage(
          data.session
            ? "Your account is ready."
            : "Check your email to confirm your account before signing in.",
        );
      } else {
        const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
        if (signInError) throw signInError;
      }
    } catch (caught) {
      setError(readableError(caught instanceof Error ? caught.message : "Something went wrong."));
    } finally {
      setBusy(false);
    }
  };

  const oauth = async (provider: "google" | "apple") => {
    setError("");
    setBusy(true);
    try {
      const from = typeof location.state?.from?.pathname === "string"
        ? `${location.state.from.pathname}${location.state.from.search ?? ""}${location.state.from.hash ?? ""}`
        : "/";
      rememberOAuthReturnTo(from);
      const { error: oauthError } = await supabase.auth.signInWithOAuth({
        provider,
        options: { redirectTo: window.location.origin },
      });
      if (oauthError) throw oauthError;
    } catch (caught) {
      setError(readableError(caught instanceof Error ? caught.message : "Unable to start social sign-in."));
      setBusy(false);
    }
  };

  const title = mode === "reset" ? "Reset your password" : mode === "sign-up" ? "Build your recipe space" : "Welcome back";

  return (
    <main className="auth-shell">
      <section className="auth-panel auth-brand-panel" aria-label="PantryPilot introduction">
        <p className="eyebrow">PantryPilot</p>
        <h1>Cook what you have. Remember what you love.</h1>
        <p className="auth-tagline">Your recipes, pantry, and next meal in one calm command center.</p>
        <div className="orbit orbit-one" />
        <div className="orbit orbit-two" />
      </section>

      <section className="auth-panel auth-form-panel" aria-labelledby="auth-title">
        <div className="auth-heading">
          <p className="eyebrow">Your kitchen, organized</p>
          <h2 id="auth-title">{title}</h2>
          <p className="muted">
            {mode === "reset" ? "We’ll send a secure link to your inbox." : "Keep your favorite meals and pantry in sync."}
          </p>
        </div>

        {message && <div className="notice success" role="status">{message}</div>}
        {error && <div className="notice error" role="alert">{error}</div>}

        {mode !== "reset" && (
          <div className="oauth-grid">
            <button className="button button-secondary" type="button" onClick={() => oauth("google")} disabled={busy}>
              Continue with Google
            </button>
            <button className="button button-secondary" type="button" onClick={() => oauth("apple")} disabled={busy}>
              Continue with Apple
            </button>
          </div>
        )}

        <div className="divider"><span>or use email</span></div>

        <form className="auth-form" onSubmit={submit}>
          <label htmlFor="email">Email address</label>
          <input id="email" type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} required />

          {mode !== "reset" && (
            <>
              {mode === "sign-up" && <><label htmlFor="first-name">First name</label><input id="first-name" type="text" autoComplete="given-name" value={firstName} onChange={(event) => setFirstName(event.target.value)} required /></>}
              <label htmlFor="password">Password</label>
              <input id="password" type="password" autoComplete={mode === "sign-up" ? "new-password" : "current-password"} value={password} onChange={(event) => setPassword(event.target.value)} minLength={8} required />
            </>
          )}

          <button className="button button-primary" type="submit" disabled={busy}>
            {busy ? "Working…" : mode === "reset" ? "Send reset link" : mode === "sign-up" ? "Create account" : "Sign in"}
          </button>
        </form>

        <div className="auth-links">
          {mode === "sign-in" && <button type="button" onClick={() => { setMode("reset"); setMessage(""); setError(""); }}>Forgot password?</button>}
          {mode === "reset" && <button type="button" onClick={() => { setMode("sign-in"); setMessage(""); setError(""); }}>Back to sign in</button>}
          {mode !== "reset" && <button type="button" onClick={() => { setMode(mode === "sign-in" ? "sign-up" : "sign-in"); setMessage(""); setError(""); }}>{mode === "sign-in" ? "Need an account? Sign up" : "Already have an account? Sign in"}</button>}
        </div>
      </section>
    </main>
  );
}
