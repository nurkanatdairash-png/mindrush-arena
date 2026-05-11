// ═══════════════════════════════════════════════════════
// MindRush Arena — game.js
// 4 Mini-Games: Reaction Rush, Memory Matrix, Logic Blitz, Neural Strategy
// ═══════════════════════════════════════════════════════

let _gameTimer = null;
let _gameState = {};

function initGame(type) {
  _gameState = {};
  if (_gameTimer) { clearInterval(_gameTimer); clearTimeout(_gameTimer); _gameTimer = null; }

  if (type === 'reaction') initReaction();
  else if (type === 'memory') initMemory();
  else if (type === 'logic') initLogic();
  else if (type === 'strategy') initStrategy();
}

function cleanupGame() {
  if (_gameTimer) { clearInterval(_gameTimer); clearTimeout(_gameTimer); _gameTimer = null; }
}

// ═══════════════════════════════════════════════════════
// 1. REACTION RUSH
// ═══════════════════════════════════════════════════════
// Rounds: wait random 1-4s, then show target. Tap as fast as possible.
// Score = sum of (1000 - reactionTime_ms), min 0 per round.

const REACTION_ROUNDS = 5;

function initReaction() {
  _gameState = {
    round: 0,
    times: [],
    score: 0,
    waitTimer: null,
    targetShown: false,
    tooEarlyCount: 0,
  };

  document.getElementById('reactionRoundDisp').textContent = REACTION_ROUNDS;
  document.getElementById('reactionInstructions').style.display = 'flex';
  document.getElementById('reactionField').style.display = 'none';
}

function reactionStart() {
  document.getElementById('reactionInstructions').style.display = 'none';
  document.getElementById('reactionField').style.display = 'flex';
  _gameState.round = 0;
  _gameState.times = [];
  _gameState.score = 0;
  reactionNextRound();
}

function reactionNextRound() {
  _gameState.targetShown = false;
  const wait = document.getElementById('reactionWait');
  const target = document.getElementById('reactionTarget');
  const result = document.getElementById('reactionResult');

  target.style.display = 'none';
  target.classList.remove('pulse');
  result.textContent = '';
  wait.style.display = 'flex';
  wait.textContent = `Round ${_gameState.round + 1} / ${REACTION_ROUNDS} — Get ready…`;

  const delay = 1000 + Math.random() * 3000;
  _gameState.waitTimer = setTimeout(() => {
    wait.style.display = 'none';
    target.style.display = 'flex';
    target.classList.add('pulse');
    target.style.background = `hsl(${Math.random()*60 + 100}, 80%, 55%)`;
    _gameState.targetShown = true;
    _gameState.shownAt = Date.now();
  }, delay);
}

function reactionHit() {
  if (!_gameState.targetShown) {
    // Too early
    if (_gameState.waitTimer) clearTimeout(_gameState.waitTimer);
    _gameState.tooEarlyCount++;
    document.getElementById('reactionWait').textContent = '⚠️ Too early! Wait for the target!';
    document.getElementById('reactionWait').style.display = 'flex';
    document.getElementById('reactionTarget').style.display = 'none';
    setTimeout(reactionNextRound, 1200);
    return;
  }

  const ms = Date.now() - _gameState.shownAt;
  _gameState.times.push(ms);
  _gameState.targetShown = false;

  const pts = Math.max(0, 1000 - ms);
  _gameState.score += pts;
  _gameState.round++;

  const result = document.getElementById('reactionResult');
  result.textContent = `${ms}ms — +${Math.round(pts)} pts`;

  setHUD(_gameState.score, _gameState.round, `${ms}ms`);

  document.getElementById('reactionTarget').style.display = 'none';

  if (_gameState.round >= REACTION_ROUNDS) {
    setTimeout(reactionFinish, 800);
  } else {
    setTimeout(reactionNextRound, 1000);
  }
}

function reactionFinish() {
  const times = _gameState.times;
  const avg = times.length ? Math.round(times.reduce((a, b) => a + b, 0) / times.length) : 0;
  const finalScore = Math.round(_gameState.score);

  document.getElementById('reactionField').style.display = 'none';

  const hud = document.getElementById('hudTime');
  if (hud) hud.textContent = `Avg ${avg}ms`;

  endGame(finalScore);
}

