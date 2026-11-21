import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "./AuthProvider";
import { clearOAuthCallbackParams, consumeOAuthReturnTo, getOAuthCallbackParams } from "./oauth";

export default function OAuthCallbackPage() {
  const { loading, session } = useAuth();
  const navigate = useNavigate();
  const [error, setError] = useState("");
  const [callbackReady, setCallbackReady] = useState(false);

  useEffect(() => {
    const callback = getOAuthCallbackParams();
    clearOAuthCallbackParams();
    setCallbackReady(true);

    if (callback.error || callback.errorDescription || callback.errorCode) {
      const details = [callback.error, callback.errorDescription, callback.errorCode && `Code: ${callback.errorCode}`]
        .filter(Boolean)
        .join(" ");
      setError(details || "Your social sign-in could not be completed. Try again.");
      return;
    }

    if (!callback.isCallback) {
      setError("This sign-in link is incomplete. Start again from the login page.");
    }
  }, []);

  useEffect(() => {
    if (callbackReady && !error && !loading && session) {
      navigate(consumeOAuthReturnTo(), { replace: true });
    }
  }, [callbackReady, error, loading, navigate, session]);

  useEffect(() => {
    if (!callbackReady || error || loading || session) return;
    const timeout = window.setTimeout(() => {
      setError("We couldn't complete social sign-in because no session was created. Try signing in again.");
    }, 5000);
    return () => window.clearTimeout(timeout);
  }, [callbackReady, error, loading, session]);

  const retry = () => {
    navigate("/login", { replace: true });
  };

  if (error) {
    return (
      <main className="loading-shell" aria-labelledby="oauth-error-title">
        <section className="callback-card">
          <div className="loading-mark" aria-hidden="true">PP</div>
          <h1 id="oauth-error-title">Sign-in was not completed</h1>
          <p className="notice error" role="alert">{error}</p>
          <button className="button button-primary" type="button" onClick={retry}>
            Try sign-in again
          </button>
        </section>
      </main>
    );
  }

  return (
    <main className="loading-shell" aria-labelledby="oauth-loading-title">
      <div className="loading-mark" aria-hidden="true">PP</div>
      <p id="oauth-loading-title" role="status" aria-live="polite">Completing sign-in…</p>
    </main>
  );
}
