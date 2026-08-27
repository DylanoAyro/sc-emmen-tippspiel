import { $, $$, escapeHtml, showToast, fmtDate, toLocalInputValue } from '../dom.js';
import { STATE } from '../state.js';
import { insertMatch, updateMatchResult, deleteMatchRow, updateMatchFields, parseSpecialsInput } from '../api/matches.js';
import { loadPlayerNames, updatePlayer, deletePlayerRow } from '../api/players.js';
import { renderAll } from './index.js';

/* ---------- Neues Spiel ---------- */
$('#addMatchBtn').addEventListener('click', async ()=>{
  const opponent = $('#newOpponent').value.trim();
  const homeAway = $('#newHomeAway').value;
  const kickoff = $('#newKickoff').value;
  if(!opponent || !kickoff){
    showToast('Gegner und Anpfiff-Zeit ausfüllen');
    return;
  }
  const specials = parseSpecialsInput($('#newSpecials').value);
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

/* ---------- Spiele verwalten ---------- */
export function renderAdminMatchList(){
  STATE.formDirty = false;
  const container = $('#adminMatchList');
  const empty = $('#adminEmpty');
  if(STATE.matches.length === 0){
    container.innerHTML = '';
    empty.style.display = 'block';
    return;
  }
  empty.style.display = 'none';
  container.innerHTML = STATE.matches.map(m=>{
    const label = m.homeAway === 'heim' ? `SC Emmen 3 – ${escapeHtml(m.opponent)}` : `${escapeHtml(m.opponent)} – SC Emmen 3`;
    const doneTag = m.status === 'beendet' ? ` (${m.ergebnis.heim}:${m.ergebnis.gast} ausgewertet)` : '';
    return `<div class="admin-match-row" data-match="${m.id}">
      <div class="info">
        <div class="op">${label}${doneTag}</div>
        <div class="meta">${fmtDate(m.kickoff)}</div>
      </div>
      <div class="row-actions">
        <button class="btn btn-ghost" data-action="edit-match" data-match="${m.id}">Bearbeiten</button>
        ${m.status !== 'beendet' ? `<button class="btn btn-ghost" data-action="enter-result" data-match="${m.id}">Resultat erfassen</button>` : ''}
        <button class="btn btn-danger" data-action="delete-match" data-match="${m.id}">Löschen</button>
      </div>
      <div class="result-form" id="editForm-${m.id}" style="display:none; width:100%;"></div>
      <div class="result-form" id="resultForm-${m.id}" style="display:none; width:100%;"></div>
    </div>`;
  }).join('');

  $$('[data-action="edit-match"]').forEach(btn=>{
    btn.addEventListener('click', ()=>{
      const matchId = btn.dataset.match;
      const m = STATE.matches.find(x=>x.id === matchId);
      const formDiv = $(`#editForm-${matchId}`);
      if(formDiv.style.display === 'block'){ formDiv.style.display = 'none'; return; }
      const specialsText = (m.specials||[]).map(sp=>`${sp.frage}|${sp.typ}`).join('\n');
      formDiv.innerHTML = `
        <div class="field"><label>Gegner</label><input type="text" id="edit-opponent-${matchId}" value="${escapeHtml(m.opponent)}"></div>
        <div class="row2">
          <div class="field">
            <label>Heim / Auswärts</label>
            <select id="edit-homeaway-${matchId}">
              <option value="heim" ${m.homeAway==='heim'?'selected':''}>Heimspiel</option>
              <option value="auswaerts" ${m.homeAway==='auswaerts'?'selected':''}>Auswärtsspiel</option>
            </select>
          </div>
          <div class="field"><label>Anpfiff</label><input type="datetime-local" id="edit-kickoff-${matchId}" value="${toLocalInputValue(m.kickoff)}"></div>
        </div>
        <div class="field">
          <label>Extra-Fragen (eine pro Zeile)</label>
          <textarea id="edit-specials-${matchId}">${escapeHtml(specialsText)}</textarea>
          <div class="hint">Format: Frage, senkrechter Strich, dann „text" oder „janein". Reihenfolge nicht ändern, sonst verlieren bereits abgegebene Antworten ihre Zuordnung.</div>
        </div>
        <div class="ticket-actions"><button class="btn btn-primary" data-action="save-match-edit" data-match="${matchId}">Änderungen speichern</button></div>`;
      formDiv.style.display = 'block';

      formDiv.querySelector('[data-action="save-match-edit"]').addEventListener('click', async ()=>{
        const opponent = $(`#edit-opponent-${matchId}`).value.trim();
        const homeAway = $(`#edit-homeaway-${matchId}`).value;
        const kickoffVal = $(`#edit-kickoff-${matchId}`).value;
        if(!opponent || !kickoffVal){ showToast('Gegner und Anpfiff-Zeit ausfüllen'); return; }
        const specials = parseSpecialsInput($(`#edit-specials-${matchId}`).value, m.specials);
        const ok = await updateMatchFields(matchId, {
          opponent, homeAway, kickoff: new Date(kickoffVal).toISOString(), specials
        });
        if(!ok){ showToast('Speichern fehlgeschlagen'); return; }
        showToast('Spiel aktualisiert');
        renderAll();
      });
    });
  });

  $$('[data-action="enter-result"]').forEach(btn=>{
    btn.addEventListener('click', ()=>{
      const matchId = btn.dataset.match;
      const m = STATE.matches.find(x=>x.id === matchId);
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

/* ---------- Spieler verwalten ---------- */
export async function renderAdminPlayerList(){
  STATE.formDirty = false;
  const container = $('#adminPlayerList');
  const empty = $('#adminPlayerEmpty');
  const players = await loadPlayerNames();
  if(players.length === 0){
    container.innerHTML = '';
    empty.style.display = 'block';
    return;
  }
  empty.style.display = 'none';
  container.innerHTML = players.map(name=>`
    <div class="admin-match-row" data-player="${escapeHtml(name)}">
      <div class="info"><div class="op">${escapeHtml(name)}</div></div>
      <div class="row-actions">
        <button class="btn btn-ghost" data-action="edit-player">Bearbeiten</button>
        <button class="btn btn-danger" data-action="delete-player">Löschen</button>
      </div>
      <div class="result-form" style="display:none; width:100%;"></div>
    </div>`).join('');

  $$('#adminPlayerList [data-action="edit-player"]').forEach(btn=>{
    btn.addEventListener('click', ()=>{
      const row = btn.closest('.admin-match-row');
      const name = row.dataset.player;
      const formDiv = row.querySelector('.result-form');
      if(formDiv.style.display === 'block'){ formDiv.style.display = 'none'; return; }
      formDiv.innerHTML = `
        <div class="field"><label>Name</label><input type="text" class="edit-player-name" value="${escapeHtml(name)}"></div>
        <div class="field"><label>Neues Merkwort (leer lassen zum Beibehalten)</label><input type="password" class="edit-player-password" autocomplete="new-password"></div>
        <div class="hint">Umbenennen ändert auch den Namen bei bereits abgegebenen Tipps mit.</div>
        <div class="ticket-actions"><button class="btn btn-primary" data-action="save-player-edit">Speichern</button></div>`;
      formDiv.style.display = 'block';

      formDiv.querySelector('[data-action="save-player-edit"]').addEventListener('click', async ()=>{
        const newName = formDiv.querySelector('.edit-player-name').value.trim();
        const newPassword = formDiv.querySelector('.edit-player-password').value;
        if(!newName){ showToast('Name darf nicht leer sein'); return; }
        const ok = await updatePlayer(name, newName, newPassword || null);
        if(!ok){ showToast('Speichern fehlgeschlagen'); return; }
        showToast('Spieler aktualisiert');
        renderAll();
      });
    });
  });

  $$('#adminPlayerList [data-action="delete-player"]').forEach(btn=>{
    btn.addEventListener('click', async ()=>{
      const row = btn.closest('.admin-match-row');
      const name = row.dataset.player;
      if(!confirm(`Spieler "${name}" wirklich löschen? Der Login-Zugang wird entfernt, bereits abgegebene Tipps bleiben unter diesem Namen erhalten.`)) return;
      const ok = await deletePlayerRow(name);
      if(!ok){ showToast('Löschen fehlgeschlagen'); return; }
      showToast('Spieler gelöscht');
      renderAll();
    });
  });
}
