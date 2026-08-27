import { $ } from './dom.js';
import { STATE } from './state.js';
import { loginPlayer, registerPlayer } from './api/players.js';
import { renderAll } from './render/index.js';

function setLoginMode(mode){
  STATE.loginMode = mode;
  $('#loginTabLogin').classList.toggle('active', mode === 'login');
  $('#loginTabRegister').classList.toggle('active', mode === 'register');
  $('#loginError').style.display = 'none';
  if(mode === 'login'){
    $('#loginBtn').textContent = 'Einloggen';
    $('#loginHint').textContent = 'Melde dich mit Namen und Merkwort an.';
    $('#loginPassword').autocomplete = 'current-password';
  } else {
    $('#loginBtn').textContent = 'Account erstellen';
    $('#loginHint').textContent = 'Neuer Name + frei gewähltes Merkwort. Kein echtes Passwort verwenden!';
    $('#loginPassword').autocomplete = 'new-password';
  }
}
$('#loginTabLogin').addEventListener('click', ()=>setLoginMode('login'));
$('#loginTabRegister').addEventListener('click', ()=>setLoginMode('register'));

function showLoginOverlay(){
  setLoginMode('login');
  $('#loginOverlay').classList.remove('hidden');
  $('#loginName').focus();
}
function hideLoginOverlay(){
  $('#loginOverlay').classList.add('hidden');
}

function completeLogin(name, password, persist){
  STATE.username = name;
  if(persist){
    localStorage.setItem('tippspiel_username', name);
    localStorage.setItem('tippspiel_password', password);
  }
  $('#youName').textContent = STATE.username;
  hideLoginOverlay();
  renderAll();
  setInterval(()=>{
    if(STATE.formDirty) return; // gerade laufende Eingabe nicht überschreiben
    renderAll();
  }, 25000);
}

async function attemptLogin(){
  const name = $('#loginName').value.trim();
  const password = $('#loginPassword').value;
  const errEl = $('#loginError');
  errEl.style.display = 'none';
  if(!name || !password){
    errEl.textContent = 'Name und Merkwort ausfüllen';
    errEl.style.display = 'block';
    return;
  }
  const result = STATE.loginMode === 'login' ? await loginPlayer(name, password) : await registerPlayer(name, password);
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

export async function ensureUsername(){
  const savedName = localStorage.getItem('tippspiel_username');
  const savedPassword = localStorage.getItem('tippspiel_password');
  if(savedName && savedPassword){
    const result = await loginPlayer(savedName, savedPassword);
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