// ═══════════════════════════════════════════════════════
// 2. MEMORY MATRIX
// ═══════════════════════════════════════════════════════
// Show a pattern of highlighted cells on a grid for 2s.
// Player must click the same cells from memory.
// Each correct round increases grid size and pattern length.

function initMemory() {
  _gameState = {
    round: 1,
    gridSize: 3,
    score: 0,
    pattern: [],
    playerClicks: [],
    phase: 'show', // 'show' | 'input'
  };
  memoryRender();
  memoryShowRound();
}

function memoryRender() {
  const size = _gameState.gridSize;
  document.getElementById('memRound').textContent = _gameState.round;
  document.getElementById('memGridSize').textContent = size;
  document.getElementById('memGridSize2').textContent = size;

  const grid = document.getElementById('memoryGrid');
  grid.style.gridTemplateColumns = `repeat(${size}, 1fr)`;
  grid.innerHTML = '';
  for (let i = 0; i < size * size; i++) {
    const cell = document.createElement('div');
    cell.className = 'mem-cell';
    cell.dataset.idx = i;
    cell.addEventListener('click', () => memoryClick(i));
    grid.appendChild(cell);
  }
}

function memoryShowRound() {
  _gameState.phase = 'show';
  document.getElementById('memSubmitBtn').style.display = 'none';
  document.getElementById('memPhase').textContent = 'Memorize!';
  document.getElementById('memoryMsg').textContent = 'Watch the pattern carefully…';

  const size = _gameState.gridSize;
  const patLen = Math.min(size * size, 3 + Math.floor(_gameState.round * 1.5));
  const cells = Array.from({ length: size * size }, (_, i) => i);
  shuffleArr(cells);
  _gameState.pattern = cells.slice(0, patLen);
  _gameState.playerClicks = [];

  // Flash pattern
  const allCells = document.querySelectorAll('.mem-cell');
  allCells.forEach(c => c.classList.remove('active', 'correct', 'wrong', 'target'));

  let i = 0;
  function showNext() {
    if (i > 0) allCells[_gameState.pattern[i - 1]]?.classList.remove('target');
    if (i >= _gameState.pattern.length) {
      setTimeout(memoryStartInput, 400);
      return;
    }
    allCells[_gameState.pattern[i]]?.classList.add('target');
    i++;
    setTimeout(showNext, 700);
  }
  setTimeout(showNext, 600);
}

function memoryStartInput() {
  _gameState.phase = 'input';
  document.getElementById('memPhase').textContent = 'Repeat!';
  document.getElementById('memoryMsg').textContent = `Click the ${_gameState.pattern.length} cells you saw`;
  document.getElementById('memSubmitBtn').style.display = 'block';

  document.querySelectorAll('.mem-cell').forEach(c => c.classList.remove('target'));
}

function memoryClick(idx) {
  if (_gameState.phase !== 'input') return;
  const cell = document.querySelector(`.mem-cell[data-idx="${idx}"]`);
  if (!cell) return;
  if (cell.classList.contains('active')) {
    cell.classList.remove('active');
    _gameState.playerClicks = _gameState.playerClicks.filter(i => i !== idx);
  } else {
    cell.classList.add('active');
    _gameState.playerClicks.push(idx);
  }
}

function memorySubmit() {
  if (_gameState.phase !== 'input') return;

  const correct = _gameState.pattern;
  const player = _gameState.playerClicks;

  // Score: correct cells hit
  const correctHits = player.filter(i => correct.includes(i)).length;
  const wrongHits = player.filter(i => !correct.includes(i)).length;
  const pts = Math.max(0, correctHits * 20 - wrongHits * 10);
  _gameState.score += pts;

  const allCells = document.querySelectorAll('.mem-cell');
  allCells.forEach(c => c.classList.remove('active'));
  correct.forEach(i => allCells[i]?.classList.add('correct'));
  player.filter(i => !correct.includes(i)).forEach(i => allCells[i]?.classList.add('wrong'));

  const perfect = correctHits === correct.length && wrongHits === 0;
  document.getElementById('memoryMsg').textContent = perfect
    ? `✅ Perfect! +${pts} pts`
    : `❌ Got ${correctHits}/${correct.length} — +${pts} pts`;
  document.getElementById('memSubmitBtn').style.display = 'none';

  setHUD(_gameState.score, _gameState.round, `${correctHits}/${correct.length}`);

  if (_gameState.round >= 8 || (!perfect && _gameState.round >= 3)) {
    setTimeout(() => endGame(_gameState.score), 1600);
  } else {
    _gameState.round++;
    if (perfect && _gameState.round % 2 === 0) _gameState.gridSize = Math.min(6, _gameState.gridSize + 1);
    setTimeout(() => { memoryRender(); memoryShowRound(); }, 1800);
  }
}

