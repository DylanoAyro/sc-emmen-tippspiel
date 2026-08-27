import { $, $$, showToast } from './dom.js';
import { STATE } from './state.js';
import { ADMIN_PASSWORD } from '../config.js';

$$('nav.tabs button').forEach(btn=>{
  btn.addEventListener('click', ()=>{
    if(btn.dataset.tab === 'admin' && !STATE.adminUnlocked){
      const pw = window.prompt('Admin-Merkwort:');
      if(pw === null) return;
      if(pw !== ADMIN_PASSWORD){ showToast('Falsches Merkwort'); return; }
      STATE.adminUnlocked = true;
    }
    $$('nav.tabs button').forEach(b=>b.classList.remove('active'));
    $$('section.tab').forEach(s=>s.classList.remove('active'));
    btn.classList.add('active');
    $(`#tab-${btn.dataset.tab}`).classList.add('active');
  });
});
