import { supabaseClient } from '../supabase-client.js';

/* ---------- login (name + Merkwort, kein echtes Auth-System) ---------- */
export async function sha256Hex(text){
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2,'0')).join('');
}

export async function loginPlayer(name, password){
  const hash = await sha256Hex(password);
  const { data, error } = await supabaseClient.from('players').select('*').eq('name', name).maybeSingle();
  if(error) return { ok:false, error:'Verbindungsfehler, bitte nochmal versuchen' };
  if(!data) return { ok:false, error:'Diesen Namen gibt’s noch nicht — Account erstellen' };
  if(data.password !== hash) return { ok:false, error:'Falsches Merkwort' };
  return { ok:true };
}

export async function registerPlayer(name, password){
  const { data: existing, error: selErr } = await supabaseClient.from('players').select('name').eq('name', name).maybeSingle();
  if(selErr) return { ok:false, error:'Verbindungsfehler, bitte nochmal versuchen' };
  if(existing) return { ok:false, error:'Name bereits vergeben — bitte einloggen' };
  const hash = await sha256Hex(password);
  const { error: insErr } = await supabaseClient.from('players').insert({ name, password: hash });
  if(insErr) return { ok:false, error:'Registrierung fehlgeschlagen' };
  return { ok:true };
}

/* ---------- players: read/write (Admin) ---------- */
export async function loadPlayerNames(){
  const { data, error } = await supabaseClient.from('players').select('name').order('name');
  if(error){ console.error('loadPlayerNames failed', error); return []; }
  return (data || []).map(r=>r.name);
}
export async function updatePlayer(oldName, newName, newPassword){
  const fields = {};
  if(newName && newName !== oldName) fields.name = newName;
  if(newPassword) fields.password = await sha256Hex(newPassword);
  if(Object.keys(fields).length === 0) return true;
  const { error } = await supabaseClient.from('players').update(fields).eq('name', oldName);
  if(error){ console.error('updatePlayer failed', error); return false; }
  if(fields.name){
    const { error: tipsErr } = await supabaseClient.from('tips').update({ name: fields.name }).eq('name', oldName);
    if(tipsErr) console.error('updatePlayer: renaming tips failed', tipsErr);
  }
  return true;
}
export async function deletePlayerRow(name){
  const { error } = await supabaseClient.from('players').delete().eq('name', name);
  if(error){ console.error('deletePlayerRow failed', error); return false; }
  return true;
}