// ═══════════════════════════════════════════════════════
// 3. LOGIC BLITZ
// ═══════════════════════════════════════════════════════
// Speed-answer math/pattern questions. 3 lives. Time limit per question.
// Streak bonuses for consecutive correct answers.

const LOGIC_TIME = 8000; // ms per question
const LOGIC_LIVES = 3;

function initLogic() {
  _gameState = {
    score: 0,
    lives: LOGIC_LIVES,
    streak: 0,
    questionNum: 0,
    timerStart: 0,
    answered: false,
  };
  renderLogicLives();
  nextLogicQuestion();
}

function renderLogicLives() {
  document.getElementById('logicLives').textContent = '❤️'.repeat(_gameState.lives) + '🖤'.repeat(LOGIC_LIVES - _gameState.lives);
}

function nextLogicQuestion() {
  if (_gameState.lives <= 0) { endGame(_gameState.score); return; }

  _gameState.questionNum++;
  _gameState.answered = false;

  if (_gameTimer) clearInterval(_gameTimer);

  const q = generateLogicQuestion(_gameState.questionNum);
  _gameState.currentAnswer = q.answer;

  document.getElementById('logicQuestion').textContent = q.question;
  document.getElementById('logicStreak').parentElement && (document.getElementById('logicStreak').textContent = _gameState.streak);

  const opts = document.getElementById('logicOptions');
  opts.innerHTML = '';
  q.options.forEach(opt => {
    const btn = document.createElement('button');
    btn.className = 'logic-opt';
    btn.textContent = opt;
    btn.onclick = () => logicAnswer(opt, btn);
    opts.appendChild(btn);
  });

  // Timer bar
  const fill = document.getElementById('logicTimerFill');
  fill.style.transition = 'none';
  fill.style.width = '100%';
  setTimeout(() => {
    fill.style.transition = `width ${LOGIC_TIME}ms linear`;
    fill.style.width = '0%';
  }, 30);

  _gameState.timerStart = Date.now();
  _gameTimer = setTimeout(() => {
    if (!_gameState.answered) {
      _gameState.answered = true;
      _gameState.lives--;
      _gameState.streak = 0;
      renderLogicLives();
      document.getElementById('logicQuestion').textContent = `⏰ Time's up! Answer: ${_gameState.currentAnswer}`;
      document.querySelectorAll('.logic-opt').forEach(b => b.disabled = true);
      setTimeout(nextLogicQuestion, 1200);
    }
  }, LOGIC_TIME);
}

function logicAnswer(val, btn) {
  if (_gameState.answered) return;
  _gameState.answered = true;
  clearTimeout(_gameTimer);

  const correct = String(val) === String(_gameState.currentAnswer);
  const timeMs = Date.now() - _gameState.timerStart;
  const speedBonus = Math.max(0, Math.floor((LOGIC_TIME - timeMs) / 100));

  document.querySelectorAll('.logic-opt').forEach(b => b.disabled = true);

  if (correct) {
    btn.classList.add('correct');
    _gameState.streak++;
    const streakBonus = _gameState.streak >= 5 ? 50 : _gameState.streak >= 3 ? 20 : 0;
    const pts = 100 + speedBonus + streakBonus;
    _gameState.score += pts;
    document.getElementById('logicStreak').textContent = _gameState.streak;
    setHUD(_gameState.score, _gameState.questionNum, `+${pts}`);
  } else {
    btn.classList.add('wrong');
    _gameState.lives--;
    _gameState.streak = 0;
    renderLogicLives();
    // Highlight correct answer
    document.querySelectorAll('.logic-opt').forEach(b => {
      if (String(b.textContent) === String(_gameState.currentAnswer)) b.classList.add('correct');
    });
    setHUD(_gameState.score, _gameState.questionNum, '❌');
  }

  document.getElementById('logicStreak').textContent = _gameState.streak;

  if (_gameState.lives <= 0) {
    setTimeout(() => endGame(_gameState.score), 1200);
  } else {
    setTimeout(nextLogicQuestion, 1000);
  }
}

