const $ = (sel, el=document) => el.querySelector(sel);
const $$ = (sel, el=document) => Array.from(el.querySelectorAll(sel));

const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

let USERNAME = null;
let MATCHES = [];
let TIPS_CACHE = {}; // matchId -> [{name, tip}]

function showToast(msg){
  const t = $('#toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(t._timer);
  t._timer = setTimeout(()=>t.classList.remove('show'), 2200);
}

/* ---------- match row <-> app object mapping ---------- */
function rowToMatch(row){
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
function matchToRow(m){
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
function rowToTip(row){
  return { name: row.name, heim: row.heim, gast: row.gast, spezial: row.spezial || {}, submittedAt: row.submitted_at };
}

/* ---------- login (name + password, kein echtes Auth-System) ---------- */
async function checkPlayerLogin(name, password){
  const { data, error } = await supabaseClient.from('players').select('*').eq('name', name).maybeSingle();
  if(error) return { ok:false, error:'Verbindungsfehler, bitte nochmal versuchen' };
  if(!data){
    const { error: insErr } = await supabaseClient.from('players').insert({ name, password });
    if(insErr) return { ok:false, error:'Registrierung fehlgeschlagen' };
    return { ok:true };
  }
  if(data.password !== password){
    return { ok:false, error:'Falsches Passwort' };
  }
  return { ok:true };
}

function showLoginOverlay(){
  $('#loginOverlay').classList.remove('hidden');
  $('#loginName').focus();
}
function hideLoginOverlay(){
  $('#loginOverlay').classList.add('hidden');
}

function completeLogin(name, password, persist){
  USERNAME = name;
  if(persist){
    localStorage.setItem('tippspiel_username', name);
    localStorage.setItem('tippspiel_password', password);
  }
  $('#youName').textContent = USERNAME;
  hideLoginOverlay();
  renderAll();
  setInterval(renderAll, 25000);
}

async function attemptLogin(){
  const name = $('#loginName').value.trim();
  const password = $('#loginPassword').value;
  const errEl = $('#loginError');
  errEl.style.display = 'none';
  if(!name || !password){
    errEl.textContent = 'Name und Passwort ausfüllen';
    errEl.style.display = 'block';
    return;
  }
  const result = await checkPlayerLogin(name, password);
  if(!result.ok){
    errEl.textContent = result.error;
    errEl.style.display = 'block';
    return;
  }
  completeLogin(name, password, true);
}

$('#loginBtn').addEventListener('click', attemptLogin);
$('#loginPassword').addEventListener('keydown', e=>{ if(e.key === 'Enter') attemptLogin(); });
$('#loginName').addEventListener('keydown', e=>{ if(e.key === 'Enter') $('#loginPassword').focus(); });

async function ensureUsername(){
  const savedName = localStorage.getItem('tippspiel_username');
  const savedPassword = localStorage.getItem('tippspiel_password');
  if(savedName && savedPassword){
    const result = await checkPlayerLogin(savedName, savedPassword);
    if(result.ok){
      completeLogin(savedName, savedPassword, false);
      return;
    }
  }
  showLoginOverlay();
}

$('#changeNameBtn').addEventListener('click', ()=>{
  localStorage.removeItem('tippspiel_username');
  localStorage.removeItem('tippspiel_password');
  location.reload();
});

/* ---------- matches: read/write ---------- */
async function loadMatches(){
  const { data, error } = await supabaseClient.from('matches').select('*').order('kickoff');
  if(error){ console.error('loadMatches failed', error); MATCHES = []; return; }
  MATCHES = (data || []).map(rowToMatch);
}
async function insertMatch(match){
  const { error } = await supabaseClient.from('matches').insert(matchToRow(match));
  if(error){ console.error('insertMatch failed', error); return false; }
  return true;
}
async function updateMatchResult(matchId, ergebnis, specialAntworten){
  const { error } = await supabaseClient.from('matches').update({
    ergebnis_heim: ergebnis.heim,
    ergebnis_gast: ergebnis.gast,
    special_antworten: specialAntworten,
    status: 'beendet'
  }).eq('id', matchId);
  if(error){ console.error('updateMatchResult failed', error); return false; }
  return true;
}
async function deleteMatchRow(matchId){
  const { error } = await supabaseClient.from('matches').delete().eq('id', matchId);
  if(error){ console.error('deleteMatchRow failed', error); return false; }
  return true;
}

/* ---------- tips: read/write ---------- */
async function loadTipsForMatch(matchId){
  const { data, error } = await supabaseClient.from('tips').select('*').eq('match_id', matchId);
  if(error){ console.error('loadTipsForMatch failed', error); TIPS_CACHE[matchId] = []; return []; }
  const out = (data || []).map(rowToTip);
  TIPS_CACHE[matchId] = out;
  return out;
}
async function saveTip(matchId, tipObj){
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
async function loadMyTip(matchId){
  const { data, error } = await supabaseClient.from('tips').select('*')
    .eq('match_id', matchId).eq('name', USERNAME).maybeSingle();
  if(error || !data) return null;
  return rowToTip(data);
}

/* ---------- scoring ---------- */
function tendenz(h,g){
  if(h > g) return 'heim';
  if(h < g) return 'gast';
  return 'unentschieden';
}
function computePoints(tip, match){
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

/* ---------- rendering: Spiele tab ---------- */
function fmtDate(iso){
  const d = new Date(iso);
  return d.toLocaleDateString('de-CH', {weekday:'short', day:'2-digit', month:'2-digit'}) + ', ' +
         d.toLocaleTimeString('de-CH', {hour:'2-digit', minute:'2-digit'});
}

async function renderMatches(){
  const list = $('#matchesList');
  if(MATCHES.length === 0){
    list.innerHTML = '<div class="empty">Noch keine Spiele angelegt. Unter "Admin" das erste Spiel eintragen.</div>';
    return;
  }
  const now = new Date();
  let html = '';
  for(const m of MATCHES){
    const kickoff = new Date(m.kickoff);
    const locked = now >= kickoff || m.status === 'beendet';
    const done = m.status === 'beendet';

    let statusLabel, statusClass;
    if(done){ statusLabel = 'Ausgewertet'; statusClass = 'status-done'; }
    else if(locked){ statusLabel = 'Gesperrt'; statusClass = 'status-locked'; }
    else{ statusLabel = 'Offen für Tipps'; statusClass = 'status-open'; }

    const myTip = await loadMyTip(m.id);

    html += `<div class="ticket" data-match="${m.id}">
      <div class="ticket-head">
        <span>${m.homeAway === 'heim' ? 'Heimspiel' : 'Auswärtsspiel'}</span>
        <span class="status-pill ${statusClass}">${statusLabel}</span>
      </div>
      <div class="ticket-body">
        <div class="kickoff-line">${fmtDate(m.kickoff)}</div>
        <div class="match-title">
          ${m.homeAway === 'heim'
            ? `SC Emmen 3 <span class="vs">vs</span> ${escapeHtml(m.opponent)}`
            : `${escapeHtml(m.opponent)} <span class="vs">vs</span> SC Emmen 3`}
        </div>`;

    if(!locked){
      const prefillH = myTip ? myTip.heim : '';
      const prefillG = myTip ? myTip.gast : '';
      html += `
        <div class="score-row">
          <div class="score-box"><input type="number" min="0" max="30" data-role="heim" value="${prefillH}"></div>
          <div class="score-sep">:</div>
          <div class="score-box"><input type="number" min="0" max="30" data-role="gast" value="${prefillG}"></div>
        </div>
        <div class="specials">`;
      (m.specials || []).forEach(sp=>{
        const val = myTip && myTip.spezial ? (myTip.spezial[sp.id] ?? '') : '';
        if(sp.typ === 'janein'){
          html += `<div class="special-row" data-special="${sp.id}">
            <span class="q">${escapeHtml(sp.frage)}</span>
            <select data-role="special">
              <option value="">–</option>
              <option value="ja" ${val==='ja'?'selected':''}>Ja</option>
              <option value="nein" ${val==='nein'?'selected':''}>Nein</option>
            </select>
          </div>`;
        } else {
          html += `<div class="special-row" data-special="${sp.id}">
            <span class="q">${escapeHtml(sp.frage)}</span>
            <input type="text" data-role="special" value="${escapeHtml(val)}">
          </div>`;
        }
      });
      html += `</div>
        <div class="ticket-actions">
          <button class="btn btn-primary" data-action="tip">${myTip ? 'Tipp ändern' : 'Tipp abgeben'}</button>
        </div>`;
      if(myTip){
        html += `<div class="your-tip-note">Dein Tipp ist gespeichert &mdash; bis Anpfiff änderbar.</div>`;
      }
    } else {
      // locked: show result if done, and reveal table
      if(done){
        html += `<div class="score-row">
          <div class="score-box" style="border-color:var(--green-ok); color:var(--green-ok); text-shadow:none;">${m.ergebnis.heim}</div>
          <div class="score-sep">:</div>
          <div class="score-box" style="border-color:var(--green-ok); color:var(--green-ok); text-shadow:none;">${m.ergebnis.gast}</div>
        </div>
        <div class="final-tag">Endresultat</div>`;
      } else {
        html += `<div class="final-tag">Spiel läuft / Resultat noch nicht erfasst</div>`;
      }

      const tips = await loadTipsForMatch(m.id);
      if(tips.length){
        html += `<table class="reveal-table"><thead><tr><th style="text-align:left">Spieler</th><th>Tipp</th>`;
        (m.specials||[]).forEach(sp=> html += `<th>${escapeHtml(shorten(sp.frage))}</th>`);
        if(done) html += `<th>Pkt</th>`;
        html += `</tr></thead><tbody>`;
        tips.sort((a,b)=> (a.name||'').localeCompare(b.name||''));
        tips.forEach(t=>{
          html += `<tr><td class="name">${escapeHtml(t.name)}</td><td>${t.heim}:${t.gast}</td>`;
          (m.specials||[]).forEach(sp=>{
            const v = t.spezial ? (t.spezial[sp.id] ?? '–') : '–';
            html += `<td>${escapeHtml(String(v||'–'))}</td>`;
          });
          if(done){
            const pts = computePoints(t, m);
            html += `<td class="pts">${pts}</td>`;
          }
          html += `</tr>`;
        });
        html += `</tbody></table>`;
      } else {
        html += `<div class="empty" style="padding:16px 0;">Niemand hat getippt.</div>`;
      }
    }

    html += `</div></div>`;
  }
  list.innerHTML = html;

  // wire up tip buttons
  $$('#matchesList [data-action="tip"]').forEach(btn=>{
    btn.addEventListener('click', async (e)=>{
      const ticket = e.target.closest('.ticket');
      const matchId = ticket.dataset.match;
      const heim = parseInt(ticket.querySelector('[data-role="heim"]').value, 10);
      const gast = parseInt(ticket.querySelector('[data-role="gast"]').value, 10);
      if(isNaN(heim) || isNaN(gast) || heim < 0 || gast < 0){
        showToast('Bitte gültiges Resultat eintragen');
        return;
      }
      const spezial = {};
      ticket.querySelectorAll('[data-special]').forEach(row=>{
        const spId = row.dataset.special;
        const input = row.querySelector('[data-role="special"]');
        spezial[spId] = input.value;
      });
      const ok = await saveTip(matchId, {name: USERNAME, heim, gast, spezial, submittedAt: new Date().toISOString()});
      if(ok){ showToast('Tipp gespeichert!'); }
      else{ showToast('Speichern fehlgeschlagen'); }
      renderMatches();
    });
  });
}

function shorten(s){ return s.length > 16 ? s.slice(0,14)+'…' : s; }
function escapeHtml(s){
  return String(s ?? '').replace(/[&<>"']/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}

/* ---------- Rangliste ---------- */
async function renderLeaderboard(){
  const totals = {};
  const finished = MATCHES.filter(m=>m.status === 'beendet');
  for(const m of finished){
    const tips = TIPS_CACHE[m.id] || await loadTipsForMatch(m.id);
    tips.forEach(t=>{
      const pts = computePoints(t, m);
      totals[t.name] = (totals[t.name] || 0) + pts;
    });
  }
  const rows = Object.entries(totals).sort((a,b)=> b[1]-a[1]);
  const body = $('#leaderboardBody');
  const empty = $('#leaderboardEmpty');
  if(rows.length === 0){
    body.innerHTML = '';
    empty.style.display = 'block';
    return;
  }
  empty.style.display = 'none';
  body.innerHTML = rows.map(([name, pts], i)=>{
    const rankClass = i===0 ? 'gold' : i===1 ? 'silver' : i===2 ? 'bronze' : '';
    return `<tr>
      <td class="rank ${rankClass}">${i+1}</td>
      <td class="player-name">${escapeHtml(name)}</td>
      <td class="pts-total">${pts}</td>
    </tr>`;
  }).join('');
}

/* ---------- Admin ---------- */
$('#addMatchBtn').addEventListener('click', async ()=>{
  const opponent = $('#newOpponent').value.trim();
  const homeAway = $('#newHomeAway').value;
  const kickoff = $('#newKickoff').value;
  if(!opponent || !kickoff){
    showToast('Gegner und Anpfiff-Zeit ausfüllen');
    return;
  }
  const specialsRaw = $('#newSpecials').value.split('\n').map(l=>l.trim()).filter(Boolean);
  const specials = specialsRaw.map((line, idx)=>{
    const [frage, typRaw] = line.split('|').map(s=>s && s.trim());
    const typ = (typRaw === 'janein') ? 'janein' : 'text';
    return { id: 'sp_' + Date.now() + '_' + idx, frage: frage || line, typ };
  });
  const match = {
    id: 'm_' + Date.now(),
    opponent, homeAway,
    kickoff: new Date(kickoff).toISOString(),
    specials,
    status: 'offen',
    ergebnis: null,
    specialAntworten: null
  };
  const ok = await insertMatch(match);
  if(!ok){ showToast('Speichern fehlgeschlagen'); return; }
  $('#newOpponent').value = '';
  $('#newKickoff').value = '';
  $('#newSpecials').value = '';
  showToast('Spiel angelegt');
  renderAll();
});

function renderAdminMatchList(){
  const container = $('#adminMatchList');
  const empty = $('#adminEmpty');
  if(MATCHES.length === 0){
    container.innerHTML = '';
    empty.style.display = 'block';
    return;
  }
  empty.style.display = 'none';
  container.innerHTML = MATCHES.map(m=>{
    const label = m.homeAway === 'heim' ? `SC Emmen 3 – ${escapeHtml(m.opponent)}` : `${escapeHtml(m.opponent)} – SC Emmen 3`;
    const doneTag = m.status === 'beendet' ? ` (${m.ergebnis.heim}:${m.ergebnis.gast} ausgewertet)` : '';
    return `<div class="admin-match-row" data-match="${m.id}">
      <div class="info">
        <div class="op">${label}${doneTag}</div>
        <div class="meta">${fmtDate(m.kickoff)}</div>
      </div>
      <div>
        ${m.status !== 'beendet' ? `<button class="btn btn-ghost" data-action="enter-result" data-match="${m.id}">Resultat erfassen</button>` : ''}
        <button class="btn btn-danger" data-action="delete-match" data-match="${m.id}">Löschen</button>
      </div>
      <div class="result-form" id="resultForm-${m.id}" style="display:none; width:100%;"></div>
    </div>`;
  }).join('');

  $$('[data-action="enter-result"]').forEach(btn=>{
    btn.addEventListener('click', ()=>{
      const matchId = btn.dataset.match;
      const m = MATCHES.find(x=>x.id === matchId);
      const formDiv = $(`#resultForm-${matchId}`);
      if(formDiv.style.display === 'block'){ formDiv.style.display = 'none'; return; }
      let html = `<div class="row2" style="margin-top:10px;">
        <div class="field"><label>Tore Heim</label><input type="number" min="0" id="res-heim-${matchId}"></div>
        <div class="field"><label>Tore Gast</label><input type="number" min="0" id="res-gast-${matchId}"></div>
      </div>`;
      (m.specials||[]).forEach(sp=>{
        if(sp.typ === 'janein'){
          html += `<div class="field"><label>${escapeHtml(sp.frage)}</label>
            <select id="res-sp-${sp.id}"><option value="">–</option><option value="ja">Ja</option><option value="nein">Nein</option></select></div>`;
        } else {
          html += `<div class="field"><label>${escapeHtml(sp.frage)} (richtige Antwort)</label>
            <input type="text" id="res-sp-${sp.id}"></div>`;
        }
      });
      html += `<div class="ticket-actions"><button class="btn btn-primary" data-action="save-result" data-match="${matchId}">Speichern & auswerten</button></div>`;
      formDiv.innerHTML = html;
      formDiv.style.display = 'block';

      formDiv.querySelector('[data-action="save-result"]').addEventListener('click', async ()=>{
        const heim = parseInt($(`#res-heim-${matchId}`).value, 10);
        const gast = parseInt($(`#res-gast-${matchId}`).value, 10);
        if(isNaN(heim) || isNaN(gast)){ showToast('Resultat eintragen'); return; }
        const specialAntworten = {};
        (m.specials||[]).forEach(sp=>{
          const el = $(`#res-sp-${sp.id}`);
          if(el) specialAntworten[sp.id] = el.value;
        });
        const ok = await updateMatchResult(matchId, { heim, gast }, specialAntworten);
        if(!ok){ showToast('Speichern fehlgeschlagen'); return; }
        showToast('Spiel ausgewertet!');
        renderAll();
      });
    });
  });

  $$('[data-action="delete-match"]').forEach(btn=>{
    btn.addEventListener('click', async ()=>{
      if(!confirm('Dieses Spiel wirklich löschen?')) return;
      const ok = await deleteMatchRow(btn.dataset.match);
      if(!ok){ showToast('Löschen fehlgeschlagen'); return; }
      renderAll();
    });
  });
}

/* ---------- tabs ---------- */
let adminUnlocked = false;
$$('nav.tabs button').forEach(btn=>{
  btn.addEventListener('click', ()=>{
    if(btn.dataset.tab === 'admin' && !adminUnlocked){
      const pw = window.prompt('Admin-Passwort:');
      if(pw === null) return;
      if(pw !== ADMIN_PASSWORD){ showToast('Falsches Passwort'); return; }
      adminUnlocked = true;
    }
    $$('nav.tabs button').forEach(b=>b.classList.remove('active'));
    $$('section.tab').forEach(s=>s.classList.remove('active'));
    btn.classList.add('active');
    $(`#tab-${btn.dataset.tab}`).classList.add('active');
  });
});

/* ---------- main render ---------- */
async function renderAll(){
  await loadMatches();
  await renderMatches();
  await renderLeaderboard();
  renderAdminMatchList();
}

ensureUsername();
