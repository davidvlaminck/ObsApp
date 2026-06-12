import { Link } from 'react-router-dom'

export default function ForbiddenPage() {
  return (
    <div className="center-container">
      <div className="card">
        <div className="avatar">!</div>
        <h1>Geen toegang</h1>
        <p>Alleen superusers kunnen deze pagina bekijken.</p>
        <Link to="/landing" className="btn btn-primary">
          Terug naar dashboard
        </Link>
      </div>
    </div>
  )
}