function generateLogicQuestion(num) {
  const difficulty = Math.min(5, Math.floor(num / 4) + 1);
  const types = difficulty <= 2 ? ['add', 'sub', 'mult'] : ['add', 'sub', 'mult', 'div', 'pattern', 'comparison'];
  const type = types[Math.floor(Math.random() * types.length)];

  let question, answer, options;

  if (type === 'add') {
    const a = rnd(1, 10 + difficulty * 15);
    const b = rnd(1, 10 + difficulty * 15);
    question = `${a} + ${b} = ?`;
    answer = a + b;
  } else if (type === 'sub') {
    const a = rnd(10, 50 + difficulty * 20);
    const b = rnd(1, a);
    question = `${a} − ${b} = ?`;
    answer = a - b;
  } else if (type === 'mult') {
    const a = rnd(2, 4 + difficulty * 2);
    const b = rnd(2, 4 + difficulty * 2);
    question = `${a} × ${b} = ?`;
    answer = a * b;
  } else if (type === 'div') {
    const b = rnd(2, 9);
    const answer_ = rnd(2, 10 + difficulty);
    const a = b * answer_;
    question = `${a} ÷ ${b} = ?`;
    answer = answer_;
  } else if (type === 'pattern') {
    const start = rnd(1, 10);
    const step = rnd(2, 5 + difficulty);
    const seq = [start, start + step, start + step * 2, start + step * 3];
    answer = start + step * 4;
    question = `${seq.join(', ')}, ?`;
  } else {
    // comparison
    const a = rnd(1, 100);
    const b = rnd(1, 100);
    question = `${a} ☐ ${b} — What symbol fits? (<, >, =)`;
    answer = a < b ? '<' : a > b ? '>' : '=';
    return {
      question,
      answer,
      options: shuffleArr(['<', '>', '=']),
    };
  }

  // Build options: answer + 3 distractors
  const distractors = new Set([answer]);
  while (distractors.size < 4) {
    distractors.add(answer + rnd(-5, 5) * (difficulty + 1));
  }
  options = shuffleArr([...distractors]);

  return { question, answer, options };
}

// ═══════════════════════════════════════════════════════
// 4. NEURAL STRATEGY
// ═══════════════════════════════════════════════════════
// Othello/Reversi-style: player vs AI on 6×6 grid.
// Capture opponent pieces by flanking.

const STRAT_SIZE = 6;
const EMPTY = 0, PLAYER = 1, AI_PIECE = 2;

function initStrategy() {
  _gameState = {
    board: [],
    playerScore: 0,
    aiScore: 0,
    turn: PLAYER,
    gameOver: false,
  };

  // Init board
  const b = Array(STRAT_SIZE).fill(null).map(() => Array(STRAT_SIZE).fill(EMPTY));
  const mid = Math.floor(STRAT_SIZE / 2);
  b[mid - 1][mid - 1] = PLAYER;
  b[mid][mid] = PLAYER;
  b[mid - 1][mid] = AI_PIECE;
  b[mid][mid - 1] = AI_PIECE;
  _gameState.board = b;

  renderStrategyBoard();
  updateStrategyScores();
}

function renderStrategyBoard() {
  const container = document.getElementById('strategyBoard');
  const board = _gameState.board;
  const validMoves = _gameState.turn === PLAYER ? getValidMoves(board, PLAYER) : [];

  container.innerHTML = '';
  container.style.gridTemplateColumns = `repeat(${STRAT_SIZE}, 1fr)`;

  for (let r = 0; r < STRAT_SIZE; r++) {
    for (let c = 0; c < STRAT_SIZE; c++) {
      const cell = document.createElement('div');
      cell.className = 'strat-cell';
      const val = board[r][c];
      if (val === PLAYER) cell.classList.add('player');
      else if (val === AI_PIECE) cell.classList.add('ai');

      const isValid = validMoves.some(m => m[0] === r && m[1] === c);
      if (isValid) {
        cell.classList.add('valid-move');
        cell.onclick = () => strategyPlay(r, c);
      }

      const piece = document.createElement('div');
      piece.className = 'strat-piece';
      cell.appendChild(piece);
      container.appendChild(cell);
    }
  }
}

