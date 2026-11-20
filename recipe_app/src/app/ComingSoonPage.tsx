import { Link } from "react-router-dom";
import AppNav from "../components/AppNav";

export default function ComingSoonPage({ title, description }: { title: string; description: string }) {
  return <main className="coming-soon-shell"><section className="empty-state"><span className="empty-icon">✦</span><p className="eyebrow">PantryPilot</p><h1>{title}</h1><p className="muted">{description}</p><Link className="button button-primary" to="/">Back to recipes</Link></section><AppNav /></main>;
}
