export default function HomePage() {
  return (
    <div className="home-page">
      <div className="home-header">
        <h1>ObsApp</h1>
        <p className="text-muted">Welkom bij ObsApp - Jouw tool voor observaties bij kleuters.</p>
      </div>
      
      <div style={{ marginTop: '2rem' }}>
        <h2>Hoe gebruik je deze app?</h2>
        
        <div className="home-grid">
          <article className="card home-card">
            <h3>Doel van deze app</h3>
            <p className="text-muted">
              Met deze app kan je kiezen welke doelen je wil observeren bij kleuters.
              Vervolgens kan je in de verschillende overzichten bekijken welke kleuters al geobserveerd zijn en wat hun status is.
            </p>
          </article>

           <article className="card home-card">
            <h3>Observatiedoelen beheren</h3>
            <p className="text-muted">
              Definieer nieuwe observatiedoelen en koppel ze aan Op Stap doelen.
              Deze doelen kun je later gebruiken bij het observeren.
            </p>
            <p style={{ marginTop: '0.5rem' }}>
              <strong>Tip:</strong> De Op Stap doelen zijn gekoppeld aan de minimumdoelen van de Vlaamse Overheid.
              Daarnaast kan je ook schooleigen doelen aanmaken.
            </p>
          </article>

          <article className="card home-card">
            <h3>Thema's en activiteiten</h3>
            <p className="text-muted">
              Definieer thema's en activiteiten die je wil gebruiken in je klas.
              Aan activiteiten koppel je doelen waarvan je kan kiezen of je ze wil observeren.
            </p>
            <p style={{ marginTop: '0.5rem' }}>
              <strong>Tip:</strong> Door doelen aan activiteiten en thema's te kopplen kan je gemakkelijker filteren.
            </p>
          </article>

          <article className="card home-card">
            <h3>Observeren</h3>
            <p className="text-muted">
              Selecteer je klas en bestaande observatiedoelen die je wil observeren.
              Je kan ook in bulk observeren door meerdere kleuters tegelijk te selecteren en hun status aan te passen.
            </p>
            <p style={{ marginTop: '0.5rem' }}>
              <strong>Tip:</strong>Je ziet ook de meest recente observatie van een kleuter bij een doel. Zo kan je snel zien of een kleuter al geobserveerd is.
            </p>
          </article>

          <article className="card home-card">
            <h3>Overzicht per klas</h3>
            <p className="text-muted">
              Bekijk een overzicht van alle observatiedoelen en de huidige status van kleuters.
              Deze pagina toont per observatiedoel welke kleuters al geobserveerd zijn en wat hun status is.
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
            <h3>Overzicht voor doelen</h3>
            <p className="text-muted">
              Bekijk alle gedefinieerde doelen en welke al geobserveerd zijn of in een activiteit zijn opgenomen.
            </p>
            <p style={{ marginTop: '0.5rem' }}>
              <strong>Tip:</strong>Filter op vak, domein of subdomein om een beter overzicht te krijgen.
            </p>
          </article>
          

          

        </div>
      </div>
    </div>
  )
}