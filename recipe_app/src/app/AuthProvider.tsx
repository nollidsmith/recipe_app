import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "../lib/supabase";
import { toUserFacingError } from "../lib/errors";

type AuthContextValue = {
  session: Session | null;
  firstName: string | null;
  loading: boolean;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [firstName, setFirstName] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    let profileRequest = 0;

    const loadProfile = async (nextSession: Session | null) => {
      const requestId = ++profileRequest;
      const metadataName = nextSession?.user.user_metadata?.first_name;
      if (!nextSession) {
        if (active && requestId === profileRequest) setFirstName(null);
        return;
      }
      try {
        const { data, error } = await supabase
          .from("profiles")
          .select("display_name")
          .eq("id", nextSession.user.id)
          .maybeSingle();
        if (error) console.warn("Profile lookup failed", error);
        if (active && requestId === profileRequest) setFirstName(data?.display_name || metadataName || null);
      } catch (error) {
        console.warn("Profile lookup failed", error);
        if (active && requestId === profileRequest) setFirstName(metadataName || null);
      }
    };

    supabase.auth.getSession().then(({ data }) => {
      if (!active) return;
      setSession(data.session);
      void loadProfile(data.session);
      setLoading(false);
    }).catch((error) => {
      if (!active) return;
      console.warn("Session lookup failed", error);
      setSession(null);
      setFirstName(null);
      setLoading(false);
    });

    const { data } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      if (!active) return;
      setSession(nextSession);
      void loadProfile(nextSession);
      setLoading(false);
    });

    return () => {
      active = false;
      data.subscription.unsubscribe();
    };
  }, []);

  const value = useMemo(
    () => ({
      session,
      firstName,
      loading,
      signOut: async () => {
        const { error } = await supabase.auth.signOut();
        if (error) throw toUserFacingError(error, "Unable to sign out. Try again.");
      },
    }),
    [firstName, loading, session],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used inside AuthProvider");
  return context;
}
