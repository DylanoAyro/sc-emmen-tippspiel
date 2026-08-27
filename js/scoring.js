export function tendenz(h,g){
  if(h > g) return 'heim';
  if(h < g) return 'gast';
  return 'unentschieden';
}

export function computePoints(tip, match){
  let pts = 0;
  if(match.ergebnis){
    const eh = match.ergebnis.heim, eg = match.ergebnis.gast;
    if(tip.heim === eh && tip.gast === eg) pts += 5;
    else if(tendenz(tip.heim, tip.gast) === tendenz(eh, eg)) pts += 2;
  }
  if(match.specialAntworten){
    (match.specials || []).forEach(sp=>{
      const correct = match.specialAntworten[sp.id];
      const given = tip.spezial ? tip.spezial[sp.id] : undefined;
      if(correct !== undefined && correct !== '' && given !== undefined && given !== ''){
        if(String(given).trim().toLowerCase() === String(correct).trim().toLowerCase()) pts += 3;
      }
    });
  }
  return pts;
}
