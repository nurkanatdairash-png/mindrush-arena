// ═══════════════════════════════════════════════════════
// MindRush Arena — app.js
// ═══════════════════════════════════════════════════════

const SB_URL = 'https://phphvmaulvygsjhjwygh.supabase.co';
const SB_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBocGh2bWF1bHZ5Z3NqaGp3eXpoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg0MzA4OTYsImV4cCI6MjA5NDAwNjg5Nn0.rcT3uPqZYUuR5ODlxYdZ1EXCpcDmeGcNMibIQcamU28';

const SB = supabase.createClient(SB_URL, SB_KEY);

// ── State ────────────────────────────────────────────────
const ST = {
  user: null,
  profile: null,
  achievements: [],
  scores: [],
  currentGame: null,
  lbFilter: 'all',
};

// ── XP / Rank thresholds ─────────────────────────────────
const RANKS = [
  { name: 'Bronze',   min: 0 },
  { name: 'Silver',   min: 500 },
  { name: 'Gold',     min: 1500 },
  { name: 'Platinum', min: 3500 },
  { name: 'Diamond',  min: 7500 },
  { name: 'Master',   min: 15000 },
  { name: 'Legend',   min: 30000 },
];

const LEVEL_XP = (lvl) => lvl * 100; // XP needed to reach next level from current

function rankForXP(xp) {
  let r = RANKS[0];
  for (const rank of RANKS) { if (xp >= rank.min) r = rank; }
  return r.name;
}

function levelForXP(xp) {
  let lvl = 1;
  let cum = 0;
  while (true) {
    const need = LEVEL_XP(lvl);
    if (xp < cum + need) break;
    cum += need;
    lvl++;
    if (lvl > 999) break;
  }
  return lvl;
}

function xpInLevel(xp) {
  let lvl = 1, cum = 0;
  while (true) {
    const need = LEVEL_XP(lvl);
    if (xp < cum + need) return { current: xp - cum, needed: need };
    cum += need; lvl++;
    if (lvl > 999) return { current: 0, needed: 100 };
  }
}

// ── All achievement definitions ──────────────────────────
const ACHIEVEMENT_DEFS = [
  { id: 'first_game',      icon: '🎮', name: 'First Blood',       desc: 'Play your first game' },
  { id: 'ten_games',       icon: '🔟', name: 'Dedicated',         desc: 'Play 10 games' },
  { id: 'fifty_games',     icon: '💯', name: 'Veteran',           desc: 'Play 50 games' },
  { id: 'reaction_ace',    icon: '⚡', name: 'Lightning Reflex',  desc: 'Score 500+ in Reaction Rush' },
  { id: 'memory_ace',      icon: '🧩', name: 'Memory Palace',     desc: 'Score 500+ in Memory Matrix' },
  { id: 'logic_ace',       icon: '🔢', name: 'Logic Lord',        desc: 'Score 500+ in Logic Blitz' },
  { id: 'strategy_ace',    icon: '🧠', name: 'Grand Strategist',  desc: 'Score 500+ in Neural Strategy' },
  { id: 'all_games',       icon: '🌟', name: 'All-Rounder',       desc: 'Play all 4 game types' },
  { id: 'streak_3',        icon: '🔥', name: 'On Fire',           desc: '3-day login streak' },
  { id: 'streak_7',        icon: '🚀', name: 'Week Warrior',      desc: '7-day login streak' },
  { id: 'silver_rank',     icon: '🥈', name: 'Rising Star',       desc: 'Reach Silver rank' },
  { id: 'gold_rank',       icon: '🥇', name: 'Gold Fever',        desc: 'Reach Gold rank' },
];

// ═══════════════════════════════════════════════════════
// INIT
// ═══════════════════════════════════════════════════════
window.addEventListener('DOMContentLoaded', () => {
  SB.auth.onAuthStateChange(async (event, session) => {
    if (session?.user) {
      if (!ST.user || ST.user.id !== session.user.id) {
        ST.user = session.user;
        await loadProfile();
        closeAuth();
        renderTopbar();
        checkDailyReward();
        loadPersonalBests();
        checkAchievements();
      }
    } else {
      ST.user = null;
      ST.profile = null;
      ST.achievements = [];
      ST.scores = [];
      renderTopbar();
      hideDailyReward();
    }
  });

  loadHomeStats();
  loadLeaderboard('all');
  loadMiniLeaderboard();
});

