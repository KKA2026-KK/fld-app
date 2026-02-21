# Frigjørende Læringsdialogi

Polyvokalt læringsrom for 100+ studenter — basert på Freire, hooks og Bourdieu.

Utviklet av Kris Kalkman · DMMH

## Deploy til Vercel

### Alternativ 1: Direkte fra GitHub (anbefalt)

1. Opprett en GitHub-konto (eller logg inn) på https://github.com
2. Opprett et nytt repository og last opp alle filene i denne mappen
3. Gå til https://vercel.com og logg inn med GitHub
4. Klikk «New Project» → velg ditt repository
5. Vercel oppdager automatisk at det er et Vite-prosjekt
6. Klikk «Deploy»
7. Du får en URL som `frigjoerende-laeringsdialogi.vercel.app`

### Alternativ 2: Vercel CLI

```bash
npm install -g vercel
cd fld-app
npm install
vercel
```

## Bruk i forelesning

1. Åpne appen som **underviser** (velg «Underviser» på oppstartsskjermen)
2. Klikk **⊞-knappen** nederst for å vise QR-kode
3. Vis QR-koden på storskjermen
4. Studentene scanner med mobilkamera → åpner appen i nettleseren
5. Studentene velger «Student» og er inne

## Struktur

```
fld-app/
├── index.html          # Entry point
├── package.json        # Dependencies
├── vite.config.js      # Vite config
└── src/
    ├── main.jsx        # React mount
    └── App.jsx         # Hele appen (single-file)
```

## Teknologi

- React 18
- Vite 5
- Ingen backend — alt kjører i nettleseren
- Anthropic API for AI-generering av spørsmål og innsjekk-utsagn
