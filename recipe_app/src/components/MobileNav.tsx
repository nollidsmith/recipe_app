import { NavLink } from "react-router-dom";

const navItems = [
  { to: "/", label: "Recipes", icon: "✦" },
  { to: "/pantry", label: "Stock", icon: "◒" },
  { to: "/popular", label: "Popular", icon: "★" },
  { to: "/shopping", label: "Shopping", icon: "✓" },
  { to: "/profile", label: "Profile", icon: "◎" },
];

export default function MobileNav() {
  return <nav className="mobile-nav" aria-label="Main navigation">{navItems.map((item) => <NavLink className={({ isActive }) => isActive ? "mobile-nav-link active" : "mobile-nav-link"} key={item.to} to={item.to}><span aria-hidden="true">{item.icon}</span><span>{item.label}</span></NavLink>)}</nav>;
}