// ── Profile ──────────────────────────────────────────────
async function loadProfile(depth = 0) {
  const { data, error } = await SB.from('profiles').select('*').eq('id', ST.user.id).single();
  if (error) {
    if (error.code === 'PGRST116' && depth === 0) {
      await createProfile();
      return loadProfile(1);
    }
    return;
  }
  ST.profile = data;
  renderProfilePage();
  return data;
}

async function createProfile() {
  const username = ST.user.user_metadata?.username || ST.user.email.split('@')[0];
  await SB.from('profiles').insert({
    id: ST.user.id,
    username,
    xp: 0,
    level: 1,
    rank: 'Bronze',
  }).select().single();
}

// ── Topbar ───────────────────────────────────────────────
function renderTopbar() {
  const userInfo = document.getElementById('userInfo');
  const authButtons = document.getElementById('authButtons');
  const profileBtn = document.querySelector('[data-page="profile"]');

  if (ST.user && ST.profile) {
    userInfo.style.display = 'flex';
    authButtons.style.display = 'none';
    if (profileBtn) profileBtn.style.display = '';

    document.getElementById('topUsername').textContent = ST.profile.username;
    document.getElementById('topRank').textContent = ST.profile.rank;
    document.getElementById('topRank').className = `user-rank-badge rank-${ST.profile.rank.toLowerCase()}`;

    const { current, needed } = xpInLevel(ST.profile.xp);
    document.getElementById('topXpFill').style.width = `${Math.min(100, (current / needed) * 100)}%`;
  } else {
    userInfo.style.display = 'none';
    authButtons.style.display = 'flex';
    if (profileBtn) profileBtn.style.display = 'none';
  }
}

// ── Profile Page ─────────────────────────────────────────
function renderProfilePage() {
  if (!ST.profile) return;
  const p = ST.profile;

  const initials = (p.username || '?').slice(0, 2).toUpperCase();
  document.getElementById('profileAvatar').textContent = initials;
  document.getElementById('profileUsername').textContent = p.username;

  const rankEl = document.getElementById('profileRank');
  rankEl.textContent = p.rank;
  rankEl.className = `profile-rank rank-${p.rank.toLowerCase()}`;

  document.getElementById('profileStreak').textContent = `🔥 ${p.streak} day streak`;
  document.getElementById('pstatXP').textContent = p.xp.toLocaleString();
  document.getElementById('pstatLevel').textContent = p.level;
  document.getElementById('pstatGames').textContent = p.total_games;
  document.getElementById('pstatBest').textContent = p.best_score.toLocaleString();

  const { current, needed } = xpInLevel(p.xp);
  document.getElementById('pXpLevel').textContent = p.level;
  document.getElementById('pXpCurrent').textContent = current.toLocaleString();
  document.getElementById('pXpNext').textContent = needed.toLocaleString();
  document.getElementById('pXpFill').style.width = `${Math.min(100, (current / needed) * 100)}%`;

  renderAchievements();
  loadRecentScores();
}

// ── Achievements ─────────────────────────────────────────
function renderAchievements() {
  const grid = document.getElementById('achievementsGrid');
  const unlocked = new Set(ST.achievements.map(a => a.achievement_id));
  document.getElementById('achieveCount').textContent = `${unlocked.size} / ${ACHIEVEMENT_DEFS.length}`;

  grid.innerHTML = ACHIEVEMENT_DEFS.map(a => `
    <div class="achieve-badge ${unlocked.has(a.id) ? 'unlocked' : 'locked'}" title="${a.desc}">
      <div class="ab-icon">${a.icon}</div>
      <div class="ab-name">${a.name}</div>
    </div>
  `).join('');
}

