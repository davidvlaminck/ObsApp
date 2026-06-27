import { Link } from 'react-router-dom'

export default function DemoPage() {
  return (
    <div className="center-container">
      <div className="card">
        <h1>Demo account</h1>
        <p style={{ marginBottom: '1rem' }}>
          Welkom bij je demo account! Hieronder vind je wat uitleg over de mogelijkheden.
        </p>
        <ul style={{ textAlign: 'left', lineHeight: '1.8' }}>
          <li>Je hebt toegang tot voorbeelddata om de app te ontdekken.</li>
          <li>Je kunt observaties toevoegen en bekijken.</li>
          <li>De demo data is alleen voor testdoeleinden.</li>
        </ul>
        <p style={{ marginTop: '1.5rem', fontSize: '0.9rem', color: '#6b7280' }}>
          Gebruik het menu om te navigeren.
        </p>
        <p style={{ marginTop: '1rem', fontSize: '0.9rem' }}>
          Ga naar <Link to="/home" style={{ color: '#2563eb', textDecoration: 'underline' }}>Home</Link> voor meer uitleg.
        </p>
      </div>
    </div>
  )
}
