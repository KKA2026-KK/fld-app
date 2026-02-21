import { useState, useEffect, useRef, useCallback } from "react";

// ─── SUPABASE CONFIG ───
// Replace with your Supabase project URL and anon key
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || "";
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_KEY || "";
const ROOM = "fld-room-01";
let supabase = null;

// Dynamic import to avoid build failure if package not installed
const initSupabase = async () => {
  try {
    const { createClient } = await import("@supabase/supabase-js");
    if (SUPABASE_URL && SUPABASE_KEY) {
      supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
    }
  } catch (e) {
    console.log("Supabase not available, running in local mode");
  }
};

const uid = () => Math.random().toString(36).substr(2, 9);
const pick = a => a[Math.floor(Math.random() * a.length)];
const cl = (n, lo, hi) => Math.min(Math.max(n, lo), hi);
const fmt = s => `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, "0")}`;

const PHASES = [
  { id: "ankomst", n: "01", label: "Ankomst", c: "#C06840", desc: "Etablere trygt rom", t: "hooks: Verdsette alle stemmer fra start" },
  { id: "utforskning", n: "02", label: "Utforskning", c: "#4A6090", desc: "Oppdage og undre seg", t: "Freire: Problemposering som utgangspunkt" },
  { id: "dialog", n: "03", label: "Dialog", c: "#5A8060", desc: "Kritisk medskapende samtale", t: "Freire/hooks: Dialog som frigjørende kraft" },
  { id: "refleksjon", n: "04", label: "Refleksjon", c: "#907050", desc: "Integrere innsikter", t: "hooks: Selvrefleksjon → kritisk bevissthet" },
  { id: "handling", n: "05", label: "Handling", c: "#7A4A70", desc: "Fra bevissthet til praxis", t: "Freire: Uten handling er bevissthet tom" },
];

const ACTS = {
  stemmer: { label: "Stemmestrøm", icon: "≋", ph: [1] },
  maktkart: { label: "Maktkartet", icon: "◎", ph: [1] },
  perspektiv: { label: "Perspektivbytte", icon: "⇄", ph: [1] },
  verdilinje: { label: "Verdilinjen", icon: "━", ph: [1] },
  mikrodialog: { label: "Mikro-dialog", icon: "◫", ph: [2] },
  blindsone: { label: "Blindsonejakten", icon: "◐", ph: [2] },
  diamant: { label: "Diamantrangering", icon: "◇", ph: [3] },
  analyse: { label: "Hvem snakker?", icon: "▮", ph: [3] },
  forplikt: { label: "Forpliktelsesmuren", icon: "▪", ph: [4] },
};

// Tematiske sett: problemposerende spørsmål + tilhørende verdilinje-påstand
const THEME_SETS = [
  { prompt: "Hvem har mest makt i et klasserom — og hvordan merkes det?",
    stmt: { text: "En lærer bør alltid være nøytral", l: "Helt uenig", r: "Helt enig" },
    theme: "Makt i rommet" },
  { prompt: "Tenk på en gang du følte deg utenfor i utdanning. Hva skjedde?",
    stmt: { text: "Inkludering betyr at alle skal behandles likt", l: "Helt uenig", r: "Helt enig" },
    theme: "Tilhørighet og ekskludering" },
  { prompt: "Hva gjør noen elever 'synlige' og andre 'usynlige'?",
    stmt: { text: "Noen barn er naturlig mer stille — det må vi respektere", l: "Helt uenig", r: "Helt enig" },
    theme: "Synlighet og stemme" },
  { prompt: "Hvilke 'uskrevne regler' styrer hvem som lykkes?",
    stmt: { text: "Skolesystemet gir alle like muligheter", l: "Helt uenig", r: "Helt enig" },
    theme: "Reproduksjon av ulikhet" },
  { prompt: "Hvem definerer hva som er 'normal' i barnehage og skole?",
    stmt: { text: "Barnehagen bør prioritere norskopplæring fremfor morsmålsstøtte", l: "Helt uenig", r: "Helt enig" },
    theme: "Normalitet og definisjonsmakt" },
  { prompt: "Hvem sin stemme mangler i denne diskusjonen?",
    stmt: { text: "Det er mulig å være 'fargeblind' som pedagog", l: "Umulig", r: "Mulig og ønskelig" },
    theme: "Blindsoner og privilegium" },
  { prompt: "Utfordre din egen første reaksjon — hva tar du for gitt?",
    stmt: { text: "Profesjonell kompetanse er viktigere enn personlig erfaring", l: "Helt uenig", r: "Helt enig" },
    theme: "Habitus og forforståelse" },
  { prompt: "Hvis du byttet posisjon med den mest marginaliserte — hva ser du?",
    stmt: { text: "Å snakke om rasisme i Norge er å importere amerikanske problemer", l: "Helt uenig", r: "Helt enig" },
    theme: "Marginalisering og perspektiv" },
  { prompt: "Hva ville Freire sagt om denne situasjonen?",
    stmt: { text: "Undervisning kan aldri være politisk nøytral", l: "Helt uenig", r: "Helt enig" },
    theme: "Pedagogikk og politikk" },
  { prompt: "Hvem betaler prisen for 'harmoni' i klasserommet?",
    stmt: { text: "Konflikter i klasserommet bør unngås så langt det er mulig", l: "Helt uenig", r: "Helt enig" },
    theme: "Harmoni og makt" },
];
const PROMPTS = THEME_SETS.map(s => s.prompt);

const makeThemePrompt = (topic) => `Du er ekspert på kritisk pedagogikk (Freire, hooks, Bourdieu) og skal lage tematiske sett for et digitalt læringsverktøy brukt i norsk høyere utdanning (pedagogikk, spesialpedagogikk, rådgivning, barneforskning).

TEMA: "${topic}"

Lag 5 tematiske sett. Hvert sett har to deler som MÅ henge sammen tematisk:

1. SPØRSMÅL (prompt): Et problemposerende spørsmål i Freires tradisjon.
   - Skal avdekke maktstrukturer, usynlige normer eller tatt-for-gitte antakelser
   - Skal være åpent (ikke ja/nei) og personlig engasjerende
   - Skal få 100+ studenter til å tenke "dette angår meg"
   - Maks 15 ord. Bruk hverdagsspråk, ikke akademisk sjargong.

2. PÅSTAND (stmt): En kontroversiell påstand for verdilinje-øvelse.
   - MÅ handle om SAMME tema som spørsmålet
   - Skal splitte rommet — ca. halvparten enig, halvparten uenig
   - Skal høres rimelig ut på overflaten men skjule en maktstruktur
   - Formuleringen skal provosere til refleksjon, ikke fornærme
   - Maks 12 ord.

EKSEMPLER PÅ GODE SETT (for temaet "makt i klasserommet"):
{"prompt":"Hvem har mest makt i et klasserom — og hvordan merkes det?","stmt":"En lærer bør alltid være nøytral","theme":"Makt i rommet","l":"Helt uenig","r":"Helt enig"}
{"prompt":"Hvem betaler prisen for harmoni i klasserommet?","stmt":"Konflikter bør unngås så langt det er mulig","theme":"Harmoni og makt","l":"Helt uenig","r":"Helt enig"}

EKSEMPLER PÅ DÅRLIGE SETT (UNNGÅ):
- Spørsmål: "Hva tenker du om ${topic}?" (for vagt, ingen maktanalyse)
- Påstand: "Alle bør ha like rettigheter" (ingen er uenig, splitter ikke rommet)
- Påstand: "${topic} er viktig" (tautologi, ingen spenning)
- Spørsmål og påstand som handler om ulike ting

Svar KUN med en JSON-array av 5 objekter. Ingen annen tekst. Format:
[{"prompt":"...","stmt":"...","theme":"...","l":"Helt uenig","r":"Helt enig"}]`;

const DIALOG_PROMPTS = [
  { q: "Hvem har mest makt i rommet vi sitter i akkurat nå?", src: "Bourdieu" },
  { q: "Fortell om en gang du følte at systemet ikke var laget for deg.", src: "hooks" },
  { q: "Hva er det farligste du kan si i et klasserom? Hvorfor?", src: "Freire" },
  { q: "Hva tar du for gitt om 'god' utdanning?", src: "Bourdieu: Kulturell kapital" },
  { q: "Hva er forskjellen mellom å 'inkludere' og å 'endre rommet'?", src: "hooks" },
  { q: "Hvem betaler prisen for 'harmoni' i barnehagen/skolen?", src: "Kritisk pedagogikk" },
];

const BLIND_Q = ["Hvem har vi IKKE snakket om?", "Hvilket spørsmål har vi UNNGÅTT å stille?", "Hva ser du IKKE på grunn av hvem du er?"];

const DIAMANT = {
  "Inkludering i barnehagen": ["Morsmålsstøtte", "Lekebasert læring", "Foreldresamarbeid", "Antirasistisk praksis", "Norskopplæring", "Fleksible rutiner", "Personalets holdninger", "Fysisk miljø", "Barns medvirkning"],
  "Profesjonsetikk": ["Taushetsplikt", "Barnets beste", "Likeverd", "Kritisk refleksjon", "Kollegial lojalitet", "Varsling", "Kulturell ydmykhet", "Maktbevissthet", "Mot"],
};

const ROLES = [
  { role: "Nyankommet flyktningforelder", desc: "Forstår ikke systemet, vil det beste for barnet", c: "#C06840", e: "🌍" },
  { role: "Erfaren assistent", desc: "15 år i yrket. Vet hva som fungerer — tror du", c: "#4A6090", e: "🤝" },
  { role: "Pedagogisk leder", desc: "Vil inkludere alle, kjenner press fra alle kanter", c: "#5A8060", e: "👩‍🏫" },
  { role: "Barnet (5 år)", desc: "Forstår mer enn de voksne tror", c: "#907050", e: "🧒" },
  { role: "Kommunal rådgiver", desc: "Ser tallene og budsjettene. Ikke enkeltbarn", c: "#7A4A70", e: "🏛️" },
  { role: "Nyutdannet bh-lærer", desc: "Har lest teorien. Virkeligheten er annerledes", c: "#5A8A7A", e: "🎓" },
  { role: "Besteforelder", desc: "Ser endringer over generasjoner. Bekymret og stolt", c: "#8A6A40", e: "👵" },
  { role: "Barnevernspedagog", desc: "Ser det ingen andre ser. Bærer taushetsplikten tungt", c: "#6A5A8A", e: "🔍" },
  { role: "Politiker", desc: "Vil vise handlekraft. Trenger tall og resultater", c: "#8A5050", e: "🗳️" },
  { role: "Flerspråklig barn (8 år)", desc: "Snakker tre språk men blir vurdert på ett", c: "#4A7A7A", e: "💬" },
];

const ACTOR_SETS = {
  "Utdanning og oppvekst": [
    { id: "la", name: "Læreren", e: "👩‍🏫" }, { id: "el", name: "Eleven", e: "🧑‍🎓" },
    { id: "fo", name: "Foresatte", e: "👨‍👩‍👧" }, { id: "re", name: "Rektor", e: "👔" },
    { id: "pp", name: "PP-tjenesten", e: "🔍" }, { id: "bv", name: "Barnevernet", e: "🛡️" },
    { id: "ko", name: "Skoleeier (kommunen)", e: "🏛️" }, { id: "hs", name: "Helsesykepleier", e: "🏥" },
    { id: "na", name: "NAV", e: "📋" }, { id: "po", name: "Politikere", e: "🗳️" },
  ],
  "Barndom og barnehage": [
    { id: "ba", name: "Barnet", e: "🧒" }, { id: "bl", name: "Barnehagelærer", e: "👩‍🏫" },
    { id: "fo", name: "Foreldre", e: "👨‍👩‍👧" }, { id: "as", name: "Assistenten", e: "🤝" },
    { id: "bv", name: "Barnevernet", e: "🛡️" }, { id: "pp", name: "PPT", e: "🔍" },
    { id: "ko", name: "Kommunen", e: "🏛️" }, { id: "he", name: "Helsestasjon", e: "🏥" },
    { id: "st", name: "Styreren", e: "👔" }, { id: "me", name: "Mediene", e: "📰" },
  ],
  "Rådgivning og veiledning": [
    { id: "ra", name: "Rådgiveren", e: "🗣️" }, { id: "kl", name: "Klienten/eleven", e: "🧑" },
    { id: "fo", name: "Foresatte", e: "👨‍👩‍👧" }, { id: "ag", name: "Arbeidsgiver", e: "🏢" },
    { id: "na", name: "NAV", e: "📋" }, { id: "pp", name: "PP-tjenesten", e: "🔍" },
    { id: "lp", name: "Lege/psykolog", e: "⚕️" }, { id: "sl", name: "Skoleledelsen", e: "👔" },
    { id: "bv", name: "Barnevernet", e: "🛡️" }, { id: "fs", name: "Forsikringsselskap", e: "📊" },
  ],
  "Arbeidsliv og voksnes læring": [
    { id: "at", name: "Arbeidstakeren", e: "👷" }, { id: "ag", name: "Arbeidsgiveren", e: "🏢" },
    { id: "tv", name: "Tillitsvalgt", e: "✊" }, { id: "hr", name: "HR-avdelingen", e: "📁" },
    { id: "na", name: "NAV", e: "📋" }, { id: "ff", name: "Fagforeningen", e: "🤝" },
    { id: "ui", name: "Utdanningsinstitusjon", e: "🎓" }, { id: "ku", name: "Kursarrangør", e: "📖" },
    { id: "po", name: "Politikere", e: "🗳️" }, { id: "fa", name: "Familie", e: "🏠" },
  ],
};
const ACTOR_SET_NAMES = Object.keys(ACTOR_SETS);
const MC = ["#C06840", "#4A6090", "#5A8060", "#907050", "#7A4A70", "#5A8A7A", "#8A6A40", "#6A5A8A", "#8A5050", "#4A7A7A"];
// Dynamic simulation positions per actor (generated based on index)
const simPos = (idx) => {
  const positions = [
    { cx: 65, cy: 60, s: 15 }, { cx: 40, cy: 45, s: 20 }, { cx: 30, cy: 20, s: 18 },
    { cx: 55, cy: 75, s: 12 }, { cx: 50, cy: 80, s: 10 }, { cx: 35, cy: 30, s: 15 },
    { cx: 55, cy: 65, s: 12 }, { cx: 75, cy: 50, s: 18 }, { cx: 35, cy: 55, s: 14 },
    { cx: 70, cy: 70, s: 16 },
  ];
  return positions[idx % positions.length];
};

const TAGS = ["makt", "habitus", "kulturell kapital", "banking model", "dialog", "conscientização", "interseksjonalitet", "marginalisering", "stemme", "andregjøring", "tilhørighet", "rasialisering", "klasse", "praxis", "frigjøring", "definisjonsmakt", "normalisering", "modige rom", "reproduksjon", "hegemoni", "avmakt"];
const CHOOSABLE_TAGS = ["makt", "habitus", "kulturell kapital", "dialog", "interseksjonalitet", "marginalisering", "tilhørighet", "klasse", "frigjøring", "definisjonsmakt", "modige rom", "reproduksjon", "avmakt", "personlig erfaring", "systemkritikk", "endring"];
const REACTIONS = [
  { key: "utfordrer", label: "Utfordrer meg", icon: "⚡" },
  { key: "gjenkjennelig", label: "Gjenkjennelig", icon: "◉" },
  { key: "vilhoremer", label: "Vil høre mer", icon: "→" },
];
const xTags = t => { const lo = t.toLowerCase(); return TAGS.filter(x => lo.includes(x)).slice(0, 3); };
const DEFAULT_CHECKINS = [
  { text: "Jeg er klar til å bli utfordret i dag", icon: "⚡", cat: "beredskap" },
  { text: "Jeg holder meg vanligvis stille i slike rom", icon: "◌", cat: "habitus" },
  { text: "Jeg føler meg hjemme i et klasserom", icon: "⌂", cat: "privilegium" },
  { text: "Jeg er villig til å tåle ubehag", icon: "◇", cat: "mot" },
  { text: "Jeg tror min stemme har betydning her", icon: "◉", cat: "verdi" },
  { text: "Jeg vil lytte mer enn jeg snakker", icon: "◠", cat: "kontrakt" },
  { text: "Jeg bærer med meg noe som sjelden blir snakket om", icon: "▪", cat: "usynlig" },
  { text: "Jeg vet ikke helt hva jeg føler ennå — og det er greit", icon: "~", cat: "usikkerhet" },
];

const ALT_CHECKINS = [
  [
    { text: "Jeg merker at kroppen min er spent i dette rommet", icon: "⊕", cat: "kroppsbevissthet" },
    { text: "Jeg har noe å si men vet ikke om det er 'riktig'", icon: "◌", cat: "selvsensur" },
    { text: "Jeg er vant til å bli hørt når jeg snakker", icon: "⌂", cat: "privilegium" },
    { text: "Jeg velger i dag å sitte med ubehaget", icon: "◇", cat: "mot" },
    { text: "Jeg lurer på hvem som ikke er her i dag", icon: "◉", cat: "synlighet" },
    { text: "Jeg vil forstå før jeg mener noe", icon: "◠", cat: "lytting" },
    { text: "Jeg kjenner meg igjen i det som aldri sies høyt", icon: "▪", cat: "usynlighet" },
    { text: "Jeg er her — det er nok for nå", icon: "~", cat: "tilstedeværelse" },
  ],
  [
    { text: "Jeg er forberedt på å endre mening i dag", icon: "⚡", cat: "åpenhet" },
    { text: "Jeg snakker sjelden i store grupper", icon: "◌", cat: "habitus" },
    { text: "Jeg har aldri trengt å forklare hvem jeg er", icon: "⌂", cat: "privilegium" },
    { text: "Jeg tåler å bli korrigert", icon: "◇", cat: "sårbarhet" },
    { text: "Jeg tviler på om stemmen min betyr noe her", icon: "◉", cat: "stemme" },
    { text: "Jeg vil lytte til den som er mest ulik meg", icon: "◠", cat: "lytting" },
    { text: "Jeg har erfaringer dette rommet ikke har språk for", icon: "▪", cat: "usynlighet" },
    { text: "Jeg vet ikke hva jeg føler ennå — og det er greit", icon: "~", cat: "usikkerhet" },
  ],
  [
    { text: "Jeg tør å stille dumme spørsmål i dag", icon: "⚡", cat: "mot" },
    { text: "Jeg observerer vanligvis mer enn jeg deltar", icon: "◌", cat: "habitus" },
    { text: "Jeg kjenner meg trygg i akademiske rom", icon: "⌂", cat: "kapital" },
    { text: "Jeg er villig til å gi slipp på det jeg tror jeg vet", icon: "◇", cat: "avlæring" },
    { text: "Jeg lurer på hvem som former dette faget", icon: "◉", cat: "definisjonsmakt" },
    { text: "Jeg vil snakke mindre og lytte mer i dag", icon: "◠", cat: "lyttekontrakt" },
    { text: "Jeg bærer på noe tungt som hører hjemme i dette faget", icon: "▪", cat: "erfaring" },
    { text: "Jeg har mer spørsmål enn svar akkurat nå", icon: "~", cat: "undring" },
  ],
];
let altIdx = 0;

const SIM = [
  "Læreren har mest makt, men det er usynlig fordi vi normaliserer det",
  "Karaktersystemet sorterer oss i hierarkier ingen snakker om",
  "De som kjenner kodene fra hjemme slipper lettest til",
  "Språk er makt — de som formulerer seg akademisk vinner alltid",
  "Taushet i klasserommet er ikke samtykke, det er avmakt",
  "Habitus avgjør hvem som tør å rekke opp hånda",
  "Middelklassens verdier er usynlig pensum",
  "Inkludering handler om å endre rommet, ikke invitere inn",
  "Frigjøring starter med å se strukturene",
  "Definisjonsmakten er hos den som aldri trenger forklare seg",
  "Conscientização: min erfaring er politisk",
  "Det farligste i et klasserom er illusjonen om nøytralitet",
  "Reproduksjon av ulikhet skjer i det stille",
  "Modige rom krever at underviseren selv er sårbar",
  "Rasialisering skjer også gjennom velmenende handlinger",
  "Hvem bestemmer kvalitet? Aldri barna selv",
  "Praxis uten teori er blind. Teori uten praxis er tom",
  "Andregjøring starter med blikket — lenge før ordene",
  "Vi er alle posisjonert. Spørsmålet er om vi ser det",
  "Banking-modellen lever i digitale læringsplattformer",
];

