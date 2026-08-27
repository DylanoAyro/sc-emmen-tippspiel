import { STATE } from '../state.js';
import { loadMatchesFromDb } from '../api/matches.js';
import { renderMatches } from './spiele.js';
import { renderLeaderboard } from './rangliste.js';
import { renderAdminMatchList, renderAdminPlayerList } from './admin.js';

export async function renderAll(){
  STATE.matches = await loadMatchesFromDb();
  await renderMatches();
  await renderLeaderboard();
  renderAdminMatchList();
  renderAdminPlayerList();
}
