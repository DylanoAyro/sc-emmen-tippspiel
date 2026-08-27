import { $, $$, escapeHtml, shorten, fmtDate, showToast } from '../dom.js';
import { STATE } from '../state.js';
import { loadMyTip, loadTipsForMatch, saveTip } from '../api/tips.js';
import { computePoints } from '../scoring.js';

export async function renderMatches(){
  STATE.formDirty = false;
  const list = $('#matchesList');
  if(STATE.matches.length === 0){
    list.innerHTML = '<div class="empty">Noch keine Spiele angelegt. Unter "Admin" das erste Spiel eintragen.</div>';
    return;
  }
  const now = new Date();
  let html = '';
  for(const m of STATE.matches){
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
      const ok = await saveTip(matchId, {name: STATE.username, heim, gast, spezial, submittedAt: new Date().toISOString()});
      if(ok){ showToast('Tipp gespeichert!'); }
      else{ showToast('Speichern fehlgeschlagen'); }
      renderMatches();
    });
  });
}