async function checkAchievements() {
  if (!ST.user) return;

  const { data: existing } = await SB.from('achievements').select('achievement_id').eq('user_id', ST.user.id);
  ST.achievements = existing || [];
  const unlockedIds = new Set(ST.achievements.map(a => a.achievement_id));

  const p = ST.profile;
  if (!p) return;

  const toUnlock = [];

  if (p.total_games >= 1 && !unlockedIds.has('first_game')) toUnlock.push('first_game');
  if (p.total_games >= 10 && !unlockedIds.has('ten_games')) toUnlock.push('ten_games');
  if (p.total_games >= 50 && !unlockedIds.has('fifty_games')) toUnlock.push('fifty_games');
  if (p.streak >= 3 && !unlockedIds.has('streak_3')) toUnlock.push('streak_3');
  if (p.streak >= 7 && !unlockedIds.has('streak_7')) toUnlock.push('streak_7');
  if (p.xp >= 500 && !unlockedIds.has('silver_rank')) toUnlock.push('silver_rank');
  if (p.xp >= 1500 && !unlockedIds.has('gold_rank')) toUnlock.push('gold_rank');

  // Game-specific bests from scores
  const { data: scores } = await SB.from('scores').select('game_type, score').eq('user_id', ST.user.id);
  if (scores) {
    const bestByGame = {};
    for (const s of scores) {
      if (!bestByGame[s.game_type] || s.score > bestByGame[s.game_type]) bestByGame[s.game_type] = s.score;
    }
    if ((bestByGame.reaction || 0) >= 500 && !unlockedIds.has('reaction_ace')) toUnlock.push('reaction_ace');
    if ((bestByGame.memory || 0) >= 500 && !unlockedIds.has('memory_ace')) toUnlock.push('memory_ace');
    if ((bestByGame.logic || 0) >= 500 && !unlockedIds.has('logic_ace')) toUnlock.push('logic_ace');
    if ((bestByGame.strategy || 0) >= 500 && !unlockedIds.has('strategy_ace')) toUnlock.push('strategy_ace');
    const gameTypes = new Set(scores.map(s => s.game_type));
    if (['reaction','memory','logic','strategy'].every(g => gameTypes.has(g)) && !unlockedIds.has('all_games')) toUnlock.push('all_games');
  }

  for (const id of toUnlock) {
    await SB.from('achievements').insert({ user_id: ST.user.id, achievement_id: id }).select();
    const def = ACHIEVEMENT_DEFS.find(a => a.id === id);
    if (def) showAchievementPopup(def);
    ST.achievements.push({ achievement_id: id });
  }

  renderAchievements();
}

function showAchievementPopup(def) {
  const popup = document.getElementById('achievePopup');
  document.getElementById('achieveIcon').textContent = def.icon;
  document.getElementById('achieveName').textContent = def.name;
  popup.style.display = 'flex';
  setTimeout(() => { popup.style.display = 'none'; }, 3500);
}

// ── Daily Reward ─────────────────────────────────────────
async function checkDailyReward() {
  if (!ST.user) return;
  const today = new Date().toISOString().slice(0, 10);
  const { data } = await SB.from('daily_rewards').select('id').eq('user_id', ST.user.id).eq('claimed_date', today).maybeSingle();
  if (!data) {
    document.getElementById('dailyRewardCard').style.display = 'flex';
  } else {
    hideDailyReward();
  }
}

function hideDailyReward() {
  document.getElementById('dailyRewardCard').style.display = 'none';
}

async function claimDaily() {
  if (!ST.user || !ST.profile) return;
  const today = new Date().toISOString().slice(0, 10);
  const btn = document.getElementById('dailyBtn');
  btn.disabled = true;

  const streak = ST.profile.streak + 1;
  const xp = 50 + (streak >= 7 ? 100 : streak >= 3 ? 50 : 0);

  const { error: re } = await SB.from('daily_rewards').insert({ user_id: ST.user.id, claimed_date: today, xp_awarded: xp });
  if (re) { btn.disabled = false; return showToast('Could not claim — try again'); }

  await awardXP(xp, `daily reward (streak ${streak})`);
  await SB.from('profiles').update({ streak, last_login: today }).eq('id', ST.user.id);

  hideDailyReward();
  showToast(`🎁 +${xp} XP claimed! Streak: ${streak} 🔥`);
  ST.profile.streak = streak;
  await loadProfile();
}

// ── XP Award ─────────────────────────────────────────────
async function awardXP(amount, reason) {
  if (!ST.user || !ST.profile) return;
  const newXP = ST.profile.xp + amount;
  const newLevel = levelForXP(newXP);
  const newRank = rankForXP(newXP);
  const leveled = newLevel > ST.profile.level;

  await SB.from('profiles').update({ xp: newXP, level: newLevel, rank: newRank }).eq('id', ST.user.id);
  ST.profile.xp = newXP;
  ST.profile.level = newLevel;
  ST.profile.rank = newRank;

  renderTopbar();
  if (leveled) showToast(`🎉 Level Up! You're now Level ${newLevel}!`);
}

