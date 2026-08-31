import { $, escapeHtml } from '../dom.js';
import { STATE } from '../state.js';
import { loadTipsForMatch } from '../api/tips.js';
import { computePoints, POINTS } from '../scoring.js';

const POINTS_KEY_LABELS = [
  ['sieger', 'richtiger Sieger / richtiges Unentschieden'],
  ['differenz', 'richtige Tordifferenz'],
  ['heimtore', 'richtige Heimtore'],
  ['gasttore', 'richtige Auswärtstore'],
  ['extra', 'pro richtige Extra-Frage']
];

function renderPointsKey(){
  const list = $('#pointsKeyList');
  if(!list) return;
  list.innerHTML = POINTS_KEY_LABELS.map(([key, label])=>
    `<li><b>${POINTS[key]}</b><span>${escapeHtml(label)}</span></li>`
  ).join('');
}

export async function renderLeaderboard(){
  renderPointsKey();
  const totals = {};
  const finished = STATE.matches.filter(m=>m.status === 'beendet');
  for(const m of finished){
    const tips = STATE.tipsCache[m.id] || await loadTipsForMatch(m.id);
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