function strategyPlay(r, c) {
  if (_gameState.turn !== PLAYER || _gameState.gameOver) return;
  const board = _gameState.board;
  const flipped = getFlipped(board, r, c, PLAYER);
  if (!flipped.length) return;

  board[r][c] = PLAYER;
  flipped.forEach(([fr, fc]) => { board[fr][fc] = PLAYER; });

  _gameState.turn = AI_PIECE;
  updateStrategyScores();
  renderStrategyBoard();
  document.getElementById('stratTurn').textContent = 'AI thinking…';

  setTimeout(strategyAIMove, 600);
}

function strategyAIMove() {
  if (_gameState.gameOver) return;
  const board = _gameState.board;
  const moves = getValidMoves(board, AI_PIECE);

  if (!moves.length) {
    // AI has no moves — check if player has moves
    const playerMoves = getValidMoves(board, PLAYER);
    if (!playerMoves.length) { strategyEnd(); return; }
    _gameState.turn = PLAYER;
    document.getElementById('stratTurn').textContent = 'Your Turn';
    renderStrategyBoard();
    return;
  }

  // AI picks move with most flips (greedy)
  let best = null, bestCount = -1;
  for (const [r, c] of moves) {
    const flipped = getFlipped(board, r, c, AI_PIECE).length;
    if (flipped > bestCount) { bestCount = flipped; best = [r, c]; }
  }

  const [r, c] = best;
  const flipped = getFlipped(board, r, c, AI_PIECE);
  board[r][c] = AI_PIECE;
  flipped.forEach(([fr, fc]) => { board[fr][fc] = AI_PIECE; });

  _gameState.turn = PLAYER;
  updateStrategyScores();

  // Check player has moves
  const playerMoves = getValidMoves(board, PLAYER);
  if (!playerMoves.length) {
    const aiMoves = getValidMoves(board, AI_PIECE);
    if (!aiMoves.length) { strategyEnd(); return; }
    document.getElementById('stratTurn').textContent = 'No moves — AI goes again';
    setTimeout(strategyAIMove, 800);
    return;
  }

  document.getElementById('stratTurn').textContent = 'Your Turn';
  renderStrategyBoard();
}

function updateStrategyScores() {
  let p = 0, a = 0;
  for (const row of _gameState.board) {
    for (const cell of row) {
      if (cell === PLAYER) p++;
      else if (cell === AI_PIECE) a++;
    }
  }
  _gameState.playerScore = p;
  _gameState.aiScore = a;
  document.getElementById('stratYou').textContent = p;
  document.getElementById('stratAI').textContent = a;
  setHUD(p * 10, 1, `${p} vs ${a}`);
}

function strategyEnd() {
  _gameState.gameOver = true;
  const { playerScore, aiScore } = _gameState;
  const score = playerScore * 10 + (playerScore > aiScore ? 200 : 0);
  const hint = document.getElementById('stratHint');
  if (hint) hint.textContent = playerScore > aiScore ? `🏆 You win! ${playerScore} vs ${aiScore}` : playerScore === aiScore ? `🤝 Draw! ${playerScore} vs ${aiScore}` : `😤 AI wins ${aiScore} vs ${playerScore}`;
  setTimeout(() => endGame(score), 1500);
}

function getValidMoves(board, piece) {
  const moves = [];
  for (let r = 0; r < STRAT_SIZE; r++) {
    for (let c = 0; c < STRAT_SIZE; c++) {
      if (board[r][c] === EMPTY && getFlipped(board, r, c, piece).length > 0) moves.push([r, c]);
    }
  }
  return moves;
}

function getFlipped(board, r, c, piece) {
  if (board[r][c] !== EMPTY) return [];
  const opp = piece === PLAYER ? AI_PIECE : PLAYER;
  const dirs = [[-1,-1],[-1,0],[-1,1],[0,-1],[0,1],[1,-1],[1,0],[1,1]];
  const flipped = [];

  for (const [dr, dc] of dirs) {
    const line = [];
    let nr = r + dr, nc = c + dc;
    while (nr >= 0 && nr < STRAT_SIZE && nc >= 0 && nc < STRAT_SIZE && board[nr][nc] === opp) {
      line.push([nr, nc]);
      nr += dr; nc += dc;
    }
    if (line.length && nr >= 0 && nr < STRAT_SIZE && nc >= 0 && nc < STRAT_SIZE && board[nr][nc] === piece) {
      flipped.push(...line);
    }
  }
  return flipped;
}

// ═══════════════════════════════════════════════════════
// UTILS
// ═══════════════════════════════════════════════════════
function rnd(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function shuffleArr(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}