// ── Score Submission ─────────────────────────────────────
async function submitScore(gameType, score, xpEarned) {
  if (!ST.user || !ST.profile) return;

  const username = ST.profile.username;

  await SB.from('scores').insert({ user_id: ST.user.id, username, game_type: gameType, score, xp_earned: xpEarned });

  const totalGames = (ST.profile.total_games || 0) + 1;
  const bestScore = Math.max(ST.profile.best_score || 0, score);
  await SB.from('profiles').update({ total_games: totalGames, best_score: bestScore }).eq('id', ST.user.id);
  ST.profile.total_games = totalGames;
  ST.profile.best_score = bestScore;

  await awardXP(xpEarned, gameType);
  await checkAchievements();
  await loadLeaderboard(ST.lbFilter);
  await loadMiniLeaderboard();
  loadPersonalBests();
}

// ── Personal Bests ────────────────────────────────────────
async function loadPersonalBests() {
  if (!ST.user) return;
  const { data } = await SB.from('scores').select('game_type, score').eq('user_id', ST.user.id);
  if (!data) return;

  const bests = { reaction: 0, memory: 0, logic: 0, strategy: 0 };
  for (const s of data) {
    if (s.score > (bests[s.game_type] || 0)) bests[s.game_type] = s.score;
  }

  for (const [game, score] of Object.entries(bests)) {
    const el = document.getElementById(`pb-${game}`);
    if (el) el.textContent = score > 0 ? score.toLocaleString() : '—';
    const card = document.getElementById(`best-${game}`);
    if (card) card.textContent = score > 0 ? `Best: ${score.toLocaleString()}` : 'Best: —';
  }
}

// ── Recent Scores ─────────────────────────────────────────
async function loadRecentScores() {
  if (!ST.user) return;
  const { data } = await SB.from('scores')
    .select('game_type, score, xp_earned, created_at')
    .eq('user_id', ST.user.id)
    .order('created_at', { ascending: false })
    .limit(10);

  const container = document.getElementById('recentScores');
  if (!data || !data.length) {
    container.innerHTML = '<p class="empty-msg">No games played yet. Go play!</p>';
    return;
  }

  const icons = { reaction: '⚡', memory: '🧩', logic: '🔢', strategy: '🧠' };
  container.innerHTML = data.map(s => `
    <div class="score-row">
      <span class="score-game">${icons[s.game_type] || '🎮'} ${capitalize(s.game_type)}</span>
      <span class="score-val">${s.score.toLocaleString()}</span>
      <span class="score-xp">+${s.xp_earned} XP</span>
      <span class="score-date">${timeAgo(s.created_at)}</span>
    </div>
  `).join('');
}

// ── Leaderboard ───────────────────────────────────────────
async function loadLeaderboard(filter) {
  ST.lbFilter = filter;
  const container = document.getElementById('lbFull');
  if (!container) return;

  let query = SB.from('scores').select('username, game_type, score').order('score', { ascending: false });
  if (filter !== 'all') query = query.eq('game_type', filter);
  query = query.limit(50);

  const { data } = await query;
  renderLeaderboard(container, data || [], filter);
}

async function loadMiniLeaderboard() {
  const { data } = await SB.from('profiles').select('username, xp, rank, level').order('xp', { ascending: false }).limit(5);
  const container = document.getElementById('lbMini');
  if (!container || !data) return;

  if (!data.length) {
    container.innerHTML = '<p class="empty-msg">No players yet. Be the first!</p>';
    return;
  }

  container.innerHTML = data.map((p, i) => `
    <div class="lb-row">
      <span class="lb-rank-num ${i < 3 ? 'top-' + (i+1) : ''}">${i < 3 ? ['🥇','🥈','🥉'][i] : i + 1}</span>
      <span class="lb-username">${esc(p.username)}</span>
      <span class="lb-rank-badge rank-${p.rank.toLowerCase()}">${p.rank}</span>
      <span class="lb-xp">${p.xp.toLocaleString()} XP</span>
    </div>
  `).join('');
}

function renderLeaderboard(container, data, filter) {
  if (!data.length) {
    container.innerHTML = '<p class="empty-msg">No scores yet for this game.</p>';
    return;
  }

  const icons = { reaction: '⚡', memory: '🧩', logic: '🔢', strategy: '🧠' };
  container.innerHTML = data.map((s, i) => `
    <div class="lb-row ${ST.profile?.username === s.username ? 'lb-mine' : ''}">
      <span class="lb-rank-num ${i < 3 ? 'top-' + (i+1) : ''}">${i < 3 ? ['🥇','🥈','🥉'][i] : i + 1}</span>
      <span class="lb-username">${esc(s.username)}</span>
      ${filter === 'all' ? `<span class="lb-game-tag">${icons[s.game_type] || ''} ${capitalize(s.game_type)}</span>` : ''}
      <span class="lb-score">${s.score.toLocaleString()}</span>
    </div>
  `).join('');
}

