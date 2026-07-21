export default function HomePage() {
  return (
    <div className="home-page">
      <div className="home-header">
        <h1>ObsApp</h1>
        <p className="text-muted">Welkom bij ObsApp - Jouw tool voor observaties bij kleuteren.</p>
      </div>
      
      <div style={{ marginTop: '2rem' }}>
        <h2>Hoe gebruik je deze app?</h2>
        
        <div className="home-grid">
          <article className="card home-card">
            <h3>Overzicht</h3>
            <p className="text-muted">
              Bekijk een overzicht van alle observatiedoelen en de huidige status van kleuteren.
              Deze pagina toont per observatiedoel welke kleuteren al geobserveerd zijn en wat hun status is.
            </p>
            <p style={{ marginTop: '0.5rem' }}>
              <strong>Tip:</strong> De klasfilter is standaard ingesteld op jouw eigen klas. 
              Als je toegang hebt tot meerdere klassen, kun je deze filter aanpassen.
            </p>
          </article>
          
          <article className="card home-card">
            <h3>Overzicht per kleuter</h3>
            <p className="text-muted">
              Bekijk alle observaties van één specifieke kleuter. 
              Handig om snel een volledig overzicht te krijgen van de vooruitgang van een kleuter.
            </p>
            <p style={{ marginTop: '0.5rem' }}>
              <strong>Tip:</strong> Selecteer eerst een kleuter om de observaties te zien.
            </p>
          </article>
          
          <article className="card home-card">
            <h3>Observeren</h3>
            <p className="text-muted">
              Maak nieuwe observaties aan voor kleuteren. 
              Kies een klas, vak, domein en observatiedoel om vervolgens de status van elke kleuter in te vullen.
            </p>
            <p style={{ marginTop: '0.5rem' }}>
              <strong>Tip:</strong> De klasfilter is standaard ingesteld op jouw eigen klas.
            </p>
          </article>
          
          <article className="card home-card">
            <h3>Observatiedoelen beheren</h3>
            <p className="text-muted">
              Definieer nieuwe observatiedoelen en koppel ze optioneel aan Op Stap doelen.
              Deze doelen kun je later gebruiken bij het observeren.
            </p>
            <p style={{ marginTop: '0.5rem' }}>
              <strong>Tip:</strong> Geef een duidelijke naam aan je observatiedoel en koppel een Op Stap doel voor betere tracking.
            </p>
          </article>
        </div>
      </div>
    </div>
  )
}