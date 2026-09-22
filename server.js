const path = require('path');
const http = require('http');
const express = require('express');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server);
const rooms = new Map();
const PORT = process.env.PORT || 3000;

app.use(express.static(path.join(__dirname, 'public')));

function newGame() {
  return {
    board: Array(9).fill(''),
    turn: 'X',
    winner: null,
    winningLine: [],
    status: 'playing'
  };
}

function makeRoomCode() {
  let code;
  do {
    code = Math.random().toString(36).slice(2, 7).toUpperCase();
  } while (rooms.has(code));
  return code;
}

function getResult(board) {
  const lines = [
    [0, 1, 2], [3, 4, 5], [6, 7, 8],
    [0, 3, 6], [1, 4, 7], [2, 5, 8],
    [0, 4, 8], [2, 4, 6]
  ];

  for (const line of lines) {
    const [a, b, c] = line;
    if (board[a] && board[a] === board[b] && board[a] === board[c]) {
      return { winner: board[a], winningLine: line, status: 'won' };
    }
  }

  if (board.every(Boolean)) return { winner: 'draw', winningLine: [], status: 'draw' };
  return { winner: null, winningLine: [], status: 'playing' };
}

function roomState(room) {
  return {
    code: room.code,
    players: room.players,
    game: room.game
  };
}

function leaveRoom(socket) {
  const code = socket.data.roomCode;
  if (!code || !rooms.has(code)) return;

  const room = rooms.get(code);
  room.players = room.players.filter((player) => player.id !== socket.id);
  socket.leave(code);
  socket.data.roomCode = null;
  socket.data.mark = null;

  if (room.players.length === 0) {
    rooms.delete(code);
  } else {
    room.game = newGame();
    io.to(code).emit('room:update', roomState(room));
    io.to(code).emit('notice', 'غادر اللاعب الآخر. يمكنك مشاركة الرمز لدعوته مجددًا.');
  }
}

io.on('connection', (socket) => {
  socket.on('room:create', (name, callback) => {
    const cleanName = String(name || '').trim();
    if (!cleanName) {
      return callback({ ok: false, error: 'يجب كتابة اسمك قبل إنشاء الغرفة.' });
    }

    leaveRoom(socket);
    const code = makeRoomCode();
    const room = { code, players: [{ id: socket.id, name: cleanName.slice(0, 20), mark: 'X' }], game: newGame() };
    rooms.set(code, room);
    socket.join(code);
    socket.data.roomCode = code;
    socket.data.mark = 'X';
    callback({ ok: true, state: roomState(room), mark: 'X' });
  });

  socket.on('room:join', ({ code, name }, callback) => {
    const cleanName = String(name || '').trim();
    const normalizedCode = String(code || '').trim().toUpperCase();

    if (!cleanName) {
      return callback({ ok: false, error: 'يجب كتابة اسمك قبل دخول الغرفة.' });
    }
    if (!normalizedCode) {
      return callback({ ok: false, error: 'اكتب رمز الغرفة أولاً.' });
    }

    const room = rooms.get(normalizedCode);
    if (!room) return callback({ ok: false, error: 'الغرفة غير موجودة. تحقق من الرمز.' });
    if (room.players.length >= 2) return callback({ ok: false, error: 'هذه الغرفة مكتملة.' });

    leaveRoom(socket);
    room.players.push({ id: socket.id, name: cleanName.slice(0, 20), mark: 'O' });
    socket.join(normalizedCode);
    socket.data.roomCode = normalizedCode;
    socket.data.mark = 'O';
    io.to(normalizedCode).emit('room:update', roomState(room));
    callback({ ok: true, state: roomState(room), mark: 'O' });
  });

  socket.on('game:move', (index) => {
    const room = rooms.get(socket.data.roomCode);
    if (!room || room.players.length < 2 || room.game.status !== 'playing') return;
    if (socket.data.mark !== room.game.turn || room.game.board[index]) return;
    if (!Number.isInteger(index) || index < 0 || index > 8) return;

    room.game.board[index] = socket.data.mark;
    const result = getResult(room.game.board);
    room.game = { ...room.game, ...result, turn: result.status === 'playing' ? (socket.data.mark === 'X' ? 'O' : 'X') : room.game.turn };
    io.to(room.code).emit('game:update', room.game);
  });

  socket.on('game:reset', () => {
    const room = rooms.get(socket.data.roomCode);
    if (!room || room.players.length < 2) return;
    room.game = newGame();
    io.to(room.code).emit('game:update', room.game);
  });

  socket.on('disconnect', () => leaveRoom(socket));
});

server.listen(PORT, () => console.log(`XO Online running on port ${PORT}`));