function filterLB(el, filter) {
  document.querySelectorAll('.lb-filter').forEach(b => b.classList.remove('active'));
  el.classList.add('active');
  loadLeaderboard(filter);
}

// ── Home Stats ────────────────────────────────────────────
async function loadHomeStats() {
  const { count: playerCount } = await SB.from('profiles').select('id', { count: 'exact', head: true });
  const { count: gameCount } = await SB.from('scores').select('id', { count: 'exact', head: true });
  const { data: topScore } = await SB.from('scores').select('score').order('score', { ascending: false }).limit(1);

  const el = (id) => document.getElementById(id);
  if (el('heroPlayers')) el('heroPlayers').textContent = (playerCount || 0).toLocaleString();
  if (el('heroGames')) el('heroGames').textContent = (gameCount || 0).toLocaleString();
  if (el('heroTop')) el('heroTop').textContent = topScore?.[0]?.score?.toLocaleString() || '—';
}

// ═══════════════════════════════════════════════════════
// GAME FLOW
// ═══════════════════════════════════════════════════════
function startGame(gameType) {
  ST.currentGame = gameType;
  const arena = document.getElementById('gameArena');
  arena.style.display = 'flex';
  document.body.style.overflow = 'hidden';

  const names = { reaction: '⚡ Reaction Rush', memory: '🧩 Memory Matrix', logic: '🔢 Logic Blitz', strategy: '🧠 Neural Strategy' };
  document.getElementById('arenaTitle').textContent = names[gameType] || gameType;

  resetHUD();
  document.querySelectorAll('.game-screen').forEach(s => s.style.display = 'none');
  document.getElementById('gameOver').style.display = 'none';

  const screen = document.getElementById(`screen-${gameType}`);
  if (screen) screen.style.display = 'flex';

  if (typeof initGame === 'function') initGame(gameType);
}

function exitGame() {
  const arena = document.getElementById('gameArena');
  arena.style.display = 'none';
  document.body.style.overflow = '';
  if (typeof cleanupGame === 'function') cleanupGame();
  ST.currentGame = null;
}

function replayGame() {
  document.getElementById('gameOver').style.display = 'none';
  startGame(ST.currentGame);
}

function resetHUD() {
  setHUD(0, 1, '—');
}

function setHUD(score, level, time) {
  document.getElementById('hudScore').textContent = score;
  document.getElementById('hudLevel').textContent = level;
  document.getElementById('hudTime').textContent = time;
}

async function endGame(score) {
  if (typeof cleanupGame === 'function') cleanupGame();

  const xpEarned = Math.floor(score / 5) + 10;
  document.getElementById('gameOver').style.display = 'flex';
  document.getElementById('goSavePrompt').style.display = 'none';

  document.getElementById('goScore').textContent = score.toLocaleString();
  document.getElementById('goXP').textContent = `+${xpEarned} XP`;

  if (ST.profile) {
    const prevBest = ST.profile.best_score || 0;
    const isNewBest = score > prevBest;
    document.getElementById('goBest').textContent = isNewBest ? '🎉 New Personal Best!' : `Best: ${prevBest.toLocaleString()}`;
    document.getElementById('goEmoji').textContent = isNewBest ? '🏆' : '💪';
    document.getElementById('goTitle').textContent = isNewBest ? 'New Record!' : 'Game Over';

    await submitScore(ST.currentGame, score, xpEarned);
    document.getElementById('goLevel').textContent = ST.profile.level;
  } else {
    document.getElementById('goBest').textContent = '';
    document.getElementById('goTitle').textContent = 'Game Over';
    document.getElementById('goEmoji').textContent = '🎮';
    document.getElementById('goLevel').textContent = '—';
    document.getElementById('goSavePrompt').style.display = 'flex';
  }
}

// ═══════════════════════════════════════════════════════
// AUTH
// ═══════════════════════════════════════════════════════
function openAuth(tab) {
  document.getElementById('authModal').style.display = 'flex';
  showAuthTab(tab);
}

function closeAuth() {
  document.getElementById('authModal').style.display = 'none';
}

function closeAuthOutside(e) {
  if (e.target.id === 'authModal') closeAuth();
}

