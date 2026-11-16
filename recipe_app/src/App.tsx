function App() {
  return (
    <main className="app-shell">
      <section className="app-card" aria-labelledby="app-title">
        <p className="eyebrow">PantryPilot</p>
        <h1 id="app-title">Your recipes, pantry, and next meal in one place.</h1>
        <p className="intro">
          The application foundation is ready. Authentication, recipes, pantry tracking,
          and shopping suggestions will be added in the next sections.
        </p>
        <div className="status-row" aria-label="Foundation status">
          <span className="status-dot" />
          Section 0 scaffold ready
        </div>
      </section>
    </main>
  );
}

export default App;
