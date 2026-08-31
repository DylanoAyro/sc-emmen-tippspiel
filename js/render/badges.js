import { $, escapeHtml } from '../dom.js';
import { BADGE_DEFS, computeBadges } from '../badges.js';

export async function renderBadges(){
  const results = await computeBadges();
  const list = $('#badgesList');
  const empty = $('#badgesEmpty');

  const cards = BADGE_DEFS
    .map(def => ({ def, holders: results[def.id] || [] }))
    .filter(x => x.holders.length > 0);

  if(cards.length === 0){
    list.innerHTML = '';
    empty.style.display = 'block';
    return;
  }
  empty.style.display = 'none';
  list.innerHTML = cards.map(({ def, holders }) => `
    <div class="badge-card">
      <div class="badge-icon">${def.icon}</div>
      <div class="badge-body">
        <div class="badge-name">${escapeHtml(def.name)}</div>
        <div class="badge-desc">${escapeHtml(def.description)}</div>
        <div class="badge-holders">${holders.map(h => `<b>${escapeHtml(h.name)}</b> (${escapeHtml(h.detail)})`).join(', ')}</div>
      </div>
    </div>`).join('');
}
