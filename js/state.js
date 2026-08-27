export const STATE = {
  username: null,
  matches: [],
  tipsCache: {}, // matchId -> [{name, tip}]
  loginMode: 'login',
  adminUnlocked: false,

  // Verhindert, dass der periodische Auto-Refresh (renderAll alle 25s) laufende,
  // noch nicht gespeicherte Eingaben in Tipp-Feldern oder Admin-Formularen überschreibt.
  formDirty: false
};

document.addEventListener('input', (e)=>{
  const t = e.target;
  if(t.closest && (t.closest('#matchesList') || t.closest('#tab-admin'))){
    STATE.formDirty = true;
  }
});
