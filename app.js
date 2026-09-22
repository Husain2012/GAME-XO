const socket = io();
const $ = (id) => document.getElementById(id);
let myMark = null;
let currentState = null;

function showNotice(message) { $('notice').textContent = message; }
function showGame(state, mark) {
  currentState = state;
  myMark = mark;
  $('lobbyView').classList.add('hidden');
  $('gameView').classList.remove('hidden');
  $('roomCodeDisplay').textContent = state.code;
  renderPlayers(state.players);
  renderGame(state.game);
}
function renderPlayers(players) {
  const x = players.find((player) => player.mark === 'X');
  const o = players.find((player) => player.mark === 'O');
  $('playerXName').textContent = x ? x.name : 'بانتظار لاعب';
  $('playerOName').textContent = o ? o.name : 'بانتظار لاعب';
}
function renderGame(game) {
  $('board').innerHTML = '';
  game.board.forEach((mark, index) => {
    const cell = document.createElement('button');
    cell.className = `cell ${mark.toLowerCase()}`;
    cell.textContent = mark;
    cell.disabled = Boolean(mark) || game.status !== 'playing' || !currentState || currentState.players.length < 2 || game.turn !== myMark;
    cell.setAttribute('aria-label', `مربع ${index + 1}`);
    if (game.winningLine.includes(index)) cell.classList.add('win');
    cell.addEventListener('click', () => socket.emit('game:move', index));
    $('board').appendChild(cell);
  });
  const waiting = currentState.players.length < 2;
  const message = waiting ? 'شارك رمز الغرفة مع صديقك' : game.status === 'won' ? `الفائز هو ${game.winner}` : game.status === 'draw' ? 'تعادل! جولة أخرى؟' : game.turn === myMark ? 'دورك الآن' : `دور ${game.turn === 'X' ? 'X' : 'O'}`;
  $('turnBanner').textContent = message;
  $('gameTitle').textContent = waiting ? 'بانتظار اللاعب الثاني' : game.status === 'playing' ? 'المباراة بدأت' : 'انتهت الجولة';
  $('playerX').classList.toggle('active', game.turn === 'X' && game.status === 'playing');
  $('playerO').classList.toggle('active', game.turn === 'O' && game.status === 'playing');
}

$('createBtn').addEventListener('click', () => {
  const name = $('createName').value.trim();
  if (!name) {
    showNotice('يجب كتابة اسمك قبل إنشاء غرفة.');
    return;
  }
  socket.emit('room:create', name, (result) => result.ok ? showGame(result.state, result.mark) : showNotice(result.error));
});

$('joinBtn').addEventListener('click', () => {
  const name = $('joinName').value.trim();
  const code = $('roomCode').value.trim();

  if (!name) {
    showNotice('يجب كتابة اسمك قبل الدخول إلى الغرفة.');
    return;
  }
  if (!code) {
    showNotice('اكتب رمز الغرفة أولاً.');
    return;
  }

  socket.emit('room:join', { code, name }, (result) => result.ok ? showGame(result.state, result.mark) : showNotice(result.error));
});

$('resetBtn').addEventListener('click', () => socket.emit('game:reset'));
$('leaveBtn').addEventListener('click', () => { window.location.reload(); });
$('copyBtn').addEventListener('click', async () => { await navigator.clipboard.writeText(currentState.code); showNotice('تم نسخ رمز الغرفة'); setTimeout(() => showNotice(''), 1800); });
$('roomCode').addEventListener('input', (event) => { event.target.value = event.target.value.toUpperCase(); });
socket.on('room:update', (state) => { currentState = state; renderPlayers(state.players); renderGame(state.game); });
socket.on('game:update', (game) => { currentState.game = game; renderGame(game); });
socket.on('notice', showNotice);
socket.on('connect', () => $('connectionText').textContent = 'متصل بالخادم');
socket.on('disconnect', () => $('connectionText').textContent = 'الاتصال منقطع');