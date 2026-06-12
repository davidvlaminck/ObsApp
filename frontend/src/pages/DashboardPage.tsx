export default function DashboardPage() {
  return (
    <section className="page-header">
      <div>
        <h1>Dashboard</h1>
        <p className="text-muted">Overzicht van je ObsApp-werkomgeving.</p>
      </div>
      <div className="stats-grid">
        <article className="stat-card">
          <span>Observaties</span>
          <strong>Binnenkort</strong>
        </article>
        <article className="stat-card">
          <span>School</span>
          <strong>Jouw school</strong>
        </article>
      </div>
    </section>
  )
}
