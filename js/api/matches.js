import { supabaseClient } from '../supabase-client.js';

/* ---------- match row <-> app object mapping ---------- */
export function rowToMatch(row){
  return {
    id: row.id,
    opponent: row.opponent,
    homeAway: row.home_away,
    kickoff: row.kickoff,
    specials: row.specials || [],
    status: row.status,
    ergebnis: (row.ergebnis_heim !== null && row.ergebnis_gast !== null)
      ? { heim: row.ergebnis_heim, gast: row.ergebnis_gast } : null,
    specialAntworten: row.special_antworten || null
  };
}
export function matchToRow(m){
  return {
    id: m.id,
    opponent: m.opponent,
    home_away: m.homeAway,
    kickoff: m.kickoff,
    specials: m.specials || [],
    status: m.status,
    ergebnis_heim: m.ergebnis ? m.ergebnis.heim : null,
    ergebnis_gast: m.ergebnis ? m.ergebnis.gast : null,
    special_antworten: m.specialAntworten || null
  };
}

export async function loadMatchesFromDb(){
  const { data, error } = await supabaseClient.from('matches').select('*').order('kickoff');
  if(error){ console.error('loadMatches failed', error); return []; }
  return (data || []).map(rowToMatch);
}
export async function insertMatch(match){
  const { error } = await supabaseClient.from('matches').insert(matchToRow(match));
  if(error){ console.error('insertMatch failed', error); return false; }
  return true;
}
export async function updateMatchResult(matchId, ergebnis, specialAntworten){
  const { error } = await supabaseClient.from('matches').update({
    ergebnis_heim: ergebnis.heim,
    ergebnis_gast: ergebnis.gast,
    special_antworten: specialAntworten,
    status: 'beendet'
  }).eq('id', matchId);
  if(error){ console.error('updateMatchResult failed', error); return false; }
  return true;
}
export async function deleteMatchRow(matchId){
  const { error } = await supabaseClient.from('matches').delete().eq('id', matchId);
  if(error){ console.error('deleteMatchRow failed', error); return false; }
  return true;
}
export async function updateMatchFields(matchId, fields){
  const { error } = await supabaseClient.from('matches').update({
    opponent: fields.opponent,
    home_away: fields.homeAway,
    kickoff: fields.kickoff,
    specials: fields.specials
  }).eq('id', matchId);
  if(error){ console.error('updateMatchFields failed', error); return false; }
  return true;
}

/* ---------- Bonusfragen-Text ("Frage|typ" pro Zeile) <-> specials-Array ---------- */
export function parseSpecialsInput(text, existingSpecials){
  const lines = text.split('\n').map(l=>l.trim()).filter(Boolean);
  return lines.map((line, idx)=>{
    const [frage, typRaw] = line.split('|').map(s=>s && s.trim());
    const typ = (typRaw === 'janein') ? 'janein' : 'text';
    const existing = existingSpecials && existingSpecials[idx];
    const id = existing ? existing.id : ('sp_' + Date.now() + '_' + idx);
    return { id, frage: frage || line, typ };
  });
}