const PCOL = ["Blå", "Rød", "Grønn", "Gul", "Lilla", "Oransje"];
const PEMO = ["🔵", "🔴", "🟢", "🟡", "🟣", "🟠"];
const SIM_CHAT = [
  "Jeg tror den stille makten er verst — den som aldri trenger forklare seg",
  "Når jeg tenker på min skoletid, ser jeg at lærerne favoriserte de som lignet dem",
  "Det er lett å snakke om inkludering, men vanskelig å gi fra seg makt",
  "Habitus er ikke bare teori. Jeg kjente det da jeg startet på universitetet",
  "Anonymiteten her gjør at jeg tør si ting jeg aldri ville sagt i plenum",
  "Nøytralitet er en luksus for de som aldri rammes av systemet",
];

function QROverlay({ onClose }) {
  const base = typeof window !== "undefined" ? window.location.origin + window.location.pathname : "";
  const studentUrl = base + "?role=student";
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=280x280&data=${encodeURIComponent(studentUrl)}&bgcolor=08080A&color=E8E4DE&format=svg`;
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(8,8,10,.97)", zIndex: 400, display: "flex", alignItems: "center", justifyContent: "center" }} onClick={onClose}>
      <div onClick={e => e.stopPropagation()} style={{ textAlign: "center", maxWidth: "400px", padding: "40px" }}>
        <div style={{ fontSize: "10px", letterSpacing: "4px", color: "#5A5650", textTransform: "uppercase", marginBottom: "20px" }}>Scan for å bli med</div>
        <div style={{ background: "#E8E4DE", borderRadius: "16px", padding: "20px", display: "inline-block", marginBottom: "20px" }}>
          <img src={qrUrl} alt="QR-kode" style={{ width: "240px", height: "240px", display: "block" }} />
        </div>
        <p style={{ fontSize: "13px", color: "#9A958E", marginBottom: "6px", wordBreak: "break-all", fontFamily: "monospace" }}>{studentUrl}</p>
        <p style={{ fontSize: "11px", color: "#5A5650", marginBottom: "20px" }}>Studentene scanner QR-koden og kommer rett inn som student.</p>
        <button onClick={onClose} style={{ background: "transparent", border: "1px solid #1C1C20", color: "#5A5650", padding: "8px 24px", fontSize: "11px", cursor: "pointer", fontFamily: "'Georgia',serif" }}>Lukk</button>
      </div>
    </div>
  );
}

function TagCloud({ voices, c }) {
  const f = {}; voices.forEach(v => (v.tags || []).forEach(t => { f[t] = (f[t] || 0) + 1 }));
  const s = Object.entries(f).sort((a, b) => b[1] - a[1]);
  if (!s.length) return null;
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: "5px" }}>
      {s.slice(0, 16).map(([tag, n]) => (
        <span key={tag} style={{ padding: "2px 8px", border: `1px solid ${c}${cl(n * 12 + 20, 20, 70)}`, color: c, fontSize: `${cl(9 + n, 9, 15)}px`, opacity: cl(.3 + n * .1, .3, 1) }}>{tag}</span>
      ))}
    </div>
  );
}

function TutorialOverlay({ onClose }) {
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(8,8,10,.97)", zIndex: 300, overflowY: "auto", display: "flex", justifyContent: "center" }}>
      <div style={{ maxWidth: "680px", padding: "40px 24px", color: "#E8E4DE", fontFamily: "'Georgia',serif" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "32px" }}>
          <h2 style={{ fontSize: "24px", fontWeight: 400, margin: 0 }}>📖 Slik bruker du appen</h2>
          <button onClick={onClose} style={{ background: "transparent", border: "1px solid #1C1C20", color: "#5A5650", padding: "6px 16px", fontSize: "11px", cursor: "pointer", fontFamily: "'Georgia',serif" }}>Lukk ✕</button>
        </div>
        <div style={{ background: "#0E0E10", border: "1px solid #1C1C20", borderLeft: "3px solid #C06840", padding: "20px", marginBottom: "20px" }}>
          <h3 style={{ fontSize: "16px", fontWeight: 400, color: "#C06840", marginBottom: "8px" }}>For undervisere — hurtigstart</h3>
          <p style={{ fontSize: "13px", color: "#9A958E", lineHeight: 1.8, margin: 0 }}>
            1. Trykk «Start som underviser» → storskjerm-modus med kontrollpanel.<br/>
            2. Del lenken med studentene — de trykker «Bli med som student».<br/>
            3. Bruk kontrollpanelet til å styre <strong style={{ color: "#E8E4DE" }}>fase</strong>, <strong style={{ color: "#E8E4DE" }}>aktivitet</strong> og <strong style={{ color: "#E8E4DE" }}>spørsmål</strong>.<br/>
            4. Projekter storskjermen i auditoriet. Studentene bruker mobilen.
          </p>
        </div>
        <h3 style={{ fontSize: "15px", fontWeight: 400, marginBottom: "12px" }}>De fem fasene</h3>
        {[
          { n: "01", l: "Ankomst", c: "#C06840", d: "Stemningsinnsjekk. Ingen ser individuelle svar — bare det kollektive bildet. Etablerer hooks' prinsipp om trygt rom." },
          { n: "02", l: "Utforskning", c: "#4A6090", d: "Studentene utforsker temaet individuelt: Stemmestrøm (anonyme bidrag + ordsky) · Maktkartet (plasser aktører på makt/synlighet-akser) · Perspektivbytte (tildelt rolle, argumenter derfra) · Verdilinjen (kontroversielle påstander, live histogram)." },
          { n: "03", l: "Dialog", c: "#5A8060", d: "Studentene pares 1:1 med noen de ikke har jobbet med. Mikro-dialog: 🤝 Fysisk (finn partner i rommet, del funn) eller 💬 Stille (anonym chat, ideelt i auditorier). Blindsonejakten: «Hvem har vi IKKE snakket om?»" },
          { n: "04", l: "Refleksjon", c: "#907050", d: "Diamantrangering (velg 9 begreper, ranger i 1-2-3-2-1 diamantform — avslører verdier og blindsoner). Hvem snakker? (deltagelsesanalyse med Bourdieu-sitat)." },
          { n: "05", l: "Handling", c: "#7A4A70", d: "Forpliktelsesmuren: Alle formulerer én konkret handling de forplikter seg til. Freire: Praxis = refleksjon + handling i samspill." },
        ].map(ph => (
          <div key={ph.n} style={{ background: "#0E0E10", border: "1px solid #1C1C20", padding: "14px", marginBottom: "8px" }}>
            <div style={{ display: "flex", alignItems: "baseline", gap: "8px", marginBottom: "4px" }}>
              <span style={{ fontSize: "18px", fontWeight: 300, color: ph.c, opacity: .5 }}>{ph.n}</span>
              <span style={{ fontSize: "14px", color: "#E8E4DE" }}>{ph.l}</span>
            </div>
            <p style={{ fontSize: "12px", color: "#9A958E", lineHeight: 1.7, margin: 0 }}>{ph.d}</p>
          </div>
        ))}
        <div style={{ background: "#0E0E10", border: "1px solid #1C1C20", borderLeft: "3px solid #4A6090", padding: "16px", marginTop: "16px" }}>
          <h3 style={{ fontSize: "14px", fontWeight: 400, color: "#4A6090", marginBottom: "6px" }}>Tips for undervisere</h3>
          <p style={{ fontSize: "12px", color: "#9A958E", lineHeight: 1.8, margin: 0 }}>
            • Pek på mønstre i storskjermen: «Se — 'makt' dominerer ordskyen. Hvem brukte 'tilhørighet'?»<br/>
            • ⚡ i Maktkartet betyr stor uenighet → bruk det som diskusjonsgrunnlag<br/>
            • Start Mikro-dialog med stille modus (tryggest) → deretter fysisk<br/>
            • Rediger spørsmål og generer nye med AI via «✎ Rediger spørsmål» i spørsmålslinjen<br/>
            • Avslutt alltid med Handling — conscientização uten praxis er tom
          </p>
        </div>
        <div style={{ background: "#0E0E10", border: "1px solid #1C1C20", padding: "14px", marginTop: "10px" }}>
          <h3 style={{ fontSize: "13px", fontWeight: 400, marginBottom: "6px" }}>Teoretisk forankring</h3>
          <p style={{ fontSize: "11px", color: "#7A756F", lineHeight: 1.7, margin: 0 }}>Freires problemposering og praxis · hooks' engaged pedagogy og modige rom · Bourdieus feltteori og habitus · Biggs' constructive alignment · Abegglen et al. (2025) digital frigjørende pedagogikk</p>
        </div>
        <button onClick={onClose} style={{ display: "block", margin: "20px auto", background: "#C06840", border: "none", color: "#E8E4DE", padding: "12px 32px", fontSize: "12px", cursor: "pointer", fontFamily: "'Georgia',serif" }}>Lukk</button>
      </div>
    </div>
  );
}

export default function App() {
  const [unlocked, setUnlocked] = useState(false);
  const [pinInput, setPinInput] = useState("");
  const [pinError, setPinError] = useState(false);
  const APP_PIN = "2026";

  // Auto-detect ?role=student from QR code
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("role") === "student") {
      setMode("student");
      // Remove param from URL silently
      window.history.replaceState({}, "", window.location.pathname);
    }
  }, []);
  const [autoStudent] = useState(() => {
    if (typeof window !== "undefined") {
      return new URLSearchParams(window.location.search).get("role") === "student";
    }
    return false;
  });

  const [phase, setPhase] = useState(-1);
  const [mode, setMode] = useState("student");
  const [act, setAct] = useState("stemmer");
  const [pi, setPi] = useState(0);
  const [voices, setVoices] = useState([]);
  const [studs, setStuds] = useState(0);
  const [checkins, setCheckins] = useState(DEFAULT_CHECKINS);
  const [checkinCounts, setCheckinCounts] = useState({});
  const [myCheckins, setMyCheckins] = useState([]);
  const [checkedIn, setCheckedIn] = useState(false);
  const [ciGenerating, setCiGenerating] = useState(false);
  const [showThemePicker, setShowThemePicker] = useState(false);
  const [inp, setInp] = useState("");
  const [actorSet, setActorSet] = useState("Barndom og barnehage");
  const MA = ACTOR_SETS[actorSet] || ACTOR_SETS[ACTOR_SET_NAMES[0]];
  const [hoveredActor, setHoveredActor] = useState(null);
  const [mapMode, setMapMode] = useState("intro");
  const [mapAi, setMapAi] = useState(0);
  const [mapPl, setMapPl] = useState({});
  const [mapDots, setMapDots] = useState([]);
  const mapRef = useRef(null);
  const [vsi, setVsi] = useState(0);
  const [vVotes, setVVotes] = useState([]);
  const [vVoted, setVVoted] = useState(false);
  const [vRange, setVRange] = useState(50);
  const [pRole, setPRole] = useState(null);
  const [pInp, setPInp] = useState("");
  const [persp, setPersp] = useState([]);
  const [mdScreen, setMdScreen] = useState("lobby");
  const [mdRound, setMdRound] = useState(0);
  const [mdType, setMdType] = useState("fysisk");
  const [mdTimer, setMdTimer] = useState(300);
  const [mdTA, setMdTA] = useState(false);
  const [mdPartner, setMdPartner] = useState(null);
  const [mdFound, setMdFound] = useState(false);
  const [mdInsight, setMdInsight] = useState("");
  const [mdInsights, setMdInsights] = useState([]);
  const [mdChat, setMdChat] = useState([]);
  const [mdCI, setMdCI] = useState("");
  const [partnerTyping, setPartnerTyping] = useState(false);
  const [mdDpi, setMdDpi] = useState(0);
  const chatEnd = useRef(null);
  const [bIdx, setBIdx] = useState(0);
  const [blinds, setBlinds] = useState([]);
  const [bInp, setBInp] = useState("");
  const [dTopic, setDTopic] = useState(Object.keys(DIAMANT)[0]);
  const [dRank, setDRank] = useState([]);
  const [dDone, setDDone] = useState(false);
  const [commits, setCommits] = useState([]);
  const [cInp, setCInp] = useState("");
  const [showTutorial, setShowTutorial] = useState(false);
  const [showQR, setShowQR] = useState(false);
  const [showSetup, setShowSetup] = useState(false);
  const [presetName, setPresetName] = useState("");
  const [showPromptEditor, setShowPromptEditor] = useState(false);
  const [customThemes, setCustomThemes] = useState([...THEME_SETS]);
  const [newPrompt, setNewPrompt] = useState("");
  const [newStmt, setNewStmt] = useState("");
  const [aiGenerating, setAiGenerating] = useState(false);
  const [aiTopic, setAiTopic] = useState("");
  const [selTags, setSelTags] = useState([]);
  const [reactions, setReactions] = useState({});
  const [customRoles, setCustomRoles] = useState([]);
  const [newRoleName, setNewRoleName] = useState("");
  const [newRoleDesc, setNewRoleDesc] = useState("");

  const isT = mode === "teacher";
  const P = phase >= 0 ? PHASES[phase] : null;
  const avail = phase >= 0 ? Object.entries(ACTS).filter(([_, a]) => a.ph.includes(phase)) : [];
  const channelRef = useRef(null);
  const [rtConnected, setRtConnected] = useState(false);
  const myId = useRef(uid());

  // ─── SUPABASE REALTIME CHANNEL ───
  useEffect(() => {
    if (!unlocked) return;
    let channel = null;
    const setup = async () => {
      await initSupabase();
      if (!supabase) { console.log("No Supabase — running locally"); return; }
      channel = supabase.channel(ROOM, {
        config: { broadcast: { self: true } },
      });

    channel.on("broadcast", { event: "state" }, ({ payload }) => {
      // Teacher broadcasts state → students follow
      if (payload.from === myId.current) return;
      if (payload.phase !== undefined) setPhase(payload.phase);
      if (payload.act) setAct(payload.act);
      if (payload.pi !== undefined) setPi(payload.pi);
      if (payload.actorSet) setActorSet(payload.actorSet);
      if (payload.customThemes) setCustomThemes(payload.customThemes);
      if (payload.checkins) setCheckins(payload.checkins);
    });

    channel.on("broadcast", { event: "join" }, () => {
      setStuds(p => p + 1);
    });

    channel.on("broadcast", { event: "checkin" }, ({ payload }) => {
      if (payload.from === myId.current) return;
      payload.items.forEach(text => {
        setCheckinCounts(p => ({ ...p, [text]: (p[text] || 0) + 1 }));
      });
    });

    channel.on("broadcast", { event: "voice" }, ({ payload }) => {
      if (payload.from === myId.current) return;
      setVoices(p => [{ id: payload.id, text: payload.text, tags: payload.tags, ts: payload.ts, own: false, rx: {} }, ...p].slice(0, 150));
    });

    channel.on("broadcast", { event: "reaction" }, ({ payload }) => {
      if (payload.from === myId.current) return;
      setVoices(p => p.map(v => v.id === payload.voiceId ? { ...v, rx: { ...v.rx, [payload.rKey]: (v.rx?.[payload.rKey] || 0) + 1 } } : v));
    });

    channel.on("broadcast", { event: "mapdot" }, ({ payload }) => {
      if (payload.from === myId.current) return;
      setMapDots(p => [...p, { id: payload.id, aid: payload.aid, x: payload.x, y: payload.y, own: false }].slice(-300));
    });

    channel.on("broadcast", { event: "vvote" }, ({ payload }) => {
      if (payload.from === myId.current) return;
      setVVotes(p => [...p, { id: payload.id, v: payload.v, si: payload.si }].slice(-200));
    });

    channel.on("broadcast", { event: "persp" }, ({ payload }) => {
      if (payload.from === myId.current) return;
      setPersp(p => [{ id: payload.id, role: payload.role, c: payload.c, e: payload.e, text: payload.text, ts: payload.ts }, ...p].slice(0, 20));
    });

    channel.on("broadcast", { event: "blind" }, ({ payload }) => {
      if (payload.from === myId.current) return;
      setBlinds(p => [{ id: payload.id, text: payload.text, ts: payload.ts }, ...p].slice(0, 40));
    });

    channel.on("broadcast", { event: "commit" }, ({ payload }) => {
      if (payload.from === myId.current) return;
      setCommits(p => [{ id: payload.id, text: payload.text, ts: payload.ts }, ...p].slice(0, 50));
    });

    channel.on("broadcast", { event: "newrole" }, ({ payload }) => {
      if (payload.from === myId.current) return;
      setCustomRoles(p => [...p, { role: payload.role, e: payload.e, c: payload.c }]);
    });

    channel.on("broadcast", { event: "insight" }, ({ payload }) => {
      if (payload.from === myId.current) return;
      setMdInsights(p => [{ id: payload.id, text: payload.text }, ...p].slice(0, 30));
    });

    channel.subscribe((status) => {
      if (status === "SUBSCRIBED") {
        setRtConnected(true);
        // Students announce presence
        if (mode === "student") {
          channel.send({ type: "broadcast", event: "join", payload: { from: myId.current } });
        }
      }
    });

    channelRef.current = channel;
    }; // end setup()
    setup();
    return () => { if (channelRef.current && supabase) supabase.removeChannel(channelRef.current); };
  }, [unlocked]);

  // Teacher broadcasts state changes
  const broadcastState = useCallback((overrides = {}) => {
    if (!channelRef.current || !isT) return;
    channelRef.current.send({
      type: "broadcast", event: "state",
      payload: { from: myId.current, phase, act, pi, actorSet, customThemes, checkins, ...overrides },
    });
  }, [phase, act, pi, actorSet, customThemes, checkins, isT]);

  // Auto-broadcast when teacher changes phase/act/pi
  useEffect(() => { if (isT && channelRef.current && phase >= 0) broadcastState(); }, [phase, act, pi, actorSet]);

  // Broadcast helper for student actions
  const bc = useCallback((event, payload) => {
    if (!channelRef.current) return;
    channelRef.current.send({ type: "broadcast", event, payload: { from: myId.current, ...payload } });
  }, []);

  // Mikro-dialog timer (local)
  useEffect(() => { if (!mdTA || mdTimer <= 0) return; const iv = setInterval(() => setMdTimer(p => { if (p <= 1) { setMdTA(false); return 0; } return p - 1; }), 1000); return () => clearInterval(iv); }, [mdTA, mdTimer]);
  // Chat simulation for stille dialog (stays local — would need pairing server for real)
  useEffect(() => { if (mdScreen !== "stille" || mdTimer <= 0) return; let to; const cycle = () => { const delay = 5000 + Math.random() * 6000; to = setTimeout(() => { setPartnerTyping(true); const typeTime = 1500 + Math.random() * 2500; setTimeout(() => { setPartnerTyping(false); setMdChat(p => [...p, { id: uid(), text: pick(SIM_CHAT), from: "partner" }]); cycle(); }, typeTime); }, delay); }; cycle(); return () => { clearTimeout(to); setPartnerTyping(false); }; }, [mdScreen, mdTimer]);
  useEffect(() => { chatEnd.current?.scrollIntoView({ behavior: "smooth" }); }, [mdChat]);
  useEffect(() => { if (phase >= 0 && avail.length && !avail.find(([k]) => k === act)) setAct(avail[0][0]); }, [phase]);

  const addVoice = () => { if (!inp.trim()) return; const autoTags = xTags(inp); const allTags = [...new Set([...selTags, ...autoTags])]; const v = { id: uid(), text: inp, tags: allTags, ts: Date.now(), own: true, rx: {} }; setVoices(p => [v, ...p].slice(0, 150)); bc("voice", { id: v.id, text: v.text, tags: v.tags, ts: v.ts }); setInp(""); setSelTags([]); };
  const reactTo = (voiceId, rKey) => { setReactions(p => { const cur = { ...p }; if (!cur[voiceId]) cur[voiceId] = {}; cur[voiceId][rKey] = (cur[voiceId][rKey] || 0) + 1; return cur; }); setVoices(p => p.map(v => v.id === voiceId ? { ...v, rx: { ...v.rx, [rKey]: (v.rx?.[rKey] || 0) + 1 } } : v)); bc("reaction", { voiceId, rKey }); };
  const startMd = (type) => { setMdType(type); setMdRound(p => p + 1); setMdDpi(p => p + 1); setMdTimer(300); setMdInsight(""); setMdChat([]); setMdFound(false); if (type === "fysisk") { const ci = Math.floor(Math.random() * PCOL.length); setMdPartner({ color: PCOL[ci], emoji: PEMO[ci], num: Math.floor(Math.random() * 50) + 1 }); setMdScreen("fysisk"); setMdTA(false); } else { setMdPartner(null); setMdScreen("stille"); setMdTA(true); } };

  const curDPrompt = DIALOG_PROMPTS[mdDpi % DIALOG_PROMPTS.length];
  const mapAgg = {}; MA.forEach(a => { mapAgg[a.id] = { xs: [], ys: [] }; }); mapDots.forEach(d => { if (mapAgg[d.aid]) { mapAgg[d.aid].xs.push(d.x); mapAgg[d.aid].ys.push(d.y); } });
  const curVotes = vVotes.filter(v => v.si === (pi % customThemes.length));
  const vAvg = curVotes.length ? curVotes.reduce((a, v) => a + v.v, 0) / curVotes.length : 50;
  const vBuckets = Array(10).fill(0); curVotes.forEach(v => { vBuckets[cl(Math.floor(v.v / 10), 0, 9)]++; });
  const vMaxB = Math.max(...vBuckets, 1);

  // ─── PIN GATE ───
  if (!unlocked) return (
    <div style={{ minHeight: "100vh", background: "#08080A", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'Georgia',serif" }}>
      <div style={{ textAlign: "center", padding: "32px", maxWidth: "360px", color: "#E8E4DE" }}>
        <div style={{ fontSize: "9px", letterSpacing: "6px", color: "#C06840", marginBottom: "28px", textTransform: "uppercase" }}>Frigjørende Læringsdialogi</div>
        <h2 style={{ fontSize: "20px", fontWeight: 400, marginBottom: "8px" }}>Lukket testing</h2>
        <p style={{ color: "#5A5650", fontSize: "13px", lineHeight: 1.7, marginBottom: "28px" }}>Appen er under utvikling. Tast PIN-kode for å komme inn.</p>
        <div style={{ display: "flex", gap: "8px", justifyContent: "center", marginBottom: "12px" }}>
          <input
            value={pinInput}
            onChange={e => { setPinInput(e.target.value.replace(/\D/g, "").slice(0, 4)); setPinError(false); }}
            onKeyDown={e => { if (e.key === "Enter") { if (pinInput === APP_PIN) setUnlocked(true); else setPinError(true); } }}
            placeholder="● ● ● ●"
            type="tel"
            maxLength={4}
            style={{
              width: "160px", textAlign: "center", background: "#0E0E10",
              border: `2px solid ${pinError ? "#C06840" : "#1C1C20"}`,
              color: "#E8E4DE", fontSize: "24px", fontFamily: "monospace",
              letterSpacing: "8px", outline: "none", padding: "14px",
              transition: "border-color .2s",
            }}
          />
          <button onClick={() => { if (pinInput === APP_PIN) setUnlocked(true); else setPinError(true); }} style={{
            background: "#C06840", border: "none", color: "#E8E4DE",
            padding: "14px 20px", fontSize: "12px", cursor: "pointer",
            fontFamily: "'Georgia',serif",
          }}>→</button>
        </div>
        {pinError && <p style={{ color: "#C06840", fontSize: "12px", animation: "fadeUp .3s ease" }}>Feil kode. Prøv igjen.</p>}
        <p style={{ color: "#1C1C20", fontSize: "9px", marginTop: "40px", letterSpacing: "2px" }}>KRIS KALKMAN · DMMH</p>
      </div>
    </div>
  );

  // ─── WELCOME ───
  if (phase < 0) return (
    <div style={{ minHeight: "100vh", background: "#08080A", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'Georgia',serif", position: "relative", overflow: "hidden" }}>
      {[...Array(6)].map((_, i) => <div key={i} style={{ position: "absolute", width: `${150 + i * 85}px`, height: `${150 + i * 85}px`, borderRadius: "50%", border: `1px solid rgba(192,104,64,${.08 - i * .01})`, top: "50%", left: "50%", transform: "translate(-50%,-50%)", animation: `breathe ${4 + i * .6}s ease-in-out infinite` }} />)}
      <div style={{ textAlign: "center", zIndex: 1, padding: "32px", maxWidth: "520px", color: "#E8E4DE" }}>
        <div style={{ fontSize: "9px", letterSpacing: "6px", color: "#C06840", marginBottom: "28px", textTransform: "uppercase" }}>Frigjørende Læringsdialogi</div>
        <h1 style={{ fontSize: "clamp(28px,5.5vw,58px)", fontWeight: 400, lineHeight: 1.08, marginBottom: "8px" }}>Alle stemmer</h1>
        <h1 style={{ fontSize: "clamp(28px,5.5vw,58px)", color: "#C06840", fontWeight: 400, fontStyle: "italic", lineHeight: 1.08, marginBottom: "36px" }}>teller.</h1>
        <p style={{ color: "#5A5650", fontSize: "14px", lineHeight: 1.8, marginBottom: "32px" }}>Et polyvokalt læringsrom for 100+ studenter. Utforsk makt, ulikhet og frigjøring — sammen, i sanntid.</p>
        {autoStudent ? (
          <button onClick={() => { setPhase(0); setMode("student"); }} style={{ background: "#C06840", border: "1px solid #C06840", color: "#08080A", padding: "14px 36px", fontSize: "12px", letterSpacing: "2px", textTransform: "uppercase", cursor: "pointer", fontFamily: "'Georgia',serif" }}>Bli med i forelesningen</button>
        ) : (
          <div style={{ display: "flex", gap: "12px", justifyContent: "center", flexWrap: "wrap" }}>
            <button onClick={() => { setPhase(0); setMode("teacher"); }} style={{ background: "#C06840", border: "1px solid #C06840", color: "#08080A", padding: "14px 36px", fontSize: "12px", letterSpacing: "2px", textTransform: "uppercase", cursor: "pointer", fontFamily: "'Georgia',serif" }}>Start som underviser</button>
            <button onClick={() => { setPhase(0); setMode("student"); }} style={{ background: "transparent", border: "1px solid #C06840", color: "#C06840", padding: "14px 36px", fontSize: "12px", letterSpacing: "2px", textTransform: "uppercase", cursor: "pointer", fontFamily: "'Georgia',serif" }}>Bli med som student</button>
          </div>
        )}
        {!autoStudent && <button onClick={() => setShowTutorial(true)} style={{ display: "block", margin: "20px auto 0", background: "transparent", border: "1px solid #1C1C20", color: "#5A5650", padding: "10px 24px", fontSize: "11px", cursor: "pointer", fontFamily: "'Georgia',serif", letterSpacing: "1px" }}>📖 Slik bruker du appen</button>}
        {!autoStudent && <button onClick={() => setShowSetup(true)} style={{ display: "block", margin: "10px auto 0", background: "transparent", border: "1px solid #C0684040", color: "#C06840", padding: "10px 24px", fontSize: "11px", cursor: "pointer", fontFamily: "'Georgia',serif", letterSpacing: "1px" }}>⚙ Forbered forelesning</button>}
        <div style={{ marginTop: "48px", color: "#1C1C20", fontSize: "9px", letterSpacing: "3px" }}>FREIRE · HOOKS · BOURDIEU · BIGGS</div>
      </div>
      {showTutorial && <TutorialOverlay onClose={() => setShowTutorial(false)} />}
      {showSetup && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(8,8,10,.98)", zIndex: 400, overflowY: "auto", fontFamily: "'Georgia',serif" }}>
          <div style={{ maxWidth: "680px", margin: "0 auto", padding: "40px 24px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "32px" }}>
              <div>
                <div style={{ fontSize: "9px", letterSpacing: "4px", color: "#C06840", textTransform: "uppercase", marginBottom: "6px" }}>Forbered forelesning</div>
                <h2 style={{ fontSize: "22px", fontWeight: 400, color: "#E8E4DE", margin: 0 }}>Forhåndsinnstillinger</h2>
              </div>
              <button onClick={() => setShowSetup(false)} style={{ background: "transparent", border: "1px solid #1C1C20", color: "#5A5650", padding: "8px 16px", fontSize: "11px", cursor: "pointer", fontFamily: "'Georgia',serif" }}>✕ Lukk</button>
            </div>

            {/* Preset name */}
            <div style={{ background: "#0E0E10", border: "1px solid #1C1C20", padding: "20px", marginBottom: "16px" }}>
              <div style={{ fontSize: "10px", letterSpacing: "2px", color: "#5A5650", marginBottom: "8px" }}>NAVN PÅ FORELESNING (valgfritt)</div>
              <input value={presetName} onChange={e => setPresetName(e.target.value)} placeholder="F.eks. «Makt i barnehagen — uke 12»" style={{ width: "100%", background: "#08080A", border: "1px solid #1C1C20", color: "#E8E4DE", fontSize: "14px", fontFamily: "'Georgia',serif", outline: "none", padding: "12px" }} />
            </div>

            {/* 1. Aktørsett */}
            <div style={{ background: "#0E0E10", border: "1px solid #1C1C20", padding: "20px", marginBottom: "16px" }}>
              <div style={{ fontSize: "10px", letterSpacing: "2px", color: "#C06840", marginBottom: "4px" }}>1. AKTØRSETT FOR MAKTKARTET</div>
              <p style={{ fontSize: "11px", color: "#5A5650", marginBottom: "12px" }}>Velg hvilken kontekst som passer studentgruppen.</p>
              <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                {ACTOR_SET_NAMES.map(name => (
                  <button key={name} onClick={() => setActorSet(name)} style={{
                    padding: "12px 16px", textAlign: "left",
                    background: actorSet === name ? "#C0684015" : "#08080A",
                    border: `1px solid ${actorSet === name ? "#C06840" : "#1C1C20"}`,
                    color: actorSet === name ? "#E8E4DE" : "#5A5650",
                    cursor: "pointer", fontFamily: "'Georgia',serif", fontSize: "12px",
                  }}>
                    <div style={{ fontWeight: actorSet === name ? "bold" : "normal" }}>{actorSet === name ? "● " : "○ "}{name}</div>
                    <div style={{ fontSize: "10px", color: "#5A5650", marginTop: "4px" }}>
                      {ACTOR_SETS[name].map(a => a.e + " " + a.name).join(" · ")}
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* 2. Tematiske sett */}
            <div style={{ background: "#0E0E10", border: "1px solid #1C1C20", padding: "20px", marginBottom: "16px" }}>
              <div style={{ fontSize: "10px", letterSpacing: "2px", color: "#C06840", marginBottom: "4px" }}>2. TEMATISKE SETT (SPØRSMÅL + VERDILINJE)</div>
              <p style={{ fontSize: "11px", color: "#5A5650", marginBottom: "12px" }}>Disse brukes i utforskningsfasen. Rediger, fjern, legg til — eller generer med AI.</p>
              <div style={{ display: "flex", flexDirection: "column", gap: "4px", maxHeight: "300px", overflowY: "auto", marginBottom: "12px" }}>
                {customThemes.map((t, i) => (
                  <div key={i} style={{ padding: "10px 12px", background: "#08080A", border: "1px solid #1C1C20", display: "flex", justifyContent: "space-between", alignItems: "start", gap: "8px" }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: "9px", color: "#C06840", letterSpacing: "1px", marginBottom: "2px" }}>{t.theme}</div>
                      <div style={{ fontSize: "11px", color: "#E8E4DE", lineHeight: 1.4 }}>{t.prompt}</div>
                      <div style={{ fontSize: "10px", color: "#5A5650", marginTop: "2px" }}>━ {t.stmt.text}</div>
                    </div>
                    <button onClick={() => setCustomThemes(p => p.filter((_, j) => j !== i))} style={{ background: "transparent", border: "none", color: "#5A5650", cursor: "pointer", fontSize: "14px", padding: "0 4px", flexShrink: 0 }}>✕</button>
                  </div>
                ))}
              </div>
              <div style={{ borderTop: "1px solid #1C1C20", paddingTop: "12px" }}>
                <div style={{ fontSize: "9px", color: "#5A5650", letterSpacing: "1px", marginBottom: "6px" }}>LEGG TIL MANUELT</div>
                <input value={newPrompt} onChange={e => setNewPrompt(e.target.value)} placeholder="Spørsmål..." style={{ width: "100%", background: "#08080A", border: "1px solid #1C1C20", color: "#E8E4DE", fontSize: "12px", fontFamily: "'Georgia',serif", outline: "none", padding: "8px 10px", marginBottom: "6px" }} />
                <input value={newStmt} onChange={e => setNewStmt(e.target.value)} placeholder="Verdilinje-påstand..." style={{ width: "100%", background: "#08080A", border: "1px solid #1C1C20", color: "#E8E4DE", fontSize: "12px", fontFamily: "'Georgia',serif", outline: "none", padding: "8px 10px", marginBottom: "8px" }} />
                <button onClick={() => { if (newPrompt.trim() && newStmt.trim()) { setCustomThemes(p => [...p, { prompt: newPrompt.trim(), stmt: { text: newStmt.trim(), l: "Helt uenig", r: "Helt enig" }, theme: "Egendefinert" }]); setNewPrompt(""); setNewStmt(""); } }} style={{ background: "#1C1C20", border: "none", color: "#9A958E", padding: "6px 14px", fontSize: "10px", cursor: "pointer", fontFamily: "'Georgia',serif" }}>+ Legg til</button>
              </div>
              <div style={{ borderTop: "1px solid #1C1C20", paddingTop: "12px", marginTop: "12px" }}>
                <div style={{ fontSize: "9px", color: "#5A5650", letterSpacing: "1px", marginBottom: "6px" }}>GENERER MED AI</div>
                <div style={{ display: "flex", gap: "6px" }}>
                  <input value={aiTopic} onChange={e => setAiTopic(e.target.value)} placeholder="Tema (f.eks. «mangfold i barnehagen»)..." style={{ flex: 1, background: "#08080A", border: "1px solid #1C1C20", color: "#E8E4DE", fontSize: "12px", fontFamily: "'Georgia',serif", outline: "none", padding: "8px 10px" }} />
                  <button onClick={async () => {
                    if (!aiTopic.trim() || aiGenerating) return;
                    setAiGenerating(true);
                    try {
                      const r = await fetch("https://api.anthropic.com/v1/messages", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ model: "claude-sonnet-4-20250514", max_tokens: 1500, messages: [{ role: "user", content: makeThemePrompt(aiTopic) }] }) });
                      const d = await r.json();
                      const txt = d.content?.map(c => c.text || "").join("") || "";
                      const sets = JSON.parse(txt.replace(/```json|```/g, "").trim());
                      if (Array.isArray(sets)) setCustomThemes(p => [...p, ...sets.map(s => ({ prompt: s.prompt, stmt: { text: s.stmt, l: s.l || "Helt uenig", r: s.r || "Helt enig" }, theme: s.theme || "AI-generert" }))]);
                    } catch (e) {
                      // AI utilgjengelig — bruk kvalitetsfallback basert på tema
                      const t = aiTopic.trim();
                      const fallbacks = {
                        "mangfold": [
                          { prompt: "Hvem sitt mangfold er det egentlig plass til her?", stmt: { text: "Mangfold handler mest om synlige forskjeller", l: "Helt uenig", r: "Helt enig" }, theme: "Mangfoldets grenser" },
                          { prompt: "Når sa noen sist at du 'ikke passer inn' — uten ord?", stmt: { text: "En pedagog bør behandle alle barn likt uansett bakgrunn", l: "Helt uenig", r: "Helt enig" }, theme: "Likhet vs. rettferdighet" },
                          { prompt: "Hvilke kropper og språk føles hjemme i dette rommet?", stmt: { text: "Barn tilpasser seg naturlig til norsk kultur over tid", l: "Helt uenig", r: "Helt enig" }, theme: "Tilpasning og tilhørighet" },
                        ],
                        "barnehage": [
                          { prompt: "Hvem bestemmer hva som er god barndom — og for hvem?", stmt: { text: "Fri lek er viktigere enn strukturert læring i barnehagen", l: "Helt uenig", r: "Helt enig" }, theme: "Barndommens politikk" },
                          { prompt: "Hvilke barn blir sett først når du går inn i et rom?", stmt: { text: "Noen barn trenger strengere grenser enn andre", l: "Helt uenig", r: "Helt enig" }, theme: "Synlighet og normer" },
                          { prompt: "Hva mister barnet når morsmålet forsvinner?", stmt: { text: "Barnehagen bør prioritere norsk fremfor morsmålsstøtte", l: "Helt uenig", r: "Helt enig" }, theme: "Språk og makt" },
                        ],
                        "makt": [
                          { prompt: "Hvem slipper å tenke over sin egen makt — og hvorfor?", stmt: { text: "Makt er noe man enten har eller ikke har", l: "Helt uenig", r: "Helt enig" }, theme: "Usynlig makt" },
                          { prompt: "Når var siste gang du fulgte en regel uten å spørre hvorfor?", stmt: { text: "Regler beskytter de svakeste i systemet", l: "Helt uenig", r: "Helt enig" }, theme: "Regler og reproduksjon" },
                          { prompt: "Hva skjer med den som sier ifra i dette systemet?", stmt: { text: "Det er mulig å endre systemet innenfra", l: "Helt uenig", r: "Helt enig" }, theme: "Motstand og pris" },
                        ],
                        "default": [
                          { prompt: `Hvem har definert hva '${t}' betyr — og hvem ble ikke spurt?`, stmt: { text: "Fagfolk vet best hva som trengs", l: "Helt uenig", r: "Helt enig" }, theme: "Definisjonsmakt" },
                          { prompt: `Hvem er usynlig i samtalen om ${t}?`, stmt: { text: "De mest berørte har størst innflytelse", l: "Helt uenig", r: "Helt enig" }, theme: "Stemme og stillhet" },
                          { prompt: `Hva tar vi for gitt som 'normalt' innen ${t}?`, stmt: { text: "Nøytralitet er mulig og ønskelig", l: "Helt uenig", r: "Helt enig" }, theme: "Normalitet og makt" },
                          { prompt: `Hvem betaler prisen når ${t} 'fungerer bra'?`, stmt: { text: "Systemet fungerer for de fleste", l: "Helt uenig", r: "Helt enig" }, theme: "Skjulte kostnader" },
                          { prompt: `Hva ville endret seg om den mest marginaliserte bestemte?`, stmt: { text: "Endring må komme gradvis, ikke radikalt", l: "Helt uenig", r: "Helt enig" }, theme: "Makt og endring" },
                        ],
                      };
                      const tl = t.toLowerCase();
                      const match = Object.keys(fallbacks).find(k => k !== "default" && tl.includes(k));
                      const fb = match ? fallbacks[match] : fallbacks["default"];
                      setCustomThemes(p => [...p, ...fb]);
                      alert("AI er ikke tilgjengelig akkurat nå — la til forhåndsdefinerte sett. Prøv igjen når appen er deployet til Vercel.");
                    }
                    setAiGenerating(false); setAiTopic("");
                  }} style={{ background: aiGenerating ? "#1C1C20" : "#4A6090", border: "none", color: "#E8E4DE", padding: "8px 14px", fontSize: "10px", cursor: aiGenerating ? "wait" : "pointer", fontFamily: "'Georgia',serif", whiteSpace: "nowrap" }}>{aiGenerating ? "Genererer..." : "✦ AI-generer"}</button>
                </div>
              </div>
            </div>

            {/* 3. Innsjekk-utsagn */}
            <div style={{ background: "#0E0E10", border: "1px solid #1C1C20", padding: "20px", marginBottom: "16px" }}>
              <div style={{ fontSize: "10px", letterSpacing: "2px", color: "#C06840", marginBottom: "4px" }}>3. INNSJEKK-UTSAGN (ANKOMST)</div>
              <p style={{ fontSize: "11px", color: "#5A5650", marginBottom: "12px" }}>hooks-inspirerte posisjoneringer studentene velger ved ankomst.</p>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "4px", marginBottom: "12px" }}>
                {checkins.map((ci, i) => (
                  <div key={i} style={{ padding: "8px 10px", background: "#08080A", border: "1px solid #1C1C20", fontSize: "11px", color: "#9A958E", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span>{ci.icon} {ci.text}</span>
                    <button onClick={() => setCheckins(p => p.filter((_, j) => j !== i))} style={{ background: "transparent", border: "none", color: "#5A5650", cursor: "pointer", fontSize: "12px" }}>✕</button>
                  </div>
                ))}
              </div>
              <div style={{ display: "flex", gap: "6px" }}>
                <button onClick={async () => {
                  setCiGenerating(true);
                  try {
                    const r = await fetch("https://api.anthropic.com/v1/messages", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ model: "claude-sonnet-4-20250514", max_tokens: 1000, messages: [{ role: "user", content: `Du er bell hooks. Generer 8 innsjekk-utsagn for et modig læringsrom med 100+ studenter.\n\nHvert utsagn:\n- Jeg-posisjonering (starter med "Jeg...")\n- Dekk: beredskap, habitus, privilegium, mot, stemme, lytting, usynlighet, usikkerhet\n- Maks 12 ord\n\nSvar KUN med JSON-array: [{"text":"...","icon":"...","cat":"..."}]` }] }) });
                    const d = await r.json();
                    const txt = d.content?.map(c => c.text || "").join("") || "";
                    const items = JSON.parse(txt.replace(/```json|```/g, "").trim());
                    if (Array.isArray(items)) { setCheckins(items.slice(0, 8)); setCheckinCounts({}); }
                  } catch (e) { setCheckins([...ALT_CHECKINS[altIdx % ALT_CHECKINS.length]]); altIdx++; setCheckinCounts({}); }
                  setCiGenerating(false);
                }} style={{ background: ciGenerating ? "#1C1C20" : "#4A6090", border: "none", color: "#E8E4DE", padding: "6px 14px", fontSize: "10px", cursor: ciGenerating ? "wait" : "pointer", fontFamily: "'Georgia',serif" }}>{ciGenerating ? "Genererer..." : "↻ Nye utsagn (AI)"}</button>
                <button onClick={() => { setCheckins([...DEFAULT_CHECKINS]); setCheckinCounts({}); }} style={{ background: "transparent", border: "1px solid #1C1C20", color: "#5A5650", padding: "6px 14px", fontSize: "10px", cursor: "pointer", fontFamily: "'Georgia',serif" }}>Tilbakestill standard</button>
              </div>
            </div>

            {/* 4. Oppsummering */}
            <div style={{ background: "#0E0E10", border: "1px solid #1C1C20", padding: "20px", marginBottom: "24px" }}>
              <div style={{ fontSize: "10px", letterSpacing: "2px", color: "#C06840", marginBottom: "10px" }}>OPPSUMMERING</div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" }}>
                {[
                  ["AKTØRSETT", actorSet],
                  ["TEMATISKE SETT", `${customThemes.length} sett`],
                  ["INNSJEKK-UTSAGN", `${checkins.length} utsagn`],
                  ["FORELESNING", presetName || "Ikke navngitt"],
                ].map(([label, val]) => (
                  <div key={label} style={{ padding: "10px", background: "#08080A", border: "1px solid #1C1C20" }}>
                    <div style={{ fontSize: "9px", color: "#5A5650", letterSpacing: "1px" }}>{label}</div>
                    <div style={{ fontSize: "12px", color: "#E8E4DE", marginTop: "4px" }}>{val}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Handlinger */}
            <div style={{ display: "flex", gap: "10px", justifyContent: "center", flexWrap: "wrap" }}>
              <button onClick={() => { setShowSetup(false); setPhase(0); setMode("teacher"); }} style={{ background: "#C06840", border: "none", color: "#E8E4DE", padding: "14px 36px", fontSize: "12px", letterSpacing: "2px", textTransform: "uppercase", cursor: "pointer", fontFamily: "'Georgia',serif" }}>Start forelesning →</button>
              <button onClick={() => setShowSetup(false)} style={{ background: "transparent", border: "1px solid #1C1C20", color: "#5A5650", padding: "14px 24px", fontSize: "12px", cursor: "pointer", fontFamily: "'Georgia',serif" }}>Lagre og lukk</button>
            </div>
            <p style={{ textAlign: "center", fontSize: "10px", color: "#3A3835", marginTop: "16px" }}>Innstillingene beholdes når du lukker — start forelesningen når du er klar.</p>
          </div>
        </div>
      )}
      <style>{`@keyframes breathe{0%,100%{transform:translate(-50%,-50%) scale(1);opacity:.25}50%{transform:translate(-50%,-50%) scale(1.03);opacity:.6}}`}</style>
    </div>
  );

  const totalCI = Object.values(checkinCounts).reduce((a, b) => a + b, 0);
  const maxCI = Math.max(...Object.values(checkinCounts), 1);

  // ─── MAIN LAYOUT ───
  return (
    <div style={{ minHeight: "100vh", background: "#08080A", color: "#E8E4DE", fontFamily: "'Georgia',serif" }}>
      {/* NAV */}
      <div style={{ position: "sticky", top: 0, zIndex: 100, background: "rgba(8,8,10,.97)", backdropFilter: "blur(20px)", borderBottom: "1px solid #1C1C20" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 16px", maxWidth: "1440px", margin: "0 auto", flexWrap: "wrap", gap: "8px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "12px", flexWrap: "wrap" }}>
            <span style={{ fontSize: "9px", letterSpacing: "3px", color: "#3A3835" }}>FLD</span>
            <div style={{ display: "flex", gap: "1px" }}>{PHASES.map((p, i) =>
              <button key={p.id} onClick={() => { if (isT) setPhase(i); }} style={{ background: i === phase ? p.c : "transparent", border: `1px solid ${i === phase ? p.c : i <= phase ? p.c + "40" : "#1C1C20"}`, color: i === phase ? "#E8E4DE" : i <= phase ? p.c : "#3A3835", padding: "4px 10px", fontSize: "9px", letterSpacing: "1px", cursor: isT ? "pointer" : "default", fontFamily: "'Georgia',serif", transition: "all .3s", opacity: i <= phase ? 1 : .4 }}>{p.n}</button>
            )}</div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "5px" }}>
              <div style={{ width: 6, height: 6, borderRadius: "50%", background: rtConnected ? "#5A8060" : "#C06840", animation: rtConnected ? "blink 2s infinite" : "none" }} title={rtConnected ? "Tilkoblet sanntid" : "Kobler til..."} />
              <span style={{ fontSize: "11px", color: "#9A958E" }}>{Math.min(studs, 128)}</span>
            </div>
            <span style={{ fontSize: "11px", color: "#3A3835" }}>{voices.length} bidrag</span>
            <button onClick={() => setMode(m => m === "teacher" ? "student" : "teacher")} style={{ background: isT ? "#C0684015" : "transparent", border: `1px solid ${isT ? "#C06840" : "#1C1C20"}`, color: isT ? "#C06840" : "#5A5650", padding: "3px 12px", fontSize: "9px", cursor: "pointer", fontFamily: "'Georgia',serif", letterSpacing: "2px", textTransform: "uppercase" }}>{isT ? "◉ Storskjerm" : "◯ Student"}</button>
          </div>
        </div>
        <div style={{ display: "flex", height: "2px" }}>{PHASES.map((p, i) => <div key={p.id} style={{ flex: 1, background: i <= phase ? p.c : "#0E0E10", transition: "background .5s" }} />)}</div>
      </div>

      <div style={{ maxWidth: "1440px", margin: "0 auto", padding: isT ? "32px 28px" : "20px 16px", paddingBottom: isT ? "80px" : "20px" }}>
        {/* Phase header */}
        <div style={{ marginBottom: "24px" }}>
          <div style={{ display: "flex", alignItems: "baseline", gap: "12px", marginBottom: "4px" }}>
            <span style={{ fontSize: "44px", fontWeight: 300, color: P.c, lineHeight: 1, opacity: .2 }}>{P.n}</span>
            <h2 style={{ fontSize: isT ? "28px" : "22px", fontWeight: 400, margin: 0 }}>{P.label}</h2>
          </div>
          <p style={{ color: "#5A5650", fontSize: "13px", fontStyle: "italic", margin: 0 }}>{P.desc}</p>
          <p style={{ color: "#3A3835", fontSize: "10px", letterSpacing: "1px", margin: "2px 0 0" }}>{P.t}</p>
        </div>

        {/* Activity tabs */}
        {avail.length > 1 && (
          <div style={{ display: "flex", gap: "2px", marginBottom: "16px", flexWrap: "wrap" }}>
            {avail.map(([k, a]) => <button key={k} onClick={() => setAct(k)} style={{ background: act === k ? `${P.c}18` : "transparent", border: `1px solid ${act === k ? P.c : "#1C1C20"}`, color: act === k ? P.c : "#5A5650", padding: "6px 16px", fontSize: "10px", letterSpacing: "1px", cursor: "pointer", fontFamily: "'Georgia',serif" }}>{a.icon} {a.label}</button>)}
          </div>
        )}

        {/* Prompt bar */}
        {phase === 1 && (
          <div style={{ background: "#0E0E10", border: "1px solid #1C1C20", borderLeft: `3px solid ${P.c}`, padding: "20px", marginBottom: "20px", position: "relative" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "10px" }}>
              <div style={{ fontSize: "10px", letterSpacing: "3px", color: P.c, textTransform: "uppercase" }}>Problemposerende spørsmål</div>
              <button onClick={() => setShowThemePicker(p => !p)} style={{ fontSize: "9px", color: showThemePicker ? P.c : "#5A5650", border: `1px solid ${showThemePicker ? P.c : "#1C1C20"}`, background: showThemePicker ? `${P.c}10` : "transparent", padding: "3px 10px", cursor: "pointer", fontFamily: "'Georgia',serif" }}>Tema: {customThemes[pi % customThemes.length].theme} ▾</button>
            </div>
            {/* Theme picker dropdown */}
            {showThemePicker && isT && (
              <div style={{ background: "#08080A", border: "1px solid #1C1C20", padding: "12px", marginBottom: "12px" }}>
                <div style={{ fontSize: "9px", letterSpacing: "2px", color: "#5A5650", marginBottom: "8px" }}>VELG TEMA ({customThemes.length} tilgjengelig)</div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: "4px" }}>
                  {customThemes.map((t, i) => (
                    <button key={i} onClick={() => { setPi(i); setVVoted(false); setShowThemePicker(false); }} style={{
                      padding: "5px 10px", fontSize: "10px",
                      background: i === pi % customThemes.length ? `${P.c}20` : "transparent",
                      border: `1px solid ${i === pi % customThemes.length ? P.c : "#1C1C20"}`,
                      color: i === pi % customThemes.length ? P.c : "#7A756F",
                      cursor: "pointer", fontFamily: "'Georgia',serif", transition: "all .15s",
                    }}>{t.theme}</button>
                  ))}
                </div>
              </div>
            )}
            <p style={{ fontSize: isT ? "22px" : "16px", lineHeight: 1.5, fontStyle: "italic", margin: "0 0 10px" }}>«{customThemes[pi % customThemes.length].prompt}»</p>
            {isT && <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", alignItems: "center" }}>
              <button onClick={() => { setPi(p => p + 1); setVVoted(false); }} style={{ background: "transparent", border: `1px solid ${P.c}40`, color: P.c, padding: "5px 14px", fontSize: "10px", cursor: "pointer", fontFamily: "'Georgia',serif" }}>Neste →</button>
              <button onClick={() => setShowPromptEditor(true)} style={{ background: "transparent", border: "1px solid #1C1C20", color: "#5A5650", padding: "5px 14px", fontSize: "10px", cursor: "pointer", fontFamily: "'Georgia',serif" }}>✎ Rediger spørsmål</button>
              <span style={{ fontSize: "9px", color: "#5A5650", fontStyle: "italic" }}>━ «{customThemes[pi % customThemes.length].stmt.text.substring(0, 45)}...»</span>
            </div>}
          </div>
        )}

        {/* ═══ ANKOMST ═══ */}
        {phase === 0 && (
          <div>
            {/* Student check-in */}
            {!isT && !checkedIn && (
              <div style={{ background: "#0E0E10", border: "1px solid #1C1C20", padding: "24px", marginBottom: "16px" }}>
                <div style={{ fontSize: "10px", letterSpacing: "3px", color: P.c, textTransform: "uppercase", marginBottom: "8px" }}>Innsjekk — hooks' modige rom</div>
                <p style={{ color: "#9A958E", fontSize: "14px", lineHeight: 1.7, marginBottom: "6px" }}>Velg inntil <strong style={{ color: "#E8E4DE" }}>3 utsagn</strong> som passer for deg akkurat nå. Ingen ser ditt svar — men rommet ser oss som helhet.</p>
                <p style={{ color: "#5A5650", fontSize: "11px", fontStyle: "italic", marginBottom: "18px" }}>Det finnes ikke riktig svar. Ærligheten er selve handlingen.</p>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" }}>
                  {checkins.map((ci, idx) => {
                    const isSel = myCheckins.includes(ci.text);
                    return (
                      <button key={idx} onClick={() => setMyCheckins(p => isSel ? p.filter(t => t !== ci.text) : p.length < 3 ? [...p, ci.text] : p)} style={{
                        padding: "14px 16px", textAlign: "left",
                        background: isSel ? `${P.c}12` : "transparent",
                        border: `1px solid ${isSel ? P.c : "#1C1C20"}`,
                        color: isSel ? "#E8E4DE" : "#9A958E",
                        cursor: "pointer", fontFamily: "'Georgia',serif", transition: "all .2s",
                      }}>
                        <span style={{ fontSize: "14px", marginRight: "8px", opacity: .6 }}>{ci.icon}</span>
                        <span style={{ fontSize: "12px", lineHeight: 1.5 }}>{ci.text}</span>
                      </button>
                    );
                  })}
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "14px" }}>
                  <span style={{ fontSize: "10px", color: myCheckins.length > 0 ? P.c : "#3A3835" }}>{myCheckins.length}/3 valgt</span>
                  <button onClick={() => { if (myCheckins.length > 0) { setCheckedIn(true); myCheckins.forEach(t => setCheckinCounts(p => ({ ...p, [t]: (p[t] || 0) + 1 }))); bc("checkin", { items: myCheckins }); } }} disabled={myCheckins.length === 0} style={{ background: myCheckins.length > 0 ? P.c : "#1C1C20", border: "none", color: myCheckins.length > 0 ? "#E8E4DE" : "#3A3835", padding: "12px 28px", fontSize: "12px", letterSpacing: "1px", cursor: myCheckins.length > 0 ? "pointer" : "default", fontFamily: "'Georgia',serif" }}>Sjekk inn</button>
                </div>
              </div>
            )}
            {!isT && checkedIn && (
              <div style={{ background: "#0E0E10", border: `1px solid ${P.c}25`, borderLeft: `3px solid ${P.c}`, padding: "20px", marginBottom: "16px" }}>
                <p style={{ fontSize: "13px", color: "#5A8060", margin: "0 0 6px" }}>✓ Du er her, og det er nok.</p>
                <p style={{ fontSize: "11px", color: "#5A5650", margin: 0, fontStyle: "italic" }}>Du valgte: {myCheckins.map((t, i) => <span key={i} style={{ color: "#9A958E" }}>{i > 0 ? " · " : ""}{t}</span>)}</p>
              </div>
            )}

            {/* Room overview — always visible */}
            <div style={{ background: "#0E0E10", border: "1px solid #1C1C20", padding: "24px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
                <div style={{ fontSize: "10px", letterSpacing: "3px", color: P.c, textTransform: "uppercase" }}>Rommet akkurat nå</div>
                {isT && (
                  <button onClick={async () => {
                    setCiGenerating(true);
                    try {
                      const res = await fetch("https://api.anthropic.com/v1/messages", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ model: "claude-sonnet-4-20250514", max_tokens: 1000, messages: [{ role: "user", content: `Du er bell hooks. Generer 8 innsjekk-utsagn for et modig læringsrom (courageous space) med 100+ studenter. Utsagnene skal dekke: beredskap til å bli utfordret, habitus-synliggjøring, privilegium-bevissthet, mot til ubehag, stemmens verdi, lyttekontrakt, usynlige erfaringer, og rom for usikkerhet. Hvert utsagn er i jeg-form, kort (maks 12 ord), ærlig, og inviterer til selvrefleksjon uten å moralisere. Svar KUN med JSON-array: [{"text":"...","icon":"...","cat":"..."}] der icon er ett Unicode-tegn og cat er en kort kategori.` }] }) });
                      const data = await res.json();
                      const text = data.content.map(i => i.text || "").join("");
                      const parsed = JSON.parse(text.replace(/```json|```/g, "").trim());
                      if (Array.isArray(parsed) && parsed.length >= 6) { setCheckins(parsed); setCheckinCounts({}); }
                    } catch (err) { setCheckins([...ALT_CHECKINS[altIdx % ALT_CHECKINS.length]]); altIdx++; setCheckinCounts({}); }
                    setCiGenerating(false);
                  }} style={{ background: "transparent", border: "1px solid #1C1C20", color: "#5A5650", padding: "4px 12px", fontSize: "9px", cursor: "pointer", fontFamily: "'Georgia',serif" }}>{ciGenerating ? "Genererer..." : "↻ Nye utsagn (AI)"}</button>
                )}
              </div>
              <div style={{ textAlign: "center", padding: isT ? "24px 0" : "12px 0" }}>
                <div style={{ fontSize: isT ? "72px" : "48px", fontWeight: 300, color: P.c }}>{Math.min(studs, 128)}</div>
                <div style={{ fontSize: "11px", color: "#3A3835", letterSpacing: "3px" }}>TILSTEDE</div>
              </div>
              {totalCI > 0 && (
                <div style={{ marginTop: "16px", borderTop: "1px solid #1C1C20", paddingTop: "16px" }}>
                  <div style={{ fontSize: "9px", letterSpacing: "2px", color: "#5A5650", marginBottom: "12px" }}>POSISJONERINGER I ROMMET</div>
                  <div style={{ display: "grid", gridTemplateColumns: isT ? "1fr 1fr" : "1fr", gap: "6px" }}>
                    {checkins.filter(ci => checkinCounts[ci.text]).sort((a, b) => (checkinCounts[b.text] || 0) - (checkinCounts[a.text] || 0)).map((ci, i) => {
                      const n = checkinCounts[ci.text] || 0;
                      const pct = totalCI > 0 ? (n / totalCI) * 100 : 0;
                      const isMine = myCheckins.includes(ci.text);
                      return (
                        <div key={i} style={{ padding: "10px 14px", background: isMine ? `${P.c}08` : "#08080A", border: `1px solid ${isMine ? P.c + "25" : "#141416"}`, position: "relative", overflow: "hidden" }}>
                          <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: `${pct}%`, background: `${P.c}10`, transition: "width .5s" }} />
                          <div style={{ position: "relative", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                            <span style={{ fontSize: "11px", color: isMine ? "#E8E4DE" : "#7A756F" }}>{ci.icon} {ci.text}</span>
                            <span style={{ fontSize: "12px", color: P.c, fontWeight: "bold", marginLeft: "8px" }}>{n}</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  {isT && totalCI > 10 && (
                    <div style={{ marginTop: "14px", padding: "10px 14px", background: "#08080A", border: "1px solid #1C1C20", borderLeft: `3px solid ${P.c}` }}>
                      <p style={{ fontSize: "11px", color: "#9A958E", margin: 0, lineHeight: 1.6, fontStyle: "italic" }}>
                        {checkinCounts["Jeg holder meg vanligvis stille i slike rom"] > totalCI * 0.2 
                          ? "Mange i rommet er vanligvis stille. Hva forteller det om hvem som vanligvis tar ordet?"
                          : checkinCounts["Jeg føler meg hjemme i et klasserom"] > totalCI * 0.3
                          ? "En stor andel føler seg hjemme her. Hvem gjør ikke det — og hvorfor?"
                          : "Rommet posisjonerer seg. Bruk dette som utgangspunkt for samtalen."}
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ═══ STEMMESTRØM ═══ */}
        {phase === 1 && act === "stemmer" && (
          <div>
            {/* Input area — always visible */}
            <div style={{ background: "#0E0E10", border: "1px solid #1C1C20", padding: "20px", marginBottom: "16px" }}>
              <div style={{ fontSize: "10px", letterSpacing: "3px", color: "#5A5650", textTransform: "uppercase", marginBottom: "10px" }}>Del din stemme anonymt</div>
              <textarea value={inp} onChange={e => setInp(e.target.value)} placeholder="Skriv ditt bidrag her..." style={{ width: "100%", boxSizing: "border-box", background: "#08080A", border: "1px solid #1C1C20", color: "#E8E4DE", fontSize: "14px", fontFamily: "'Georgia',serif", outline: "none", padding: "16px", lineHeight: 1.7, resize: "none", height: "80px" }} onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); addVoice(); } }} />
              {/* Selectable tags */}
              <div style={{ marginTop: "10px", marginBottom: "10px" }}>
                <div style={{ fontSize: "9px", letterSpacing: "2px", color: "#5A5650", marginBottom: "6px" }}>KNYTT TEMATISKE TAGS (valgfritt, maks 3)</div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: "4px" }}>
                  {CHOOSABLE_TAGS.map(tag => {
                    const isSel = selTags.includes(tag);
                    return (
                      <button key={tag} onClick={() => setSelTags(p => isSel ? p.filter(t => t !== tag) : p.length < 3 ? [...p, tag] : p)} style={{
                        padding: "3px 9px", fontSize: "10px",
                        background: isSel ? `${P.c}20` : "transparent",
                        border: `1px solid ${isSel ? P.c : "#1C1C20"}`,
                        color: isSel ? P.c : "#5A5650",
                        cursor: "pointer", fontFamily: "'Georgia',serif", transition: "all .15s",
                      }}>#{tag}</button>
                    );
                  })}
                </div>
                {selTags.length > 0 && <div style={{ fontSize: "9px", color: P.c, marginTop: "4px" }}>{selTags.length}/3 valgt</div>}
              </div>
              <button onClick={addVoice} style={{ background: P.c, border: "none", color: "#E8E4DE", padding: "12px 32px", fontSize: "12px", letterSpacing: "1px", cursor: "pointer", fontFamily: "'Georgia',serif" }}>Legg til stemme</button>
            </div>

            {/* Voices stream + tag cloud */}
            <div style={{ display: "grid", gridTemplateColumns: isT ? "1fr 280px" : "1fr 220px", gap: "16px" }}>
              <div style={{ background: "#0E0E10", border: "1px solid #1C1C20", padding: "20px", maxHeight: isT ? "60vh" : "65vh", overflowY: "auto" }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "14px" }}>
                  <div style={{ fontSize: "10px", letterSpacing: "3px", color: "#5A5650", textTransform: "uppercase" }}>{voices.length} stemmer</div>
                  <div style={{ width: 6, height: 6, borderRadius: "50%", background: P.c, animation: "blink 1.5s infinite" }} />
                </div>
                <div style={{ display: "grid", gridTemplateColumns: isT ? "1fr 1fr" : "1fr", gap: "5px" }}>
                  {voices.slice(0, isT ? 24 : 30).map((v, i) => {
                    const totalRx = Object.values(v.rx || {}).reduce((a, b) => a + b, 0);
                    return (
                      <div key={v.id} style={{ padding: "12px 16px", background: v.own ? `${P.c}08` : "#0A0A0C", border: `1px solid ${v.own ? P.c + "25" : "#141416"}`, animation: i < 2 ? "fadeUp .4s ease" : undefined }}>
                        <p style={{ margin: 0, fontSize: "12px", lineHeight: 1.6, color: v.own ? "#E8E4DE" : "#7A756F" }}>{v.text}</p>
                        {(v.tags || []).length > 0 && (
                          <div style={{ display: "flex", gap: "5px", marginTop: "5px", flexWrap: "wrap" }}>
                            {v.tags.map(t => <span key={t} style={{ fontSize: "9px", color: `${P.c}90`, background: `${P.c}10`, padding: "1px 6px", border: `1px solid ${P.c}20` }}>#{t}</span>)}
                          </div>
                        )}
                        {/* Reactions */}
                        <div style={{ display: "flex", gap: "4px", marginTop: "6px", alignItems: "center" }}>
                          {!v.own && REACTIONS.map(r => {
                            const count = v.rx?.[r.key] || 0;
                            return (
                              <button key={r.key} onClick={() => reactTo(v.id, r.key)} style={{
                                padding: "2px 7px", fontSize: "9px",
                                background: count > 0 ? `${P.c}08` : "transparent",
                                border: `1px solid ${count > 0 ? P.c + "30" : "#1C1C20"}`,
                                color: count > 0 ? P.c : "#3A3835",
                                cursor: "pointer", fontFamily: "'Georgia',serif",
                                display: "flex", alignItems: "center", gap: "3px", transition: "all .15s",
                              }}>{r.icon}{count > 0 ? ` ${count}` : ""}</button>
                            );
                          })}
                          {v.own && totalRx > 0 && (
                            <span style={{ fontSize: "9px", color: "#5A8060" }}>
                              {REACTIONS.map(r => v.rx?.[r.key] ? `${r.icon}${v.rx[r.key]}` : "").filter(Boolean).join(" ")}
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
              {/* Tag cloud sidebar */}
              <div style={{ background: "#0E0E10", border: "1px solid #1C1C20", padding: "16px", alignSelf: "start", position: "sticky", top: "60px" }}>
                <div style={{ fontSize: "10px", letterSpacing: "3px", color: "#5A5650", textTransform: "uppercase", marginBottom: "12px" }}>Begreper i rommet</div>
                <TagCloud voices={voices} c={P.c} />
                {voices.filter(v => v.own).length > 0 && (
                  <div style={{ marginTop: "14px", borderTop: "1px solid #1C1C20", paddingTop: "10px" }}>
                    <div style={{ fontSize: "9px", color: "#5A5650", letterSpacing: "1px", marginBottom: "4px" }}>DINE BIDRAG: {voices.filter(v => v.own).length}</div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ═══ MAKTKARTET ═══ */}
        {act === "maktkart" && phase === 1 && (
          <div>
            {mapMode === "intro" && !isT ? (
              <div style={{ background: "#0E0E10", border: "1px solid #1C1C20", padding: "32px", maxWidth: "600px", margin: "0 auto" }}>
                <div style={{ fontSize: "10px", letterSpacing: "3px", color: P.c, textTransform: "uppercase", marginBottom: "20px" }}>Maktkartet — Bourdieu-inspirert feltanalyse</div>
                <p style={{ fontSize: "15px", lineHeight: 1.7, color: "#9A958E", marginBottom: "16px" }}>Du skal plassere <strong style={{ color: "#E8E4DE" }}>10 aktører</strong> i et koordinatsystem:</p>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", marginBottom: "16px" }}>
                  <div style={{ padding: "14px", border: "1px solid #1C1C20" }}>
                    <div style={{ fontSize: "10px", letterSpacing: "2px", color: P.c, marginBottom: "6px" }}>← VENSTRE → HØYRE</div>
                    <p style={{ fontSize: "12px", color: "#9A958E", lineHeight: 1.6, margin: 0 }}><strong style={{ color: "#E8E4DE" }}>Synlighet:</strong> Hvor synlig er aktøren i samfunnsdebatten?</p>
                  </div>
                  <div style={{ padding: "14px", border: "1px solid #1C1C20" }}>
                    <div style={{ fontSize: "10px", letterSpacing: "2px", color: P.c, marginBottom: "6px" }}>↓ NEDERST → ↑ ØVERST</div>
                    <p style={{ fontSize: "12px", color: "#9A958E", lineHeight: 1.6, margin: 0 }}><strong style={{ color: "#E8E4DE" }}>Innflytelse:</strong> Hvor mye reell innflytelse har aktøren på praksis?</p>
                  </div>
                </div>
                <div style={{ padding: "12px", background: "#141416", borderLeft: `3px solid ${P.c}`, marginBottom: "20px" }}>
                  <p style={{ fontSize: "12px", color: "#9A958E", lineHeight: 1.6, margin: 0 }}><strong style={{ color: "#E8E4DE" }}>Det finnes ikke «riktig svar».</strong> Bourdieu: makt er mest effektiv når den er usynlig. Uenigheten er selve poenget.</p>
                </div>
                <div style={{ marginBottom: "16px" }}>
                  <div style={{ fontSize: "9px", letterSpacing: "2px", color: "#5A5650", marginBottom: "6px" }}>KONTEKST: {actorSet.toUpperCase()}</div>
                </div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: "6px", marginBottom: "20px" }}>{MA.map((a, i) => <span key={a.id} style={{ padding: "3px 8px", fontSize: "11px", border: `1px solid ${MC[i]}30`, color: MC[i], opacity: .7 }}>{a.e} {a.name}</span>)}</div>
                <button onClick={() => setMapMode("place")} style={{ background: P.c, border: "none", color: "#E8E4DE", padding: "12px 32px", fontSize: "12px", letterSpacing: "1px", cursor: "pointer", fontFamily: "'Georgia',serif" }}>Start kartlegging</button>
              </div>
            ) : (
              <div style={{ background: "#0E0E10", border: "1px solid #1C1C20", padding: "20px" }}>
                {/* Actor set selector — teacher only */}
                {isT && (
                  <div style={{ display: "flex", gap: "6px", flexWrap: "wrap", marginBottom: "12px", paddingBottom: "12px", borderBottom: "1px solid #1C1C20" }}>
                    <span style={{ fontSize: "9px", letterSpacing: "2px", color: "#5A5650", alignSelf: "center" }}>KONTEKST:</span>
                    {ACTOR_SET_NAMES.map(name => (
                      <button key={name} onClick={() => { setActorSet(name); setMapDots([]); setMapPl({}); setMapAi(0); setMapMode("place"); }} style={{
                        padding: "4px 10px", fontSize: "10px",
                        background: actorSet === name ? `${P.c}20` : "transparent",
                        border: `1px solid ${actorSet === name ? P.c : "#1C1C20"}`,
                        color: actorSet === name ? P.c : "#5A5650",
                        cursor: "pointer", fontFamily: "'Georgia',serif",
                      }}>{name}</button>
                    ))}
                  </div>
                )}
                {/* Actor selector — always visible */}
                <div style={{ fontSize: "10px", letterSpacing: "3px", color: P.c, textTransform: "uppercase", marginBottom: "10px" }}>
                  {isT ? "Maktkartet — kollektiv analyse" : mapMode === "place" ? `Plasser aktørene (${Object.keys(mapPl).length}/${MA.length})` : "Dine plasseringer vs. rommet"}
                </div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: "4px", marginBottom: "12px" }}>
                  {MA.map((a, i) => {
                    const isActive = mapMode === "place" && mapAi === i;
                    const isPlaced = !!mapPl[a.id];
                    return (
                      <button key={a.id} onClick={() => {
                        if (isT) return;
                        setMapAi(i);
                        if (mapMode !== "place") setMapMode("place");
                      }} style={{
                        padding: "4px 10px", fontSize: "11px",
                        background: isActive ? MC[i] : isPlaced ? `${MC[i]}15` : "transparent",
                        border: `1px solid ${isActive ? MC[i] : isPlaced ? `${MC[i]}40` : "#1C1C20"}`,
                        color: isActive ? "#E8E4DE" : isPlaced ? MC[i] : "#5A5650",
                        cursor: isT ? "default" : "pointer",
                        fontFamily: "'Georgia',serif", transition: "all .2s",
                      }}>{a.e} {a.name}{isPlaced && !isActive ? " ✓" : ""}</button>
                    );
                  })}
                </div>
                {mapMode === "place" && !isT && (
                  <p style={{ fontSize: "11px", color: MC[mapAi], marginBottom: "10px", fontStyle: "italic" }}>
                    Trykk på kartet for å plassere «{MA[mapAi].e} {MA[mapAi].name}»
                  </p>
                )}
                {/* Map */}
                <div ref={mapRef} onClick={e => {
                  if (isT || !mapRef.current || mapMode === "intro") return;
                  if (mapMode !== "place") return;
                  const r = mapRef.current.getBoundingClientRect();
                  const x = cl(((e.clientX - r.left) / r.width) * 100, 2, 98);
                  const y = cl(100 - ((e.clientY - r.top) / r.height) * 100, 2, 98);
                  setMapPl(p => ({ ...p, [MA[mapAi].id]: { x, y } }));
                  const dotId = uid();
                  setMapDots(p => [...p.filter(d => !(d.own && d.aid === MA[mapAi].id)), { id: dotId, aid: MA[mapAi].id, x, y, own: true }]);
                  bc("mapdot", { id: dotId, aid: MA[mapAi].id, x, y });
                  // Auto-advance to next unplaced actor
                  const nextUnplaced = MA.findIndex((a, idx) => idx > mapAi && !mapPl[a.id]);
                  if (nextUnplaced >= 0) {
                    setTimeout(() => setMapAi(nextUnplaced), 300);
                  } else {
                    const anyUnplaced = MA.findIndex(a => !mapPl[a.id] && a.id !== MA[mapAi].id);
                    if (anyUnplaced >= 0) setTimeout(() => setMapAi(anyUnplaced), 300);
                    else setTimeout(() => setMapMode("result"), 500);
                  }
                }} style={{ position: "relative", width: "100%", aspectRatio: isT ? "2.2/1" : "3/2", background: "#08080A", border: "1px solid #1C1C20", cursor: mapMode === "place" ? "crosshair" : "default", overflow: "hidden" }}>
                  {/* Axes */}
                  <div style={{ position: "absolute", top: "50%", left: "3%", right: "3%", height: "1px", background: "#4A609040" }} />
                  <div style={{ position: "absolute", left: "50%", top: "3%", bottom: "3%", width: "1px", background: "#4A609040" }} />
                  {/* Axis labels */}
                  <span style={{ position: "absolute", top: 8, left: "50%", transform: "translateX(-50%)", fontSize: "10px", color: "#9A958E", letterSpacing: "2px", fontWeight: "bold", background: "#08080Acc", padding: "1px 8px" }}>↑ STOR INNFLYTELSE</span>
                  <span style={{ position: "absolute", bottom: 8, left: "50%", transform: "translateX(-50%)", fontSize: "10px", color: "#9A958E", letterSpacing: "2px", fontWeight: "bold", background: "#08080Acc", padding: "1px 8px" }}>↓ LITEN INNFLYTELSE</span>
                  <span style={{ position: "absolute", left: 8, top: "50%", transform: "translateY(-50%) rotate(-90deg)", fontSize: "10px", color: "#9A958E", letterSpacing: "2px", fontWeight: "bold", background: "#08080Acc", padding: "1px 8px" }}>← USYNLIG</span>
                  <span style={{ position: "absolute", right: 8, top: "50%", transform: "translateY(-50%) rotate(90deg)", fontSize: "10px", color: "#9A958E", letterSpacing: "2px", fontWeight: "bold", background: "#08080Acc", padding: "1px 8px" }}>SYNLIG →</span>
                  {/* Quadrant labels — always visible */}
                  {[{ x: "25%", y: "25%", l: "Usynlig makt" }, { x: "75%", y: "25%", l: "Synlig makt" }, { x: "25%", y: "75%", l: "Marginalisert" }, { x: "75%", y: "75%", l: "Synlig uten makt" }].map((q, i) => <div key={i} style={{ position: "absolute", left: q.x, top: q.y, transform: "translate(-50%,-50%)", fontSize: isT ? "11px" : "10px", color: "#5A565040", letterSpacing: "1px", pointerEvents: "none", fontStyle: "italic" }}>{q.l}</div>)}
                  {mapDots.map(d => { const ai = MA.findIndex(a => a.id === d.aid); const isHov = hoveredActor === d.aid; return <div key={d.id} style={{ position: "absolute", left: `${d.x}%`, top: `${100 - d.y}%`, width: d.own ? 10 : isHov ? 6 : 4, height: d.own ? 10 : isHov ? 6 : 4, borderRadius: "50%", background: d.own ? MC[ai] : isHov ? MC[ai] : `${MC[ai]}35`, border: d.own ? `2px solid ${MC[ai]}` : "none", boxShadow: d.own ? `0 0 6px ${MC[ai]}30` : "none", transform: "translate(-50%,-50%)", transition: "all .2s", opacity: hoveredActor && !isHov && !d.own ? 0.15 : 1, zIndex: isHov ? 5 : 1 }} />; })}
                  {isT && MA.map((a, i) => { const d = mapAgg[a.id]; if (d.xs.length < 3) return null; const ax = d.xs.reduce((s, x) => s + x, 0) / d.xs.length; const ay = d.ys.reduce((s, y) => s + y, 0) / d.ys.length; const sx = Math.sqrt(d.xs.reduce((s, x) => s + (x - ax) ** 2, 0) / d.xs.length); const isHov = hoveredActor === a.id; return <div key={a.id} onMouseEnter={() => setHoveredActor(a.id)} onMouseLeave={() => setHoveredActor(null)} onTouchStart={() => setHoveredActor(a.id)} style={{ position: "absolute", left: `${ax}%`, top: `${100 - ay}%`, transform: `translate(-50%,-50%) scale(${isHov ? 1.15 : 1})`, background: isHov ? "#0E0E10" : "#0E0E10dd", border: `1px solid ${isHov ? MC[i] : MC[i] + "60"}`, padding: isHov ? "5px 12px" : "3px 8px", fontSize: isHov ? "12px" : "10px", color: "#E8E4DE", whiteSpace: "nowrap", cursor: "pointer", zIndex: isHov ? 100 : 10, transition: "all .15s ease", boxShadow: isHov ? `0 0 12px ${MC[i]}40` : "none" }}>{a.e} {a.name} <sup style={{ opacity: .5 }}>({d.xs.length}){sx > 12 ? " ⚡" : ""}</sup></div>; })}
                </div>
                <div style={{ marginTop: "8px", fontSize: "10px", color: "#3A3835", textAlign: "center" }}>{mapDots.length} plasseringer · {Object.keys(mapAgg).filter(k => mapAgg[k].xs.length > 0).length} aktører</div>
                {mapMode === "result" && !isT && (
                  <button onClick={() => { setMapMode("place"); setMapAi(0); setMapPl({}); }} style={{ display: "block", margin: "10px auto 0", background: "transparent", border: "1px solid #1C1C20", color: "#5A5650", padding: "6px 16px", fontSize: "10px", cursor: "pointer", fontFamily: "'Georgia',serif" }}>Plasser på nytt</button>
                )}
              </div>
            )}
          </div>
        )}

        {/* ═══ PERSPEKTIVBYTTE ═══ */}
        {act === "perspektiv" && phase === 1 && (() => {
          const allRoles = [...ROLES, ...customRoles];
          return (
          <div>
            {/* Assignment + writing */}
            <div style={{ background: "#0E0E10", border: "1px solid #1C1C20", padding: "20px", marginBottom: "16px" }}>
              <div style={{ fontSize: "10px", letterSpacing: "3px", color: P.c, textTransform: "uppercase", marginBottom: "8px" }}>Perspektivbytte</div>
              {!pRole && !isT ? (
                <div>
                  <p style={{ fontSize: "14px", color: "#9A958E", lineHeight: 1.7, marginBottom: "16px" }}>Du tildeles en tilfeldig posisjon. Argumenter <em style={{ color: "#E8E4DE" }}>fra</em> posisjonen, ikke <em>om</em> den. Du tvinges ut av din egen habitus.</p>
                  <button onClick={() => setPRole(pick(allRoles))} style={{ background: P.c, border: "none", color: "#E8E4DE", padding: "14px 36px", fontSize: "12px", cursor: "pointer", fontFamily: "'Georgia',serif", letterSpacing: "1px" }}>Tildel meg en posisjon</button>
                </div>
              ) : !isT && pRole ? (
                <div>
                  <div style={{ background: "#08080A", border: `1px solid ${pRole.c}40`, borderLeft: `4px solid ${pRole.c}`, padding: "16px", marginBottom: "14px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "6px" }}>
                      <span style={{ fontSize: "24px" }}>{pRole.e || "👤"}</span>
                      <div>
                        <div style={{ fontSize: "16px", color: "#E8E4DE" }}>{pRole.role}</div>
                        <div style={{ fontSize: "11px", color: pRole.c, fontStyle: "italic" }}>{pRole.desc}</div>
                      </div>
                    </div>
                  </div>
                  <textarea value={pInp} onChange={e => setPInp(e.target.value)} placeholder={`Argumenter som ${pRole.role.toLowerCase()}...`} style={{ width: "100%", boxSizing: "border-box", background: "#08080A", border: "1px solid #1C1C20", color: "#E8E4DE", fontSize: "13px", fontFamily: "'Georgia',serif", outline: "none", padding: "12px", lineHeight: 1.7, resize: "none", height: "75px" }} onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey && pInp.trim()) { e.preventDefault(); const pid = uid(); const pData = { id: pid, role: pRole.role, c: pRole.c, e: pRole.e || "👤", text: pInp, ts: Date.now() }; setPersp(p => [{ ...pData, own: true }, ...p]); bc("persp", pData); setPInp(""); }}} />
                  <div style={{ display: "flex", gap: "8px", marginTop: "8px" }}>
                    <button onClick={() => { if (pInp.trim()) { const pid = uid(); const pData = { id: pid, role: pRole.role, c: pRole.c, e: pRole.e || "👤", text: pInp, ts: Date.now() }; setPersp(p => [{ ...pData, own: true }, ...p]); bc("persp", pData); setPInp(""); } }} style={{ flex: 1, background: pRole.c, border: "none", color: "#E8E4DE", padding: "10px", fontSize: "11px", cursor: "pointer", fontFamily: "'Georgia',serif" }}>Del perspektiv</button>
                    <button onClick={() => setPRole(pick(allRoles))} style={{ background: "transparent", border: `1px solid ${pRole.c}`, color: pRole.c, padding: "10px 16px", fontSize: "11px", cursor: "pointer", fontFamily: "'Georgia',serif" }}>Ny rolle ↻</button>
                  </div>
                </div>
              ) : null}
              {/* All available roles — collapsed overview */}
              {isT && (
                <div>
                  <div style={{ fontSize: "10px", letterSpacing: "2px", color: "#5A5650", marginBottom: "8px" }}>TILGJENGELIGE ROLLER ({allRoles.length})</div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: "4px" }}>
                    {allRoles.map((r, i) => (
                      <span key={i} style={{ padding: "3px 8px", fontSize: "10px", border: `1px solid ${r.c}30`, color: r.c, background: `${r.c}08` }}>{r.e || "👤"} {r.role}</span>
                    ))}
                  </div>
                  {customRoles.length > 0 && <p style={{ fontSize: "10px", color: "#5A8060", marginTop: "6px", fontStyle: "italic" }}>+{customRoles.length} roller lagt til av studenter via Blindsonejakten</p>}
                </div>
              )}
            </div>
            {/* Perspektiv feed */}
            {persp.length > 0 && (
              <div style={{ background: "#0E0E10", border: "1px solid #1C1C20", padding: "20px" }}>
                <div style={{ fontSize: "10px", letterSpacing: "3px", color: "#5A5650", textTransform: "uppercase", marginBottom: "12px" }}>{persp.length} perspektiver delt</div>
                <div style={{ display: "flex", flexDirection: "column", gap: "5px" }}>
                  {persp.slice(0, isT ? 20 : 12).map((p, i) => (
                    <div key={p.id} style={{ padding: "12px 16px", background: p.own ? `${p.c}10` : "#0A0A0C", border: `1px solid ${p.own ? p.c + "30" : "#141416"}`, borderLeft: `3px solid ${p.c}`, animation: i < 2 ? "fadeUp .4s ease" : undefined }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "5px", marginBottom: "3px" }}>
                        <span style={{ fontSize: "12px" }}>{p.e || ""}</span>
                        <span style={{ fontSize: "9px", color: p.c, letterSpacing: "1px", textTransform: "uppercase" }}>{p.role}</span>
                      </div>
                      <p style={{ margin: 0, fontSize: "12px", color: p.own ? "#E8E4DE" : "#7A756F", lineHeight: 1.6 }}>{p.text}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
          );
        })()}

        {/* ═══ VERDILINJEN ═══ */}
        {act === "verdilinje" && phase === 1 && (() => {
          const themeIdx = pi % customThemes.length;
          const stmt = customThemes[themeIdx].stmt;
          const themeLabel = customThemes[themeIdx].theme;
          return (
            <div>
              <div style={{ background: "#0E0E10", border: "1px solid #1C1C20", borderLeft: `3px solid ${P.c}`, padding: "20px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "10px" }}>
                  <div style={{ fontSize: "10px", letterSpacing: "3px", color: P.c, textTransform: "uppercase" }}>Verdilinjen</div>
                  <span style={{ fontSize: "9px", color: "#5A5650", border: "1px solid #1C1C20", padding: "2px 8px" }}>Tema: {themeLabel}</span>
                </div>
                <p style={{ fontSize: isT ? "20px" : "16px", fontStyle: "italic", lineHeight: 1.5, margin: "0 0 8px" }}>«{stmt.text}»</p>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: "11px", color: "#5A5650", marginBottom: "16px" }}>
                  <span>← {stmt.l}</span><span>{stmt.r} →</span>
                </div>
                {!isT && !vVoted && (
                  <div>
                    <input type="range" min="0" max="100" value={vRange} onChange={e => setVRange(Number(e.target.value))} style={{ width: "100%", accentColor: P.c, WebkitAppearance: "none", height: "6px", background: "#1C1C20", borderRadius: "3px", outline: "none" }} />
                    <button onClick={() => { const vid = uid(); setVVotes(p => [...p, { id: vid, v: vRange, si: themeIdx }]); setVVoted(true); bc("vvote", { id: vid, v: vRange, si: themeIdx }); }} style={{ marginTop: "10px", background: P.c, border: "none", color: "#E8E4DE", padding: "10px 24px", fontSize: "11px", cursor: "pointer", fontFamily: "'Georgia',serif" }}>Stem</button>
                  </div>
                )}
                {vVoted && !isT && <p style={{ fontSize: "12px", color: "#5A8060", fontStyle: "italic" }}>✓ Registrert.</p>}
                {isT && <p style={{ fontSize: "10px", color: "#5A5650", fontStyle: "italic", marginTop: "6px" }}>Påstanden følger det aktive spørsmålet. Bytt spørsmål i spørsmålslinjen for å endre.</p>}
              </div>
              {curVotes.length > 3 && (
                <div style={{ background: "#0E0E10", border: "1px solid #1C1C20", padding: "20px", marginTop: "12px" }}>
                  <div style={{ fontSize: "10px", letterSpacing: "3px", color: "#5A5650", textTransform: "uppercase", marginBottom: "10px" }}>Fordeling — {curVotes.length} stemmer</div>
                  <div style={{ display: "flex", gap: "2px", alignItems: "flex-end", height: isT ? "90px" : "60px" }}>
                    {vBuckets.map((n, i) => <div key={i} style={{ flex: 1, width: "100%", height: `${(n / vMaxB) * (isT ? 80 : 50)}px`, background: `${P.c}${cl(30 + Math.round((n / vMaxB) * 50), 30, 80)}`, transition: "height .5s", minHeight: n > 0 ? "2px" : 0 }} />)}
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: "9px", color: "#3A3835", marginTop: "4px" }}><span>{stmt.l}</span><span>{stmt.r}</span></div>
                  <p style={{ fontSize: "11px", color: "#5A5650", marginTop: "8px", textAlign: "center" }}>Gjennomsnitt: {vAvg.toFixed(0)}% — Hvor er spenningene?</p>
                </div>
              )}
            </div>
          );
        })()}

        {/* ═══ MIKRO-DIALOG ═══ */}
        {act === "mikrodialog" && phase === 2 && (() => {
          if (mdScreen === "lobby") return (
            <div>
              {isT ? (
                <div style={{ background: "#0E0E10", border: "1px solid #1C1C20", padding: "24px" }}>
                  <div style={{ fontSize: "10px", letterSpacing: "3px", color: P.c, textTransform: "uppercase", marginBottom: "14px" }}>Mikro-dialog — parvise møter</div>
                  <p style={{ fontSize: "13px", color: "#9A958E", lineHeight: 1.6, marginBottom: "16px" }}>Studentene pares med noen de ikke har jobbet med. De deler hva de oppdaget i utforskningsfasen — og konfronterer sine funn med partnerens.</p>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", marginBottom: "20px" }}>
                    <div style={{ padding: "20px", border: "1px solid #5A806040", cursor: "pointer" }} onClick={() => startMd("fysisk")}>
                      <div style={{ fontSize: "20px", marginBottom: "6px" }}>🤝</div>
                      <h3 style={{ fontSize: "15px", fontWeight: 400, margin: "0 0 6px" }}>Finn din partner</h3>
                      <p style={{ fontSize: "11px", color: "#9A958E", lineHeight: 1.6, margin: 0 }}>Studentene får felles kode, finner partneren sin i rommet, 5 min ansikt-til-ansikt.</p>
                      <div style={{ marginTop: "8px", padding: "5px 8px", background: "#08080A", fontSize: "10px", color: "#5A8060" }}>Best for: Bryte habitus-mønstre, kroppslig dialog</div>
                    </div>
                    <div style={{ padding: "20px", border: "1px solid #4A609040", cursor: "pointer" }} onClick={() => startMd("stille")}>
                      <div style={{ fontSize: "20px", marginBottom: "6px" }}>💬</div>
                      <h3 style={{ fontSize: "15px", fontWeight: 400, margin: "0 0 6px" }}>Stille dialog</h3>
                      <p style={{ fontSize: "11px", color: "#9A958E", lineHeight: 1.6, margin: 0 }}>Anonym skriftlig 1:1 i chat. Ideal for auditorier — ingen trenger å flytte seg.</p>
                      <div style={{ marginTop: "8px", padding: "5px 8px", background: "#08080A", fontSize: "10px", color: "#4A6090" }}>Best for: Trygge marginaliserte stemmer, første runde</div>
                    </div>
                  </div>
                  {mdInsights.length > 0 && (
                    <div>
                      <div style={{ fontSize: "10px", letterSpacing: "3px", color: "#5A5650", textTransform: "uppercase", marginBottom: "10px" }}>Innsikter fra tidligere runder — {mdInsights.length}</div>
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "5px" }}>
                        {mdInsights.slice(0, 12).map((ins, i) => <div key={ins.id} style={{ padding: "10px 12px", background: ins.own ? `${P.c}08` : "#0A0A0C", border: `1px solid ${ins.own ? P.c + "25" : "#141416"}` }}><p style={{ margin: 0, fontSize: "11px", lineHeight: 1.5, color: ins.own ? "#E8E4DE" : "#7A756F" }}>{ins.text}</p></div>)}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div style={{ background: "#0E0E10", border: "1px solid #1C1C20", padding: "32px", textAlign: "center" }}>
                  <div style={{ fontSize: "10px", letterSpacing: "4px", color: P.c, marginBottom: "20px", textTransform: "uppercase" }}>Dialog-fasen</div>
                  <h3 style={{ fontSize: "22px", fontWeight: 400, marginBottom: "8px" }}>Mikro-dialog</h3>
                  <p style={{ color: "#9A958E", fontSize: "14px", lineHeight: 1.7, marginBottom: "8px" }}>Du pares med en medstudent du ikke har jobbet med.</p>
                  <p style={{ color: "#5A5650", fontSize: "12px", lineHeight: 1.6, marginBottom: "24px", fontStyle: "italic" }}>Del hva du oppdaget i utforskningsfasen. Lytt til hva partneren din fant. Hva er likt — og hva overrasker?</p>
                  <p style={{ fontSize: "12px", color: "#5A5650" }}>Venter på at underviser velger modus...</p>
                  <div style={{ display: "flex", gap: "8px", justifyContent: "center", marginTop: "16px" }}>
                    <button onClick={() => startMd("fysisk")} style={{ background: "#5A8060", border: "none", color: "#E8E4DE", padding: "10px 20px", fontSize: "11px", cursor: "pointer", fontFamily: "'Georgia',serif" }}>Demo: Fysisk</button>
                    <button onClick={() => startMd("stille")} style={{ background: "#4A6090", border: "none", color: "#E8E4DE", padding: "10px 20px", fontSize: "11px", cursor: "pointer", fontFamily: "'Georgia',serif" }}>Demo: Stille</button>
                  </div>
                </div>
              )}
            </div>
          );

          if (mdScreen === "fysisk") return (
            <div>
              {!mdFound ? (
                <div style={{ background: "#0E0E10", border: "1px solid #1C1C20", padding: "32px", textAlign: "center" }}>
                  <div style={{ fontSize: "10px", letterSpacing: "4px", color: "#5A5650", marginBottom: "20px", textTransform: "uppercase" }}>Finn din partner</div>
                  <div style={{ display: "inline-flex", alignItems: "center", gap: "16px", background: "#141416", border: "2px solid #5A8060", padding: "20px 32px", marginBottom: "20px" }}>
                    <span style={{ fontSize: "40px" }}>{mdPartner?.emoji}</span>
                    <div style={{ textAlign: "left" }}>
                      <div style={{ fontSize: "9px", color: "#5A5650", letterSpacing: "2px" }}>DIN KODE</div>
                      <div style={{ fontSize: "28px", color: "#5A8060", fontFamily: "monospace", letterSpacing: "4px" }}>{mdPartner?.color} {mdPartner?.num}</div>
                    </div>
                  </div>
                  <p style={{ color: "#9A958E", fontSize: "14px", marginBottom: "6px" }}><strong style={{ color: "#E8E4DE" }}>Reis deg opp</strong> og finn personen med samme kode.</p>
                  <p style={{ color: "#5A5650", fontSize: "12px", marginBottom: "24px" }}>Del hva du oppdaget i utforskningsfasen.</p>
                  <button onClick={() => { setMdFound(true); setMdTA(true); }} style={{ background: "#5A8060", border: "none", color: "#E8E4DE", padding: "14px 32px", fontSize: "13px", cursor: "pointer", fontFamily: "'Georgia',serif" }}>Vi har funnet hverandre — start</button>
                </div>
              ) : (
                <div>
                  <div style={{ textAlign: "center", marginBottom: "20px" }}>
                    <div style={{ fontSize: "44px", fontWeight: 300, fontFamily: "monospace", color: mdTimer < 60 ? "#C06840" : "#5A8060" }}>{fmt(mdTimer)}</div>
                    <div style={{ fontSize: "10px", color: "#5A5650", letterSpacing: "2px" }}>{mdTimer > 240 ? "DEL DINE FUNN" : mdTimer > 120 ? "SAMMENLIGN PERSPEKTIVER" : mdTimer > 60 ? "UTFORDRE ANTAKELSER" : mdTimer > 0 ? "AVSLUTT SNART" : "TIDEN ER UTE"}</div>
                  </div>
                  <div style={{ background: "#0E0E10", border: "1px solid #1C1C20", borderLeft: "3px solid #5A8060", padding: "20px", marginBottom: "16px" }}>
                    <div style={{ fontSize: "10px", letterSpacing: "3px", color: "#5A8060", textTransform: "uppercase", marginBottom: "8px" }}>Samtalespørsmål</div>
                    <p style={{ fontSize: "17px", fontStyle: "italic", lineHeight: 1.5, margin: "0 0 4px" }}>«{curDPrompt.q}»</p>
                    <p style={{ fontSize: "10px", color: "#5A5650", margin: 0 }}>{curDPrompt.src}</p>
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "6px", marginBottom: "16px" }}>
                    {[{ t: "0–2 min", tip: "Del hva du fant i utforskningsfasen.", c: "#5A8060" }, { t: "2–4 min", tip: "Hva er likt og ulikt mellom dere?", c: "#4A6090" }, { t: "4–5 min", tip: "Utfordre hverandres antakelser.", c: "#C06840" }].map(p => (
                      <div key={p.t} style={{ padding: "10px", background: "#08080A", border: `1px solid ${p.c}20`, opacity: mdTimer > 180 && p.t === "0–2 min" ? 1 : mdTimer <= 180 && mdTimer > 60 && p.t === "2–4 min" ? 1 : mdTimer <= 60 && p.t === "4–5 min" ? 1 : .3, transition: "opacity .5s" }}>
                        <div style={{ fontSize: "10px", color: p.c, marginBottom: "3px" }}>{p.t}</div>
                        <div style={{ fontSize: "11px", color: "#9A958E", lineHeight: 1.4 }}>{p.tip}</div>
                      </div>
                    ))}
                  </div>
                  {mdTimer === 0 && (
                    <div style={{ background: "#0E0E10", border: "1px solid #1C1C20", borderLeft: "3px solid #C06840", padding: "20px", animation: "fadeUp .5s ease" }}>
                      <div style={{ fontSize: "10px", letterSpacing: "3px", color: "#C06840", textTransform: "uppercase", marginBottom: "10px" }}>Hva oppdaget du i dialogen?</div>
                      <div style={{ display: "flex", gap: "8px" }}>
                        <input value={mdInsight} onChange={e => setMdInsight(e.target.value)} placeholder="Én innsikt..." style={{ flex: 1, background: "#08080A", border: "1px solid #1C1C20", color: "#E8E4DE", fontSize: "13px", fontFamily: "'Georgia',serif", outline: "none", padding: "12px" }} onKeyDown={e => { if (e.key === "Enter" && mdInsight.trim()) { setMdInsights(p => [{ id: uid(), text: mdInsight, own: true }, ...p]); setMdInsight(""); setMdScreen("debrief"); } }} />
                        <button onClick={() => { if (mdInsight.trim()) { setMdInsights(p => [{ id: uid(), text: mdInsight, own: true }, ...p]); setMdInsight(""); setMdScreen("debrief"); } }} style={{ background: "#C06840", border: "none", color: "#E8E4DE", padding: "12px 20px", fontSize: "11px", cursor: "pointer", fontFamily: "'Georgia',serif" }}>Del</button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          );

          if (mdScreen === "stille") return (
            <div style={{ display: "flex", flexDirection: "column", height: "75vh", background: "#08080A", border: "1px solid #1C1C20", borderRadius: "12px", overflow: "hidden" }}>
              {/* Chat header */}
              <div style={{ padding: "12px 16px", background: "#0E0E10", borderBottom: "1px solid #1C1C20" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                    <div style={{ width: "32px", height: "32px", borderRadius: "50%", background: "#4A609030", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "14px" }}>💬</div>
                    <div>
                      <div style={{ fontSize: "13px", color: "#E8E4DE", fontWeight: 500 }}>Stille dialog · Runde {mdRound}</div>
                      <div style={{ fontSize: "10px", color: "#5A8060" }}>● Anonym partner tilkoblet</div>
                    </div>
                  </div>
                  <span style={{ fontSize: "16px", fontFamily: "monospace", color: mdTimer < 60 ? "#C06840" : "#4A6090", fontWeight: "bold" }}>{fmt(mdTimer)}</span>
                </div>
              </div>
              {/* Prompt banner */}
              <div style={{ padding: "8px 16px", background: "#4A609010", borderBottom: "1px solid #1C1C20" }}>
                <p style={{ fontSize: "11px", fontStyle: "italic", color: "#7A756F", margin: 0, textAlign: "center", lineHeight: 1.4 }}>«{curDPrompt.q}» — {curDPrompt.src}</p>
              </div>
              {/* Chat messages */}
              <div style={{ flex: 1, overflowY: "auto", padding: "16px", display: "flex", flexDirection: "column", gap: "6px" }}>
                {mdChat.length === 0 && (
                  <div style={{ textAlign: "center", padding: "40px 20px" }}>
                    <div style={{ fontSize: "28px", marginBottom: "12px", opacity: .3 }}>💬</div>
                    <p style={{ fontSize: "12px", color: "#3A3835", lineHeight: 1.6 }}>Del hva du oppdaget i utforskningsfasen.<br/>Partneren din ser ikke hvem du er.</p>
                  </div>
                )}
                {mdChat.map((m, i) => {
                  const isMe = m.from === "me";
                  const showLabel = i === 0 || mdChat[i - 1].from !== m.from;
                  return (
                    <div key={m.id} style={{ display: "flex", flexDirection: "column", alignItems: isMe ? "flex-end" : "flex-start", animation: "fadeUp .25s ease" }}>
                      {showLabel && <div style={{ fontSize: "9px", color: isMe ? "#4A6090" : "#907050", letterSpacing: "1px", marginBottom: "2px", padding: isMe ? "0 12px 0 0" : "0 0 0 12px" }}>{isMe ? "DU" : "PARTNER"}</div>}
                      <div style={{
                        maxWidth: "78%", padding: "10px 14px",
                        background: isMe ? "#4A6090" : "#1C1C20",
                        color: "#E8E4DE",
                        borderRadius: isMe ? "18px 18px 4px 18px" : "18px 18px 18px 4px",
                        fontSize: "13px", lineHeight: 1.55,
                      }}>{m.text}</div>
                    </div>
                  );
                })}
                {partnerTyping && (
                  <div style={{ display: "flex", alignItems: "flex-start", animation: "fadeUp .2s ease" }}>
                    <div style={{ padding: "10px 16px", background: "#1C1C20", borderRadius: "18px 18px 18px 4px", display: "flex", gap: "4px", alignItems: "center" }}>
                      <span style={{ width: "6px", height: "6px", borderRadius: "50%", background: "#5A5650", display: "inline-block", animation: "typingDot 1.2s infinite ease-in-out" }} />
                      <span style={{ width: "6px", height: "6px", borderRadius: "50%", background: "#5A5650", display: "inline-block", animation: "typingDot 1.2s infinite ease-in-out .2s" }} />
                      <span style={{ width: "6px", height: "6px", borderRadius: "50%", background: "#5A5650", display: "inline-block", animation: "typingDot 1.2s infinite ease-in-out .4s" }} />
                    </div>
                  </div>
                )}
                <div ref={chatEnd} />
              </div>
              {/* Input area */}
              <div style={{ padding: "10px 12px", background: "#0E0E10", borderTop: "1px solid #1C1C20" }}>
                {mdTimer > 0 ? (
                  <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                    <input value={mdCI} onChange={e => setMdCI(e.target.value)} placeholder="Skriv en melding..." style={{ flex: 1, background: "#141416", border: "1px solid #1C1C20", color: "#E8E4DE", fontSize: "14px", fontFamily: "'Georgia',serif", outline: "none", padding: "12px 18px", borderRadius: "24px" }} onKeyDown={e => { if (e.key === "Enter" && mdCI.trim()) { setMdChat(p => [...p, { id: uid(), text: mdCI, from: "me" }]); setMdCI(""); } }} />
                    <button onClick={() => { if (mdCI.trim()) { setMdChat(p => [...p, { id: uid(), text: mdCI, from: "me" }]); setMdCI(""); } }} style={{ width: "42px", height: "42px", borderRadius: "50%", background: mdCI.trim() ? "#4A6090" : "#1C1C20", border: "none", color: "#E8E4DE", fontSize: "16px", cursor: mdCI.trim() ? "pointer" : "default", display: "flex", alignItems: "center", justifyContent: "center", transition: "background .2s" }}>↑</button>
                  </div>
                ) : (
                  <div>
                    <div style={{ textAlign: "center", marginBottom: "8px" }}>
                      <span style={{ fontSize: "10px", color: "#C06840", letterSpacing: "2px" }}>TIDEN ER UTE — HVA OPPDAGET DU?</span>
                    </div>
                    <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                      <input value={mdInsight} onChange={e => setMdInsight(e.target.value)} placeholder="Én innsikt fra dialogen..." style={{ flex: 1, background: "#141416", border: "1px solid #C0684040", color: "#E8E4DE", fontSize: "14px", fontFamily: "'Georgia',serif", outline: "none", padding: "12px 18px", borderRadius: "24px" }} onKeyDown={e => { if (e.key === "Enter" && mdInsight.trim()) { setMdInsights(p => [{ id: uid(), text: mdInsight, own: true }, ...p]); setMdInsight(""); setMdScreen("debrief"); } }} />
                      <button onClick={() => { if (mdInsight.trim()) { setMdInsights(p => [{ id: uid(), text: mdInsight, own: true }, ...p]); setMdInsight(""); setMdScreen("debrief"); } }} style={{ background: "#C06840", border: "none", color: "#E8E4DE", padding: "12px 20px", borderRadius: "24px", fontSize: "11px", cursor: "pointer", fontFamily: "'Georgia',serif" }}>Del</button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          );

          if (mdScreen === "debrief") return (
            <div style={{ background: "#0E0E10", border: "1px solid #1C1C20", padding: "24px" }}>
              <div style={{ fontSize: "10px", letterSpacing: "3px", color: P.c, textTransform: "uppercase", marginBottom: "14px" }}>Innsikter fra runde {mdRound}</div>
              <div style={{ display: "grid", gridTemplateColumns: isT ? "1fr 1fr" : "1fr", gap: "5px" }}>
                {mdInsights.slice(0, 16).map((ins, i) => (
                  <div key={ins.id} style={{ padding: "10px 14px", background: ins.own ? `${P.c}08` : "#08080A", border: `1px solid ${ins.own ? P.c + "25" : "#141416"}`, animation: i < 2 ? "fadeUp .4s ease" : undefined }}>
                    <p style={{ margin: 0, fontSize: "12px", lineHeight: 1.6, color: ins.own ? "#E8E4DE" : "#7A756F" }}>{ins.text}</p>
                  </div>
                ))}
              </div>
              <button onClick={() => setMdScreen("lobby")} style={{ marginTop: "16px", background: "transparent", border: `1px solid ${P.c}40`, color: P.c, padding: "8px 20px", fontSize: "10px", cursor: "pointer", fontFamily: "'Georgia',serif" }}>Tilbake (ny runde)</button>
            </div>
          );
          return null;
        })()}

        {/* ═══ BLINDSONE ═══ */}
        {act === "blindsone" && phase === 2 && (
          <div>
            <div style={{ background: "#0E0E10", border: "1px solid #1C1C20", borderLeft: `3px solid ${P.c}`, padding: "20px" }}>
              <div style={{ fontSize: "10px", letterSpacing: "3px", color: P.c, textTransform: "uppercase", marginBottom: "10px" }}>Blindsonejakten</div>
              <p style={{ fontSize: isT ? "18px" : "15px", fontStyle: "italic", lineHeight: 1.5, margin: "0 0 14px" }}>«{BLIND_Q[bIdx % BLIND_Q.length]}»</p>
              {!isT && (
                <div style={{ display: "flex", gap: "8px" }}>
                  <input value={bInp} onChange={e => setBInp(e.target.value)} placeholder="Hvem/hva er usynlig..." style={{ flex: 1, background: "#08080A", border: "1px solid #1C1C20", color: "#E8E4DE", fontSize: "13px", fontFamily: "'Georgia',serif", outline: "none", padding: "10px 14px" }} onKeyDown={e => { if (e.key === "Enter" && bInp.trim()) { const bid = uid(); setBlinds(p => [{ id: bid, text: bInp, ts: Date.now(), own: true }, ...p]); bc("blind", { id: bid, text: bInp, ts: Date.now() }); setBInp(""); } }} />
                  <button onClick={() => { if (bInp.trim()) { const bid = uid(); setBlinds(p => [{ id: bid, text: bInp, ts: Date.now(), own: true }, ...p]); bc("blind", { id: bid, text: bInp, ts: Date.now() }); setBInp(""); } }} style={{ background: P.c, border: "none", color: "#E8E4DE", padding: "10px 20px", fontSize: "11px", cursor: "pointer", fontFamily: "'Georgia',serif" }}>Del</button>
                </div>
              )}
              {isT && <button onClick={() => setBIdx(p => p + 1)} style={{ background: "transparent", border: `1px solid ${P.c}40`, color: P.c, padding: "5px 14px", fontSize: "10px", cursor: "pointer", fontFamily: "'Georgia',serif" }}>Neste →</button>}
            </div>
            <div style={{ display: "grid", gridTemplateColumns: isT ? "1fr 1fr 1fr" : "1fr 1fr", gap: "5px", marginTop: "12px" }}>
              {blinds.slice(0, isT ? 18 : 12).map((b, i) => (
                <div key={b.id} style={{ padding: "10px 14px", background: b.own ? `${P.c}08` : "#0A0A0C", border: `1px solid ${b.own ? P.c + "25" : "#141416"}`, animation: i < 2 ? "fadeUp .4s ease" : undefined }}>
                  <p style={{ margin: 0, fontSize: "12px", lineHeight: 1.6, color: b.own ? "#E8E4DE" : "#7A756F" }}>{b.text}</p>
                </div>
              ))}
            </div>

            {/* ── Foreslå ny rolle ── */}
            <div style={{ background: "#0E0E10", border: "1px solid #1C1C20", borderLeft: "3px solid #5A8060", padding: "20px", marginTop: "16px" }}>
              <div style={{ fontSize: "10px", letterSpacing: "3px", color: "#5A8060", textTransform: "uppercase", marginBottom: "8px" }}>Foreslå ny rolle til Perspektivbytte</div>
              <p style={{ fontSize: "12px", color: "#9A958E", lineHeight: 1.5, marginBottom: "12px" }}>Hvem mangler blant rollene? Opprett en ny posisjon som alle kan bli tildelt.</p>
              {!isT && (
                <div>
                  <div style={{ display: "flex", gap: "8px", marginBottom: "6px" }}>
                    <input value={newRoleName} onChange={e => setNewRoleName(e.target.value)} placeholder="Rolle (f.eks. «Skeiv ungdom»)" style={{ flex: 1, background: "#08080A", border: "1px solid #1C1C20", color: "#E8E4DE", fontSize: "13px", fontFamily: "'Georgia',serif", outline: "none", padding: "10px 14px" }} />
                  </div>
                  <div style={{ display: "flex", gap: "8px" }}>
                    <input value={newRoleDesc} onChange={e => setNewRoleDesc(e.target.value)} placeholder="Kort beskrivelse (f.eks. «Usynlig i pensum, synlig i smerten»)" style={{ flex: 1, background: "#08080A", border: "1px solid #1C1C20", color: "#E8E4DE", fontSize: "12px", fontFamily: "'Georgia',serif", outline: "none", padding: "10px 14px" }} onKeyDown={e => { if (e.key === "Enter" && newRoleName.trim()) { const cols = ["#C06840","#4A6090","#5A8060","#907050","#7A4A70","#5A8A7A","#8A6A40","#6A5A8A","#8A5050","#4A7A7A"]; setCustomRoles(p => [...p, { role: newRoleName, desc: newRoleDesc || "Opprettet av student", c: pick(cols), e: "👤" }]); setBlinds(p => [{ id: uid(), text: `Ny rolle opprettet: ${newRoleName}`, ts: Date.now(), own: true, isRole: true }, ...p]); setNewRoleName(""); setNewRoleDesc(""); }}} />
                    <button onClick={() => { if (newRoleName.trim()) { const cols = ["#C06840","#4A6090","#5A8060","#907050","#7A4A70","#5A8A7A","#8A6A40","#6A5A8A","#8A5050","#4A7A7A"]; const c = pick(cols); setCustomRoles(p => [...p, { role: newRoleName, desc: newRoleDesc || "Opprettet av student", c, e: "👤" }]); const bid = uid(); setBlinds(p => [{ id: bid, text: `Ny rolle opprettet: ${newRoleName}`, ts: Date.now(), own: true, isRole: true }, ...p]); bc("blind", { id: bid, text: `Ny rolle opprettet: ${newRoleName}`, ts: Date.now() }); bc("newrole", { role: newRoleName, e: "👤", c }); setNewRoleName(""); setNewRoleDesc(""); }}} style={{ background: "#5A8060", border: "none", color: "#E8E4DE", padding: "10px 16px", fontSize: "11px", cursor: "pointer", fontFamily: "'Georgia',serif", whiteSpace: "nowrap" }}>+ Opprett rolle</button>
                  </div>
                </div>
              )}
              {customRoles.length > 0 && (
                <div style={{ marginTop: "12px" }}>
                  <div style={{ fontSize: "9px", color: "#5A8060", letterSpacing: "2px", marginBottom: "6px" }}>NYE ROLLER OPPRETTET ({customRoles.length})</div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: "4px" }}>
                    {customRoles.map((r, i) => (
                      <span key={i} style={{ padding: "4px 10px", fontSize: "11px", border: `1px solid ${r.c}40`, color: r.c, background: `${r.c}08` }}>👤 {r.role}</span>
                    ))}
                  </div>
                  <p style={{ fontSize: "10px", color: "#5A8060", marginTop: "6px", fontStyle: "italic" }}>Disse rollene er nå tilgjengelige i Perspektivbytte.</p>
                </div>
              )}
              {isT && customRoles.length > 0 && (
                <p style={{ fontSize: "11px", color: "#5A8060", marginTop: "10px" }}>Studentene har opprettet {customRoles.length} nye roller. Vurder å bytte tilbake til Perspektivbytte for å la studentene argumentere fra disse posisjonene.</p>
              )}
            </div>
          </div>
        )}

        {/* ═══ DIAMANT ═══ */}
        {act === "diamant" && phase === 3 && (
          <div style={{ background: "#0E0E10", border: "1px solid #1C1C20", padding: "20px" }}>
            <div style={{ fontSize: "10px", letterSpacing: "3px", color: P.c, textTransform: "uppercase", marginBottom: "10px" }}>Diamantrangering — {dTopic}</div>
            <p style={{ fontSize: "13px", color: "#9A958E", margin: "0 0 6px", fontStyle: "italic", lineHeight: 1.6 }}>Ranger 9 begreper i en diamantform: 1 viktigst → 2 → 3 i midten → 2 → 1 minst viktig.</p>
            <p style={{ fontSize: "11px", color: "#5A5650", margin: "0 0 16px" }}>Trykk på begrepene i den rekkefølgen du vil rangere dem. Trykk igjen for å fjerne.</p>
            {!dDone && !isT && (
              <div style={{ display: "flex", flexWrap: "wrap", gap: "6px", marginBottom: "14px" }}>
                {(DIAMANT[dTopic] || []).map(item => (
                  <button key={item} onClick={() => setDRank(p => p.includes(item) ? p.filter(x => x !== item) : p.length < 9 ? [...p, item] : p)} style={{ padding: "6px 14px", fontSize: "12px", background: dRank.includes(item) ? `${P.c}20` : "transparent", border: `1px solid ${dRank.includes(item) ? P.c : "#1C1C20"}`, color: dRank.includes(item) ? P.c : "#5A5650", cursor: "pointer", fontFamily: "'Georgia',serif", transition: "all .2s" }}>
                    {dRank.includes(item) ? `${dRank.indexOf(item) + 1}. ` : ""}{item}
                  </button>
                ))}
              </div>
            )}
            {!dDone && !isT && <p style={{ fontSize: "11px", color: P.c, marginBottom: "10px" }}>{dRank.length}/9 valgt</p>}
            {dRank.length === 9 && !dDone && !isT && (
              <button onClick={() => setDDone(true)} style={{ background: P.c, border: "none", color: "#E8E4DE", padding: "10px 24px", fontSize: "11px", cursor: "pointer", fontFamily: "'Georgia',serif", marginBottom: "14px", display: "block" }}>Send rangering</button>
            )}
            {(dDone || (isT && dRank.length === 9)) && (
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "4px", marginTop: "10px" }}>
                {[1, 2, 3, 2, 1].map((count, ri) => {
                  const start = [1, 2, 3, 2, 1].slice(0, ri).reduce((a, b) => a + b, 0);
                  const lbl = ["Viktigst", "", "Midten", "", "Minst viktig"][ri];
                  return (
                    <div key={ri} style={{ display: "flex", gap: "4px", alignItems: "center" }}>
                      {lbl && <span style={{ fontSize: "9px", color: "#5A5650", width: "65px", textAlign: "right", marginRight: "6px" }}>{lbl}</span>}
                      {!lbl && <span style={{ width: "71px" }} />}
                      {Array.from({ length: count }).map((_, i) => (
                        <div key={i} style={{ padding: "8px 14px", background: `${P.c}${15 + (4 - ri) * 12}`, border: `1px solid ${P.c}30`, fontSize: "12px", textAlign: "center", minWidth: "90px", color: "#E8E4DE" }}>
                          {dRank[start + i] || "—"}
                        </div>
                      ))}
                    </div>
                  );
                })}
              </div>
            )}
            {dDone && <p style={{ fontSize: "11px", color: "#5A5650", marginTop: "14px", textAlign: "center", fontStyle: "italic" }}>Din rangering er delt. Hva forteller den om dine verdier og blindsoner?</p>}
            {isT && (
              <div style={{ marginTop: "14px", borderTop: "1px solid #1C1C20", paddingTop: "12px" }}>
                <div style={{ fontSize: "10px", color: "#5A5650", marginBottom: "8px", letterSpacing: "2px" }}>VELG TEMA:</div>
                {Object.keys(DIAMANT).map(t => (
                  <button key={t} onClick={() => { setDTopic(t); setDRank([]); setDDone(false); }} style={{ marginRight: "6px", padding: "5px 12px", fontSize: "10px", background: dTopic === t ? P.c : "transparent", border: `1px solid ${dTopic === t ? P.c : "#1C1C20"}`, color: dTopic === t ? "#E8E4DE" : "#5A5650", cursor: "pointer", fontFamily: "'Georgia',serif" }}>{t}</button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ═══ HVEM SNAKKER? ═══ */}
        {act === "analyse" && phase === 3 && (
          <div style={{ display: "grid", gridTemplateColumns: isT ? "1fr 1fr" : "1fr", gap: "20px" }}>
            <div style={{ background: "#0E0E10", border: "1px solid #1C1C20", borderLeft: `3px solid ${P.c}`, padding: "20px" }}>
              <div style={{ fontSize: "10px", letterSpacing: "3px", color: P.c, textTransform: "uppercase", marginBottom: "12px" }}>Hvem snakker?</div>
              {(() => {
                const total = voices.length;
                const mine = voices.filter(v => v.own).length;
                const uniqs = new Set(voices.map(v => v.id));
                const silent = Math.max(0, Math.min(studs, 128) - Math.floor(uniqs.size * .8));
                const mx = Math.max(silent, uniqs.size, 1);
                return <>
                  <div style={{ display: "flex", gap: "3px", alignItems: "flex-end", height: isT ? "110px" : "75px", marginBottom: "12px" }}>
                    {[{ l: "Stille", p: silent, d: true }, { l: "1 bidrag", p: Math.floor(uniqs.size * .55) }, { l: "2–3", p: Math.floor(uniqs.size * .25) }, { l: "4+", p: Math.floor(uniqs.size * .15) }].map((bar, i) => (
                      <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center" }}>
                        <div style={{ width: "100%", height: `${mx > 0 ? (bar.p / mx) * (isT ? 100 : 65) : 0}px`, background: bar.d ? "#5A2020" : `${P.c}${70 - i * 15}`, transition: "height .8s" }} />
                        <span style={{ fontSize: "9px", color: "#3A3835", marginTop: "5px" }}>{bar.l}</span>
                        <span style={{ fontSize: "11px", color: "#7A756F" }}>{bar.p}</span>
                      </div>
                    ))}
                  </div>
                  <p style={{ fontSize: "11px", color: "#5A5650", fontStyle: "italic", lineHeight: 1.6 }}>
                    {silent > 0 ? `${silent} studenter har ikke bidratt. Bourdieu: «De som mangler kulturell kapital i feltet, tier.»` : "Alle har bidratt — men hvem dominerer?"}
                  </p>
                  {!isT && mine > 0 && <p style={{ fontSize: "11px", color: P.c, marginTop: "6px" }}>Du: {mine} av {total} ({total > 0 ? (mine / total * 100).toFixed(0) : 0}%)</p>}
                </>;
              })()}
            </div>
            <div style={{ background: "#0E0E10", border: "1px solid #1C1C20", padding: "20px" }}>
              <div style={{ fontSize: "10px", letterSpacing: "3px", color: "#5A5650", textTransform: "uppercase", marginBottom: "12px" }}>Rommets begreper</div>
              <TagCloud voices={voices} c={P.c} />
            </div>
          </div>
        )}

        {/* ═══ FORPLIKTELSESMUREN ═══ */}
        {phase === 4 && (
          <div>
            <div style={{ background: "#0E0E10", border: "1px solid #1C1C20", borderLeft: `3px solid ${P.c}`, padding: "20px" }}>
              <div style={{ fontSize: "10px", letterSpacing: "3px", color: P.c, textTransform: "uppercase", marginBottom: "10px" }}>Forpliktelsesmuren</div>
              <p style={{ fontSize: isT ? "20px" : "16px", margin: "0 0 4px" }}>Fra bevissthet til praxis.</p>
              <p style={{ fontSize: "12px", color: "#7A756F", margin: "0 0 14px", fontStyle: "italic" }}>Formuler én handling du forplikter deg til.</p>
              {!isT && (
                <div style={{ display: "flex", gap: "8px" }}>
                  <input value={cInp} onChange={e => setCInp(e.target.value)} placeholder="Jeg forplikter meg til å..." style={{ flex: 1, background: "#08080A", border: "1px solid #1C1C20", color: "#E8E4DE", fontSize: "13px", fontFamily: "'Georgia',serif", outline: "none", padding: "12px" }} onKeyDown={e => { if (e.key === "Enter" && cInp.trim()) { const cid = uid(); setCommits(p => [{ id: cid, text: cInp, ts: Date.now(), own: true }, ...p]); bc("commit", { id: cid, text: cInp, ts: Date.now() }); setCInp(""); } }} />
                  <button onClick={() => { if (cInp.trim()) { const cid = uid(); setCommits(p => [{ id: cid, text: cInp, ts: Date.now(), own: true }, ...p]); bc("commit", { id: cid, text: cInp, ts: Date.now() }); setCInp(""); } }} style={{ background: P.c, border: "none", color: "#E8E4DE", padding: "12px 20px", fontSize: "11px", cursor: "pointer", fontFamily: "'Georgia',serif" }}>Forplikt</button>
                </div>
              )}
            </div>
            <div style={{ display: "grid", gridTemplateColumns: `repeat(auto-fill,minmax(${isT ? "300px" : "240px"},1fr))`, gap: "6px", marginTop: "12px" }}>
              {commits.map((c, i) => (
                <div key={c.id} style={{ padding: "14px 16px", background: c.own ? `${P.c}08` : "#0A0A0C", border: `1px solid ${c.own ? P.c + "25" : "#141416"}`, animation: i < 3 ? "fadeUp .5s ease" : undefined }}>
                  <p style={{ margin: 0, fontSize: "12px", lineHeight: 1.6, fontStyle: "italic", color: c.own ? "#E8E4DE" : "#7A756F" }}>«{c.text}»</p>
                </div>
              ))}
            </div>
            {commits.length > 0 && <p style={{ marginTop: "20px", textAlign: "center", color: "#3A3835", fontSize: isT ? "14px" : "12px", fontStyle: "italic" }}>{commits.length} forpliktelser — kollektiv intensjon om endring.</p>}
          </div>
        )}
      </div>

      {/* Teacher bar */}
      {isT && (
        <div style={{ position: "fixed", bottom: 0, left: 0, right: 0, background: "rgba(8,8,10,.96)", backdropFilter: "blur(16px)", borderTop: "1px solid #1C1C20", padding: "8px 16px", display: "flex", alignItems: "center", justifyContent: "center", gap: "6px", flexWrap: "wrap", zIndex: 200 }}>
          <span style={{ fontSize: "9px", color: "#3A3835", letterSpacing: "2px", marginRight: "4px" }}>FASE:</span>
          {PHASES.map((p, i) => <button key={p.id} onClick={() => setPhase(i)} style={{ background: i === phase ? p.c : "transparent", border: `1px solid ${i === phase ? p.c : "#1C1C20"}`, color: i === phase ? "#E8E4DE" : "#5A5650", padding: "5px 12px", fontSize: "10px", cursor: "pointer", fontFamily: "'Georgia',serif" }}>{p.label}</button>)}
          <span style={{ fontSize: "9px", color: "#3A3835", letterSpacing: "2px", margin: "0 4px" }}>AKT:</span>
          {avail.map(([k, a]) => <button key={k} onClick={() => setAct(k)} style={{ background: act === k ? P.c : "transparent", border: `1px solid ${act === k ? P.c : "#1C1C20"}`, color: act === k ? "#E8E4DE" : "#5A5650", padding: "5px 12px", fontSize: "10px", cursor: "pointer", fontFamily: "'Georgia',serif" }}>{a.label}</button>)}
          <span style={{ fontSize: "9px", color: "#3A3835", letterSpacing: "2px", margin: "0 4px" }}>SPM:</span>
          <button onClick={() => { setPi(p => p + 1); setVVoted(false); }} style={{ background: "transparent", border: "1px solid #1C1C20", color: "#5A5650", padding: "5px 12px", fontSize: "10px", cursor: "pointer", fontFamily: "'Georgia',serif" }}>Neste →</button>
        </div>
      )}

      {/* Footer */}
      {!isT && <div style={{ borderTop: "1px solid #141416", padding: "16px", textAlign: "center", marginTop: "40px" }}><span style={{ fontSize: "9px", color: "#1C1C20", letterSpacing: "3px" }}>FRIGJØRENDE LÆRINGSDIALOGI · KRIS KALKMAN · NTNU / DMMH · 2026</span></div>}

      {/* ═══ TUTORIAL OVERLAY ═══ */}
      {showTutorial && <TutorialOverlay onClose={() => setShowTutorial(false)} />}

      {/* ═══ PROMPT EDITOR ═══ */}
      {showPromptEditor && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(8,8,10,.95)", zIndex: 300, overflowY: "auto", display: "flex", justifyContent: "center" }}>
          <div style={{ maxWidth: "640px", padding: "40px 24px", color: "#E8E4DE", width: "100%" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "24px" }}>
              <h2 style={{ fontSize: "20px", fontWeight: 400, margin: 0 }}>✎ Rediger spørsmål og påstander</h2>
              <button onClick={() => setShowPromptEditor(false)} style={{ background: "transparent", border: "1px solid #1C1C20", color: "#5A5650", padding: "6px 16px", fontSize: "11px", cursor: "pointer", fontFamily: "'Georgia',serif" }}>Lukk ✕</button>
            </div>
            <div style={{ background: "#0E0E10", border: "1px solid #1C1C20", borderLeft: "3px solid #4A6090", padding: "20px", marginBottom: "16px" }}>
              <div style={{ fontSize: "10px", letterSpacing: "3px", color: "#4A6090", textTransform: "uppercase", marginBottom: "10px" }}>Generer med AI</div>
              <p style={{ fontSize: "12px", color: "#9A958E", lineHeight: 1.5, marginBottom: "10px" }}>Beskriv temaet — AI genererer 5 problemposerende spørsmål <strong style={{ color: "#E8E4DE" }}>med tilhørende verdilinje-påstander</strong> automatisk.</p>
              <div style={{ display: "flex", gap: "8px", marginBottom: "8px" }}>
                <input value={aiTopic} onChange={e => setAiTopic(e.target.value)} placeholder="F.eks. «mangfold i barnehagen»..." style={{ flex: 1, background: "#08080A", border: "1px solid #1C1C20", color: "#E8E4DE", fontSize: "13px", fontFamily: "'Georgia',serif", outline: "none", padding: "10px 14px" }} />
                <button onClick={async () => {
                  if (!aiTopic.trim()) return;
                  setAiGenerating(true);
                  try {
                    const res = await fetch("https://api.anthropic.com/v1/messages", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ model: "claude-sonnet-4-20250514", max_tokens: 1500, messages: [{ role: "user", content: makeThemePrompt(aiTopic) }] }) });
                    const data = await res.json();
                    const text = data.content.map(i => i.text || "").join("");
                    const parsed = JSON.parse(text.replace(/```json|```/g, "").trim());
                    if (Array.isArray(parsed)) {
                      const newThemes = parsed.map(s => ({
                        prompt: s.prompt,
                        stmt: { text: s.stmt, l: s.l || "Helt uenig", r: s.r || "Helt enig" },
                        theme: s.theme || aiTopic,
                      }));
                      setCustomThemes(p => [...p, ...newThemes]);
                    }
                  } catch (err) {
                    const t = aiTopic.trim();
                    const tl = t.toLowerCase();
                    const fallbacks = {
                      "mangfold": [
                        { prompt: "Hvem sitt mangfold er det plass til her?", stmt: { text: "Mangfold handler mest om synlige forskjeller", l: "Helt uenig", r: "Helt enig" }, theme: "Mangfoldets grenser" },
                        { prompt: "Når sa noen at du 'ikke passer inn' — uten ord?", stmt: { text: "En pedagog bør behandle alle barn likt", l: "Helt uenig", r: "Helt enig" }, theme: "Likhet vs. rettferdighet" },
                        { prompt: "Hvilke kropper og språk føles hjemme her?", stmt: { text: "Barn tilpasser seg naturlig over tid", l: "Helt uenig", r: "Helt enig" }, theme: "Tilpasning" },
                      ],
                      "barnehage": [
                        { prompt: "Hvem bestemmer hva god barndom er — og for hvem?", stmt: { text: "Fri lek er viktigere enn strukturert læring", l: "Helt uenig", r: "Helt enig" }, theme: "Barndommens politikk" },
                        { prompt: "Hvilke barn blir sett først når du går inn?", stmt: { text: "Noen barn trenger strengere grenser", l: "Helt uenig", r: "Helt enig" }, theme: "Synlighet" },
                        { prompt: "Hva mister barnet når morsmålet forsvinner?", stmt: { text: "Norsk bør prioriteres fremfor morsmål", l: "Helt uenig", r: "Helt enig" }, theme: "Språk og makt" },
                      ],
                      "makt": [
                        { prompt: "Hvem slipper å tenke over sin egen makt?", stmt: { text: "Makt er noe man enten har eller ikke har", l: "Helt uenig", r: "Helt enig" }, theme: "Usynlig makt" },
                        { prompt: "Når fulgte du sist en regel uten å spørre hvorfor?", stmt: { text: "Regler beskytter de svakeste", l: "Helt uenig", r: "Helt enig" }, theme: "Reproduksjon" },
                        { prompt: "Hva skjer med den som sier ifra i systemet?", stmt: { text: "Det er mulig å endre systemet innenfra", l: "Helt uenig", r: "Helt enig" }, theme: "Motstand" },
                      ],
                    };
                    const match = Object.keys(fallbacks).find(k => tl.includes(k));
                    const fb = match ? fallbacks[match] : [
                      { prompt: `Hvem definerte '${t}' — og hvem ble ikke spurt?`, stmt: { text: "Fagfolk vet best hva som trengs", l: "Helt uenig", r: "Helt enig" }, theme: "Definisjonsmakt" },
                      { prompt: `Hvem er usynlig i samtalen om ${t}?`, stmt: { text: "De mest berørte har størst innflytelse", l: "Helt uenig", r: "Helt enig" }, theme: "Stemme og stillhet" },
                      { prompt: `Hva tar vi for gitt som normalt innen ${t}?`, stmt: { text: "Nøytralitet er mulig og ønskelig", l: "Helt uenig", r: "Helt enig" }, theme: "Normalitet" },
                      { prompt: `Hvem betaler prisen når ${t} fungerer bra?`, stmt: { text: "Systemet fungerer for de fleste", l: "Helt uenig", r: "Helt enig" }, theme: "Skjulte kostnader" },
                      { prompt: `Hva ville endret seg om den marginaliserte bestemte?`, stmt: { text: "Endring må komme gradvis", l: "Helt uenig", r: "Helt enig" }, theme: "Makt og endring" },
                    ];
                    setCustomThemes(p => [...p, ...fb]);
                  }
                  setAiGenerating(false); setAiTopic("");
                }} disabled={aiGenerating} style={{ background: aiGenerating ? "#3A3835" : "#4A6090", border: "none", color: "#E8E4DE", padding: "10px 20px", fontSize: "11px", cursor: aiGenerating ? "default" : "pointer", fontFamily: "'Georgia',serif", whiteSpace: "nowrap" }}>
                  {aiGenerating ? "Genererer..." : "Generer"}
                </button>
              </div>
              <div style={{ display: "flex", gap: "4px", flexWrap: "wrap" }}>
                {["mangfold i barnehagen", "profesjonsetikk", "foreldresamarbeid", "makt i klasserommet", "språklig mangfold"].map(t => (
                  <button key={t} onClick={() => setAiTopic(t)} style={{ padding: "3px 8px", fontSize: "9px", background: "transparent", border: "1px solid #1C1C20", color: "#5A5650", cursor: "pointer", fontFamily: "'Georgia',serif" }}>{t}</button>
                ))}
              </div>
            </div>
            <div style={{ background: "#0E0E10", border: "1px solid #1C1C20", padding: "16px", marginBottom: "16px" }}>
              <div style={{ fontSize: "10px", letterSpacing: "3px", color: "#5A5650", textTransform: "uppercase", marginBottom: "8px" }}>Legg til manuelt</div>
              <div style={{ display: "flex", gap: "8px", marginBottom: "6px" }}>
                <input value={newPrompt} onChange={e => setNewPrompt(e.target.value)} placeholder="Spørsmål: F.eks. «Hvem definerer kvalitet?»" style={{ flex: 1, background: "#08080A", border: "1px solid #1C1C20", color: "#E8E4DE", fontSize: "12px", fontFamily: "'Georgia',serif", outline: "none", padding: "10px 14px" }} />
              </div>
              <div style={{ display: "flex", gap: "8px" }}>
                <input value={newStmt} onChange={e => setNewStmt(e.target.value)} placeholder="Verdilinje-påstand: F.eks. «Kvalitet kan måles objektivt»" style={{ flex: 1, background: "#08080A", border: "1px solid #1C1C20", color: "#E8E4DE", fontSize: "12px", fontFamily: "'Georgia',serif", outline: "none", padding: "10px 14px" }} onKeyDown={e => { if (e.key === "Enter" && newPrompt.trim()) { setCustomThemes(p => [...p, { prompt: newPrompt, stmt: { text: newStmt || "Denne påstanden er sann", l: "Helt uenig", r: "Helt enig" }, theme: "Egendefinert" }]); setNewPrompt(""); setNewStmt(""); }}} />
                <button onClick={() => { if (newPrompt.trim()) { setCustomThemes(p => [...p, { prompt: newPrompt, stmt: { text: newStmt || "Denne påstanden er sann", l: "Helt uenig", r: "Helt enig" }, theme: "Egendefinert" }]); setNewPrompt(""); setNewStmt(""); } }} style={{ background: "#C06840", border: "none", color: "#E8E4DE", padding: "10px 16px", fontSize: "11px", cursor: "pointer", fontFamily: "'Georgia',serif", whiteSpace: "nowrap" }}>Legg til</button>
              </div>
            </div>
            <div style={{ fontSize: "10px", letterSpacing: "3px", color: "#5A5650", textTransform: "uppercase", marginBottom: "8px" }}>Tematiske sett ({customThemes.length})</div>
            <div style={{ display: "flex", flexDirection: "column", gap: "3px", maxHeight: "35vh", overflowY: "auto" }}>
              {customThemes.map((t, i) => (
                <div key={i} style={{ padding: "8px 10px", background: i === pi % customThemes.length ? "#C0684012" : "#08080A", border: `1px solid ${i === pi % customThemes.length ? "#C0684025" : "#141416"}` }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span style={{ fontSize: "11px", color: i === pi % customThemes.length ? "#E8E4DE" : "#7A756F", flex: 1 }}>{i + 1}. {t.prompt}</span>
                    <div style={{ display: "flex", gap: "4px", marginLeft: "8px", flexShrink: 0 }}>
                      <button onClick={() => { setPi(i); setVVoted(false); }} style={{ background: "transparent", border: "1px solid #1C1C20", color: "#5A5650", padding: "2px 6px", fontSize: "9px", cursor: "pointer", fontFamily: "'Georgia',serif" }}>Bruk</button>
                      <button onClick={() => setCustomThemes(p => p.filter((_, j) => j !== i))} style={{ background: "transparent", border: "1px solid #5A2020", color: "#8A4040", padding: "2px 6px", fontSize: "9px", cursor: "pointer", fontFamily: "'Georgia',serif" }}>✕</button>
                    </div>
                  </div>
                  <div style={{ fontSize: "9px", color: "#5A5650", marginTop: "3px", fontStyle: "italic" }}>━ {t.stmt.text} · {t.theme}</div>
                </div>
              ))}
            </div>
            <button onClick={() => setShowPromptEditor(false)} style={{ display: "block", margin: "16px auto", background: "#C06840", border: "none", color: "#E8E4DE", padding: "10px 28px", fontSize: "12px", cursor: "pointer", fontFamily: "'Georgia',serif" }}>Ferdig</button>
          </div>
        </div>
      )}

      {/* Help & QR buttons */}
      {phase >= 0 && <button onClick={() => setShowTutorial(true)} style={{ position: "fixed", bottom: isT ? "60px" : "16px", right: "16px", background: "#0E0E10", border: "1px solid #1C1C20", color: "#5A5650", width: "36px", height: "36px", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", fontSize: "14px", zIndex: 150, fontFamily: "'Georgia',serif" }}>?</button>}
      {phase >= 0 && isT && <button onClick={() => setShowQR(true)} style={{ position: "fixed", bottom: "60px", right: "60px", background: "#0E0E10", border: "1px solid #1C1C20", color: "#5A5650", width: "36px", height: "36px", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", fontSize: "16px", zIndex: 150, fontFamily: "'Georgia',serif" }}>⊞</button>}
      {showQR && <QROverlay onClose={() => setShowQR(false)} />}

      <style>{`
        @keyframes fadeUp{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:translateY(0)}}
        @keyframes blink{0%,100%{opacity:.25}50%{opacity:1}}
        @keyframes typingDot{0%,60%,100%{opacity:.25;transform:translateY(0)}30%{opacity:1;transform:translateY(-3px)}}
        ::-webkit-scrollbar{width:3px}::-webkit-scrollbar-track{background:#08080A}::-webkit-scrollbar-thumb{background:#1C1C20}
        textarea::placeholder,input::placeholder{color:#3A3835}
        *{box-sizing:border-box}
        input[type="range"]::-webkit-slider-thumb{-webkit-appearance:none;width:20px;height:20px;border-radius:50%;background:#C06840;cursor:pointer}
      `}</style>
    </div>
  );
}
