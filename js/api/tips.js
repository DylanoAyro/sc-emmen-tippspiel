import { supabaseClient } from '../supabase-client.js';
import { STATE } from '../state.js';

export function rowToTip(row){
  return { name: row.name, heim: row.heim, gast: row.gast, spezial: row.spezial || {}, submittedAt: row.submitted_at };
}

export async function loadTipsForMatch(matchId){
  const { data, error } = await supabaseClient.from('tips').select('*').eq('match_id', matchId);
  if(error){ console.error('loadTipsForMatch failed', error); STATE.tipsCache[matchId] = []; return []; }
  const out = (data || []).map(rowToTip);
  STATE.tipsCache[matchId] = out;
  return out;
}
export async function saveTip(matchId, tipObj){
  const row = {
    match_id: matchId,
    name: tipObj.name,
    heim: tipObj.heim,
    gast: tipObj.gast,
    spezial: tipObj.spezial || {},
    submitted_at: tipObj.submittedAt
  };
  const { error } = await supabaseClient.from('tips').upsert(row, { onConflict: 'match_id,name' });
  if(error){ console.error('saveTip failed', error); return false; }
  return true;
}
export async function loadMyTip(matchId){
  const { data, error } = await supabaseClient.from('tips').select('*')
    .eq('match_id', matchId).eq('name', STATE.username).maybeSingle();
  if(error || !data) return null;
  return rowToTip(data);
}