function showAuthTab(tab) {
  ['authLogin', 'authSignup', 'authReset'].forEach(id => {
    document.getElementById(id).style.display = 'none';
  });
  const map = { login: 'authLogin', signup: 'authSignup', reset: 'authReset' };
  if (map[tab]) document.getElementById(map[tab]).style.display = 'flex';
  ['loginErr', 'signupErr', 'resetErr', 'resetOk'].forEach(id => {
    const el = document.getElementById(id);
    if (el) { el.style.display = 'none'; el.textContent = ''; }
  });
}

function showAuthErr(id, msg) {
  const el = document.getElementById(id);
  if (el) { el.textContent = msg; el.style.display = 'block'; }
}

async function doLogin() {
  const email = document.getElementById('loginEmail').value.trim();
  const pw = document.getElementById('loginPassword').value;
  if (!email || !pw) return showAuthErr('loginErr', 'Fill in all fields.');

  const btn = document.getElementById('loginBtn');
  btn.disabled = true;
  btn.textContent = 'Signing in…';

  const { error } = await SB.auth.signInWithPassword({ email, password: pw });
  btn.disabled = false;
  btn.textContent = 'Sign In';

  if (error) {
    const msg = error.message.toLowerCase().includes('email not confirmed')
      ? '✉️ Please confirm your email first — check your inbox for the confirmation link.'
      : error.message;
    return showAuthErr('loginErr', msg);
  }
  closeAuth();
  showToast('Welcome back! 👋');
}

async function doSignup() {
  const username = document.getElementById('signupUsername').value.trim();
  const email = document.getElementById('signupEmail').value.trim();
  const pw = document.getElementById('signupPassword').value;

  if (!username || !email || !pw) return showAuthErr('signupErr', 'Fill in all fields.');
  if (username.length < 2) return showAuthErr('signupErr', 'Username must be at least 2 characters.');
  if (pw.length < 6) return showAuthErr('signupErr', 'Password must be at least 6 characters.');

  const btn = document.getElementById('signupBtn');
  btn.disabled = true;
  btn.textContent = 'Creating…';

  // Check username taken
  const { data: existing } = await SB.from('profiles').select('id').eq('username', username).maybeSingle();
  if (existing) {
    btn.disabled = false;
    btn.textContent = 'Create Account';
    return showAuthErr('signupErr', 'Username already taken.');
  }

  const { data: signupData, error } = await SB.auth.signUp({ email, password: pw, options: { data: { username } } });
  btn.disabled = false;
  btn.textContent = 'Create Account';

  if (error) return showAuthErr('signupErr', error.message);

  if (!signupData.session) {
    // Email confirmation is enabled in Supabase — session won't exist until confirmed
    const el = document.getElementById('signupErr');
    if (el) {
      el.textContent = '✉️ Almost there! Check your email and click the confirmation link, then come back to sign in.';
      el.style.cssText = 'display:block;background:rgba(0,255,135,.08);border:1px solid rgba(0,255,135,.25);color:#00FF87;border-radius:8px;padding:10px;font-size:.78rem;text-align:center';
    }
    return;
  }

  closeAuth();
  showToast('Account created! Welcome to MindRush! 🎉');
}

async function doReset() {
  const email = document.getElementById('resetEmail').value.trim();
  if (!email) return showAuthErr('resetErr', 'Enter your email.');

  const { error } = await SB.auth.resetPasswordForEmail(email);
  if (error) return showAuthErr('resetErr', error.message);

  const okEl = document.getElementById('resetOk');
  if (okEl) { okEl.textContent = 'Reset link sent! Check your email.'; okEl.style.display = 'block'; }
}

async function doLogout() {
  await SB.auth.signOut();
  showToast('Logged out. See you next time!');
  showPage('home');
}

// ═══════════════════════════════════════════════════════
// NAVIGATION
// ═══════════════════════════════════════════════════════
function showPage(id) {
  document.querySelectorAll('.page').forEach(p => p.style.display = 'none');
  const target = document.getElementById(`page-${id}`);
  if (target) target.style.display = 'block';

  document.querySelectorAll('.nav-btn').forEach(b => {
    b.classList.toggle('active', b.dataset.page === id);
  });

  if (id === 'leaderboard') loadLeaderboard(ST.lbFilter);
  if (id === 'profile' && ST.profile) renderProfilePage();

  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function scrollToGames() {
  document.getElementById('gamesSection')?.scrollIntoView({ behavior: 'smooth' });
}

// ═══════════════════════════════════════════════════════
// UTILS
// ═══════════════════════════════════════════════════════
function showToast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 3000);
}

function esc(str) {
  return (str || '').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function capitalize(s) {
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : '';
}

function timeAgo(dateStr) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}
