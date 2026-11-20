import { useState } from "react";
import { NavLink } from "react-router-dom";
import { useAuth } from "../app/AuthProvider";

const navItems = [
  { to: "/", label: "Recipes", icon: "✦" },
  { to: "/pantry", label: "Stock", icon: "◒" },
  { to: "/popular", label: "Popular", icon: "★" },
  { to: "/shopping", label: "Shopping", icon: "✓" },
  { to: "/profile", label: "Profile", icon: "◎" },
];

type AppNavProps = {
  onSignOut?: () => void | Promise<void>;
};

function navLinkClass(className: string) {
  return ({ isActive }: { isActive: boolean }) => isActive ? `${className} active` : className;
}

export default function AppNav({ onSignOut }: AppNavProps) {
  const { signOut } = useAuth();
  const [signingOut, setSigningOut] = useState(false);
  const [signOutError, setSignOutError] = useState("");
  const handleSignOut = onSignOut ?? signOut;

  const signOutUser = async () => {
    if (signingOut) return;
    setSigningOut(true);
    setSignOutError("");
    try {
      await handleSignOut();
    } catch {
      setSignOutError("Unable to sign out. Try again.");
    } finally {
      setSigningOut(false);
    }
  };

  const links = navItems.map((item) => (
    <NavLink end={item.to === "/"} className={navLinkClass("desktop-nav-link")} key={item.to} to={item.to}>
      <span aria-hidden="true">{item.icon}</span>
      <span>{item.label}</span>
    </NavLink>
  ));

  const mobileLinks = navItems.map((item) => (
    <NavLink end={item.to === "/"} className={navLinkClass("mobile-nav-link")} key={item.to} to={item.to}>
      <span aria-hidden="true">{item.icon}</span>
      <span>{item.label}</span>
    </NavLink>
  ));

  return <>
    <nav className="desktop-nav" aria-label="Main navigation">
      <span className="desktop-nav-brand">PantryPilot</span>
      {links}
      <span className="desktop-nav-spacer" aria-hidden="true" />
      <button className="desktop-nav-signout" type="button" onClick={() => void signOutUser()} disabled={signingOut} aria-busy={signingOut}>
        {signingOut ? "Signing out…" : "Sign out"}
      </button>
      {signOutError && <span className="desktop-nav-error" role="alert">{signOutError}</span>}
    </nav>
    <nav className="mobile-nav" aria-label="Main navigation">{mobileLinks}</nav>
  </>;
}
