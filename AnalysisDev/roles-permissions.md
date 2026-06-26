# Rollen en Rechten

Dit document beschrijft de verschillende rollen in het systeem en welke rechten elke rol heeft.

## Rollen Overzicht

Er zijn drie hoofdrollen in het systeem:

1. **Superuser** - Systeembeheerder (er is er normaal gesproken maar 1)
2. **Gebruiker, gekoppeld aan een school** - Een normale actieve gebruiker
3. **Gebruiker, gekoppeld aan een demo school** - Een demo account gebruiker

---

## Superuser

De superuser is de systeembeheerder met volledige rechten over het platform.

### Rechten

- **Scholen beheren**
  - Alle scholen zien
  - Scholen aanmaken
  - Schooljaren aanmaken (dit wordt gedaan na betaling)

- **Gebruikers beheren**
  - Gebruikers koppelen aan een school
  - Gebruikers loskoppelen van een school
  - Gebruikers inactief maken (een inactieve gebruiker blijft in de databank, maar kan niets doen, zelfs niet inloggen)

---

## Gebruiker, gekoppeld aan een school

Een normale actieve gebruiker die is gekoppeld aan een echte school.

### Rechten

- **Eigen account**
  - Inloggen
  - Wachtwoord wijzigen
  - Eigen profiel bekijken en wijzigen

- **Schooldata bekijken**
  - Leerlingenoverzicht van eigen school zien
  - Observaties van leerlingen in eigen school bekijken
  - Observatiedoelen van eigen school zien

- **Observaties beheren**
  - Nieuwe observaties aanmaken voor leerlingen in eigen school
  - Observaties bewerken en verwijderen
  - Observatiedoelen beheren (toevoegen, wijzigen, verwijderen)

- **Rapportages**
  - Rapportages bekijken van observaties
  - Export functionaliteit gebruiken

---

## Gebruiker, gekoppeld aan een demo school

Een demo account gebruiker met beperkte rechten.

### Rechten

- **Eigen account**
  - Inloggen
  - Wachtwoord wijzigen
  - Eigen profiel bekijken en wijzigen

- **Demo school data bekijken**
  - Leerlingenoverzicht van demo school zien (15 leerlingen in 3K)
  - Observaties van leerlingen in demo school bekijken
  - Observatiedoelen van demo school zien (max 5 basisdoelen)

- **Observaties beheren (beperkt)**
  - Nieuwe observaties aanmaken voor leerlingen in demo school
  - Observaties bewerken en verwijderen
  - Max 5 observatiedoelen mogen bestaan
  - Max 20 observaties per doel

- **Beperkingen**
  - Geen export functionaliteit
  - Geen delen functionaliteit
  - Geen toegang tot admin functies
  - Beperkte schoolinstellingen
  - Watermark "DEMO" op alle rapportages
  - Banner op elke pagina: "Dit is een demo account"

---

## Account Registratie Flow

### Standaard registratie
1. Een gebruiker registreert een account
2. De koppeling aan een bestaande school moet bevestigd worden door een andere gebruiker of een superuser
3. Een melding verschijnt op het gebruikersbeheer scherm voor deze bevestiging

### Demo registratie
1. Een gebruiker registreert een account en kiest een demo account
2. Een unieke demo school wordt automatisch aangemaakt voor deze gebruiker
3. De demo school wordt gevuld met voorbeelddata (schooljaar, 3 klassen, 15 leerlingen in 3K, observaties)
4. De gebruiker is direct gekoppeld aan deze demo school

### Conversie van demo naar echte school
1. Een demo gebruiker kan later een echte school kiezen
2. De koppeling moet worden bevestigd door een superuser
3. **Bij bevestiging: de demo school wordt zeker gewist**
4. De gebruiker wordt gekoppeld aan de echte school