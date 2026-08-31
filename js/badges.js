import { STATE } from './state.js';
import { loadTipsForMatch } from './api/tips.js';
import { tendenz, isExactResult } from './scoring.js';

/* Statisch: Icon/Name/Beschreibung. Die eigentlichen Träger werden live aus
   Matches + Tipps berechnet — mehrere Leute können ein Abzeichen gleichzeitig
   halten, es ist kein Einzel-Ranking wie die Rangliste. */
export const BADGE_DEFS = [
  { id:'hellseher', icon:'🔮', name:'Hellseher', description:'5 oder mehr exakte Ergebnisse getippt' },
  { id:'pechvogel', icon:'🍀', name:'Pechvogel', description:'3-mal Sieger & Tordifferenz richtig, aber knapp am exakten Ergebnis vorbeigetippt' },
  { id:'fruehbucher', icon:'⏰', name:'Frühbucher', description:'Bei mindestens 3 Spielen immer als Erste(r) getippt' },
  { id:'bonusgenie', icon:'🎯', name:'Bonusfrage-Ass', description:'5 oder mehr Extra-Fragen richtig beantwortet' },
  { id:'stammgast', icon:'🏟️', name:'Stammgast', description:'Bei jedem gesperrten Spiel mitgetippt' }
];

function holdersOf(counts, min, fmt){
  return Object.entries(counts)
    .filter(([, c]) => c >= min)
    .sort((a, b) => b[1] - a[1])
    .map(([name, c]) => ({ name, detail: fmt(c) }));
}

/* Nur gesperrte Spiele zählen (Anpfiff vorbei oder ausgewertet) — offene Spiele
   sind für Abzeichen noch nicht "final" genug, genau wie beim Tipp-Reveal. */
async function gatherLockedMatchTips(){
  const now = new Date();
  const locked = STATE.matches.filter(m => m.status === 'beendet' || now >= new Date(m.kickoff));
  const perMatch = [];
  for(const m of locked){
    const tips = STATE.tipsCache[m.id] || await loadTipsForMatch(m.id);
    perMatch.push({ match: m, tips });
  }
  return perMatch;
}

export async function computeBadges(){
  const perMatch = await gatherLockedMatchTips();
  const finished = perMatch.filter(x => x.match.status === 'beendet');

  const exactCount = {};
  const nearMissCount = {};
  const bonusCorrectCount = {};
  finished.forEach(({ match, tips }) => {
    tips.forEach(tip => {
      if(isExactResult(tip, match)){
        exactCount[tip.name] = (exactCount[tip.name] || 0) + 1;
      } else {
        const eh = match.ergebnis.heim, eg = match.ergebnis.gast;
        const siegerOk = tendenz(tip.heim, tip.gast) === tendenz(eh, eg);
        const diffOk = (tip.heim - tip.gast) === (eh - eg);
        if(siegerOk && diffOk){
          nearMissCount[tip.name] = (nearMissCount[tip.name] || 0) + 1;
        }
      }
      if(match.specialAntworten){
        (match.specials || []).forEach(sp => {
          const correct = match.specialAntworten[sp.id];
          const given = tip.spezial ? tip.spezial[sp.id] : undefined;
          if(correct !== undefined && correct !== '' && given !== undefined && given !== ''){
            if(String(given).trim().toLowerCase() === String(correct).trim().toLowerCase()){
              bonusCorrectCount[tip.name] = (bonusCorrectCount[tip.name] || 0) + 1;
            }
          }
        });
      }
    });
  });

  // Frühbucher & Stammgast: über alle gesperrten Spiele, nicht nur ausgewertete
  const participationCount = {};
  const firstCount = {};
  perMatch.forEach(({ tips }) => {
    if(tips.length === 0) return;
    const sorted = [...tips].sort((a, b) => new Date(a.submittedAt) - new Date(b.submittedAt));
    firstCount[sorted[0].name] = (firstCount[sorted[0].name] || 0) + 1;
    tips.forEach(t => participationCount[t.name] = (participationCount[t.name] || 0) + 1);
  });

  const fruehbucher = Object.entries(firstCount)
    .filter(([name, count]) => count >= 3 && count === participationCount[name])
    .map(([name, count]) => ({ name, detail: `${count}× zuerst` }));

  const stammgast = perMatch.length >= 3
    ? Object.entries(participationCount)
        .filter(([, count]) => count === perMatch.length)
        .map(([name]) => ({ name, detail: `${perMatch.length}/${perMatch.length} Spielen` }))
    : [];

  return {
    hellseher: holdersOf(exactCount, 5, c => `${c}× exakt`),
    pechvogel: holdersOf(nearMissCount, 3, c => `${c}× knapp daneben`),
    fruehbucher,
    bonusgenie: holdersOf(bonusCorrectCount, 5, c => `${c}× richtig`),
    stammgast
  };
}
