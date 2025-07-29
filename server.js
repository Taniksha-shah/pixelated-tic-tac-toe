import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import { randomUUID } from 'crypto';

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*',
  },
});

const PORT = process.env.PORT || 3000;

app.use(express.static('public'));

const rooms = {}; // { roomCode: { players: [socketId], host: socketId, rounds: null } }

function generateRoomCode() {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
}

io.on('connection', (socket) => {
  console.log('User connected:', socket.id);

  socket.on('createRoom', () => {
    let roomCode = generateRoomCode();
    while (rooms[roomCode]) {
      roomCode = generateRoomCode();
    }

    rooms[roomCode] = {
      players: [socket.id],
      host: socket.id,
      rounds: null,
    };

    socket.join(roomCode);
    socket.emit('roomCreated', roomCode);
    console.log(`Room ${roomCode} created by ${socket.id}`);
  });

  socket.on('joinRoom', (roomCode) => {
    const room = rooms[roomCode];
    if (room && room.players.length < 2) {
      room.players.push(socket.id);
      socket.join(roomCode);
      socket.emit('roomJoined', roomCode);

      // Notify both players
      io.to(roomCode).emit('playerJoined');
    } else {
      socket.emit('errorRoom', 'Room full or does not exist');
    }
  });

  socket.on('startGame', ({ roomCode, rounds }) => {
    const room = rooms[roomCode];
    if (room && socket.id === room.host && room.rounds === null) {
      room.rounds = rounds;
      io.to(roomCode).emit('gameStarted', { rounds });
      console.log(`Game in room ${roomCode} started with ${rounds} rounds`);
    }
  });

  socket.on('makeMove', ({ roomCode, index, player }) => {
    socket.to(roomCode).emit('opponentMove', { index, player });
  });

  socket.on('disconnect', () => {
    for (const roomCode in rooms) {
      const room = rooms[roomCode];
      room.players = room.players.filter(id => id !== socket.id);
      if (room.players.length === 0) {
        delete rooms[roomCode];
        console.log(`Room ${roomCode} deleted`);
      } else {
        io.to(roomCode).emit('playerLeft');
      }
    }
    console.log('User disconnected:', socket.id);
  });
});

server.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
