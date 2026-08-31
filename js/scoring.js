export const POINTS = {
  sieger: 2,   // richtiger Sieger / richtiges Unentschieden
  differenz: 2, // richtige Tordifferenz
  heimtore: 1,  // Heimtore exakt getroffen
  gasttore: 1,  // Auswärtstore exakt getroffen
  extra: 3      // pro richtig beantworteter Extra-Frage
};

export function tendenz(h,g){
  if(h > g) return 'heim';
  if(h < g) return 'gast';
  return 'unentschieden';
}

/* Punkte-Aufschlüsselung für einen Tipp — Basis für computePoints() und für die Abzeichen. */
export function computeMatchPointsBreakdown(tip, match){
  const b = { sieger:0, differenz:0, heimtore:0, gasttore:0, extra:0 };
  if(match.ergebnis){
    const eh = match.ergebnis.heim, eg = match.ergebnis.gast;
    if(tendenz(tip.heim, tip.gast) === tendenz(eh, eg)) b.sieger = POINTS.sieger;
    if((tip.heim - tip.gast) === (eh - eg)) b.differenz = POINTS.differenz;
    if(tip.heim === eh) b.heimtore = POINTS.heimtore;
    if(tip.gast === eg) b.gasttore = POINTS.gasttore;
  }
  if(match.specialAntworten){
    (match.specials || []).forEach(sp=>{
      const correct = match.specialAntworten[sp.id];
      const given = tip.spezial ? tip.spezial[sp.id] : undefined;
      if(correct !== undefined && correct !== '' && given !== undefined && given !== ''){
        if(String(given).trim().toLowerCase() === String(correct).trim().toLowerCase()) b.extra += POINTS.extra;
      }
    });
  }
  return b;
}

export function totalFromBreakdown(b){
  return b.sieger + b.differenz + b.heimtore + b.gasttore + b.extra;
}

export function computePoints(tip, match){
  return totalFromBreakdown(computeMatchPointsBreakdown(tip, match));
}

export function isExactResult(tip, match){
  return !!match.ergebnis && tip.heim === match.ergebnis.heim && tip.gast === match.ergebnis.gast;
}
