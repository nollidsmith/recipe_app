import { Component, type ErrorInfo, type ReactNode } from "react";

type Props = { children: ReactNode; onRecover?: () => void };
type State = { hasError: boolean };

export default class AppErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("PantryPilot rendering error", error, info.componentStack);
  }

  recover = () => {
    (this.props.onRecover ?? (() => window.location.reload()))();
  };

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <main className="loading-shell" aria-labelledby="app-error-title">
        <section className="callback-card">
          <div className="loading-mark" aria-hidden="true">PP</div>
          <h1 id="app-error-title">PantryPilot needs a refresh</h1>
          <p className="muted">Something unexpected happened while opening this page. Refresh to try again.</p>
          <button className="button button-primary" type="button" onClick={this.recover}>Refresh PantryPilot</button>
        </section>
      </main>
    );
  }
}
