const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');
const shortid = require('shortid'); // Make sure you have 'shortid' installed: npm install shortid

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

const PORT = process.env.PORT || 3000;

// Serve static files from the 'public' directory
app.use(express.static(path.join(__dirname, 'public')));

// Store active game rooms
const gameRooms = {};
// Store disconnect timeouts for hosts
const hostDisconnectTimeouts = {}; // New: To manage delayed room deletion

// Game logic constants (adjust as needed)
const MAX_PLAYERS_PER_ROOM = 2;
const DISCONNECT_GRACE_PERIOD_MS = 5000; // 5 seconds for host to reconnect after redirect

io.on('connection', (socket) => {
    console.log(`User connected: ${socket.id}`);

    // --- Create Room ---
    socket.on('createRoom', () => {
        const roomId = shortid.generate();
        gameRooms[roomId] = {
            id: roomId,
            players: [], // Stores { socketId: '...', symbol: 'X'/'O', name: 'Player X/O' }
            playerSockets: new Map(), // Stores actual socket objects for easy lookup
            board: Array(9).fill(''),
            turn: 'X',
            roundsTotal: 3, // Default rounds
            currentRound: 1,
            scores: { X: 0, O: 0 },
            playerSymbols: {}, // Maps socketId to 'X' or 'O'
            playerNames: {}, // Maps socketId to player names/defaults
            hostId: socket.id, // Store the host's socket ID
            gameStarted: false,
            readyPlayersForNextRound: new Set(), // Track players ready for next round
            // New: Store original host's first socket ID
            // This is crucial to identify if a new connection is the "same" host after redirect
            originalHostSocketId: socket.id,
        };
        console.log(`Room created: ${roomId} by ${socket.id}. Host is X.`);

        // Add host to the room
        socket.join(roomId);
        gameRooms[roomId].players.push({ socketId: socket.id, symbol: 'X', name: 'Player X' });
        gameRooms[roomId].playerSockets.set(socket.id, socket);
        gameRooms[roomId].playerSymbols[socket.id] = 'X';
        gameRooms[roomId].playerNames[socket.id] = 'Player X';

        socket.emit('roomCreated', roomId);
        socket.emit('playerSymbol', 'X'); // Tell the host they are 'X'
    });

    // --- Join Room ---
    socket.on('join-room', (roomId) => {
        const room = gameRooms[roomId];

        if (!room) {
            socket.emit('roomNotFound');
            console.log(`Room ${roomId} not found for ${socket.id}`);
            return;
        }

        if (room.players.length >= MAX_PLAYERS_PER_ROOM) {
            socket.emit('roomFull');
            console.log(`Room ${roomId} is full for ${socket.id}`);
            return;
        }

        // IMPORTANT: If this is the host reconnecting after a redirect, cancel the deletion timeout
        if (room.hostId === socket.id || room.originalHostSocketId === socket.id) { // Check both current and original ID
            if (hostDisconnectTimeouts[roomId]) {
                clearTimeout(hostDisconnectTimeouts[roomId]);
                delete hostDisconnectTimeouts[roomId];
                console.log(`Host ${socket.id} reconnected to room ${roomId}. Room deletion cancelled.`);
            }
            // Update hostId to new socket ID if it's the original host reconnecting
            // This ensures subsequent operations use the latest host socket
            room.hostId = socket.id;
        }


        let playerSymbol = 'O'; // Default for joining player
        if (room.players.length === 1 && room.players[0].symbol === 'O') {
            playerSymbol = 'X'; // Should not happen with current logic (host is always X), but good to be safe
        }

        socket.join(roomId);
        room.players.push({ socketId: socket.id, symbol: playerSymbol, name: `Player ${playerSymbol}` });
        room.playerSockets.set(socket.id, socket);
        room.playerSymbols[socket.id] = playerSymbol;
        room.playerNames[socket.id] = `Player ${playerSymbol}`;


        console.log(`${socket.id} joined room ${roomId}. Current players: ${room.players.length}`);

        socket.emit('roomJoined', {
            roomId: roomId,
            isHost: room.hostId === socket.id,
            players: room.players.map(p => ({ id: p.socketId, symbol: p.symbol }))
        });
        socket.emit('playerSymbol', playerSymbol); // Tell the joining player their symbol

        // Notify all players in the room about the new player
        if (room.players.length === MAX_PLAYERS_PER_ROOM) {
            io.to(roomId).emit('player-joined', {
                playerCount: room.players.length,
                playerSymbols: room.playerSymbols,
                playerNames: room.playerNames
            });
            console.log(`Room ${roomId} is full. Game can start.`);
            // Host will see the 'rounds-select' and start the game
        }
    });

    // --- Start Game ---
    socket.on('start-game', (data) => {
        const roomId = data.roomId;
        const rounds = parseInt(data.rounds);
        const room = gameRooms[roomId];

        if (room && socket.id === room.hostId && room.players.length === MAX_PLAYERS_PER_ROOM && !room.gameStarted) {
            room.roundsTotal = rounds;
            room.currentRound = 1;
            room.scores = { X: 0, O: 0 };
            room.board = Array(9).fill('');
            room.turn = 'X';
            room.gameStarted = true;
            room.readyPlayersForNextRound = new Set(); // Reset for new game

            io.to(roomId).emit('game-started', {
                board: room.board,
                turn: room.turn,
                roundsTotal: room.roundsTotal,
                currentRound: room.currentRound,
                scores: room.scores,
                playerSymbols: room.playerSymbols, // Send these so clients know who is X/O
                playerNames: room.playerNames
            });
            console.log(`Game started in room ${roomId} for ${room.roundsTotal} rounds.`);
        } else {
            // Error handling if not host, not enough players, or game already started
            socket.emit('error', 'Could not start game. Not host, not enough players, or game already started.');
        }
    });

    // --- Make Move ---
    socket.on('makeMove', (data) => {
        const { roomId, index } = data;
        const room = gameRooms[roomId];

        if (!room || !room.gameStarted) {
            socket.emit('error', 'Game not active or room not found.');
            return;
        }

        const playerSymbol = room.playerSymbols[socket.id];
        if (!playerSymbol || playerSymbol !== room.turn) {
            socket.emit('error', 'It is not your turn or you are not a player in this game.');
            return;
        }

        if (room.board[index] === '') {
            room.board[index] = room.turn;
            checkGameEnd(room, roomId);
        } else {
            socket.emit('error', 'Cell already taken!');
        }
    });

    // --- Player Ready for Next Round ---
    socket.on('playerReadyForNextRound', (roomId) => {
        const room = gameRooms[roomId];
        if (room) {
            room.readyPlayersForNextRound.add(socket.id);
            console.log(`Player ${socket.id} ready for next round in room ${roomId}. Ready players: ${room.readyPlayersForNextRound.size}`);

            if (room.readyPlayersForNextRound.size === MAX_PLAYERS_PER_ROOM) {
                if (room.currentRound < room.roundsTotal) {
                    room.currentRound++;
                    room.board = Array(9).fill('');
                    room.turn = 'X'; // Always start next round with X
                    room.readyPlayersForNextRound.clear(); // Reset for next round
                    io.to(roomId).emit('nextRound', {
                        board: room.board,
                        turn: room.turn,
                        roundsTotal: room.roundsTotal,
                        currentRound: room.currentRound,
                        scores: room.scores,
                        playerSymbols: room.playerSymbols,
                        playerNames: room.playerNames
                    });
                    console.log(`Starting round ${room.currentRound} in room ${roomId}.`);
                } else {
                    // Game Over
                    let finalWinner = 'draw';
                    if (room.scores.X > room.scores.O) finalWinner = 'X';
                    else if (room.scores.O > room.scores.X) finalWinner = 'O';

                    io.to(roomId).emit('gameOver', {
                        finalScores: room.scores,
                        finalWinner: finalWinner,
                        playerSymbols: room.playerSymbols,
                        playerNames: room.playerNames
                    });
                    console.log(`Game over in room ${roomId}. Winner: ${finalWinner}`);
                    // Optionally, delete the room after game over or mark it inactive
                    // setTimeout(() => deleteRoom(roomId), 60000); // Delete after 1 minute if no further interaction
                }
            }
        }
    });


    // --- Disconnect ---
    socket.on('disconnect', () => {
        console.log(`User disconnected: ${socket.id}`);

        let roomIdToCleanup = null;
        let isDisconnectedHost = false;

        // Find which room the disconnected user was in
        for (const roomId in gameRooms) {
            const room = gameRooms[roomId];
            const playerIndex = room.players.findIndex(p => p.socketId === socket.id);

            if (playerIndex !== -1) {
                room.players.splice(playerIndex, 1); // Remove player from array
                room.playerSockets.delete(socket.id); // Remove socket from map
                delete room.playerSymbols[socket.id]; // Remove from symbols map
                delete room.playerNames[socket.id]; // Remove from names map

                console.log(`${socket.id} left room ${roomId}. Players remaining in room's array: ${room.players.length}`);

                roomIdToCleanup = roomId; // Mark this room for potential cleanup

                // Check if the disconnected user was the host, using originalHostSocketId
                if (socket.id === room.originalHostSocketId || socket.id === room.hostId) {
                    isDisconnectedHost = true;
                }
                break; // Found the room, exit loop
            }
        }

        if (roomIdToCleanup) {
            const room = gameRooms[roomIdToCleanup];

            if (isDisconnectedHost) {
                // If the disconnected user was the host, set a timeout to delete the room
                // This allows a grace period for the host to reconnect (e.g., after a page refresh/redirect)
                hostDisconnectTimeouts[roomIdToCleanup] = setTimeout(() => {
                    if (room && room.players.length === 0) { // Only delete if no players reconnected
                        delete gameRooms[roomIdToCleanup];
                        console.log(`Room ${roomIdToCleanup} is now empty after host grace period. Deleting.`);
                    } else if (room) {
                        // If players reconnected (e.g., host came back), clear the timeout
                        console.log(`Room ${roomIdToCleanup} still has players. Not deleting after host grace period.`);
                    }
                    delete hostDisconnectTimeouts[roomIdToCleanup]; // Clear the timeout entry
                }, DISCONNECT_GRACE_PERIOD_MS); // Wait 5 seconds
                console.log(`Host ${socket.id} disconnected from room ${roomIdToCleanup}. Starting ${DISCONNECT_GRACE_PERIOD_MS / 1000}s grace period.`);

                // Notify remaining players (if any) that host disconnected
                if (room.players.length > 0) {
                    // Promote the first remaining player to host if necessary (optional advanced logic)
                    // Or simply notify them and prompt to create new room
                    io.to(roomIdToCleanup).emit('opponentDisconnected', `Host (${socket.id}) disconnected. Waiting for them to reconnect or start a new game.`);
                }

            } else {
                // If it's a non-host player, immediately notify the remaining players
                if (room.players.length > 0) {
                    io.to(roomIdToCleanup).emit('opponentDisconnected', `Opponent (${socket.id}) disconnected.`);
                }
                // If the room becomes empty because a non-host left, delete it immediately
                if (room.players.length === 0) {
                    delete gameRooms[roomIdToCleanup];
                    console.log(`Room ${roomIdToCleanup} is now empty. Deleting.`);
                    // Also clear any pending host disconnect timeout if it existed for this room
                    if (hostDisconnectTimeouts[roomIdToCleanup]) {
                        clearTimeout(hostDisconnectTimeouts[roomIdToCleanup]);
                        delete hostDisconnectTimeouts[roomIdToCleanup];
                    }
                }
            }
        }
    });
});


// --- Game Logic Helper Functions ---
function checkGameEnd(room, roomId) {
    const winningCombos = [
        [0, 1, 2], [3, 4, 5], [6, 7, 8], // Rows
        [0, 3, 6], [1, 4, 7], [2, 5, 8], // Cols
        [0, 4, 8], [2, 4, 6]             // Diags
    ];

    let winner = null;
    for (const combo of winningCombos) {
        const [a, b, c] = combo;
        if (room.board[a] && room.board[a] === room.board[b] && room.board[a] === room.board[c]) {
            winner = room.board[a];
            break;
        }
    }

    if (winner) {
        room.scores[winner]++; // Increment winner's score
        io.to(roomId).emit('roundOver', {
            winner: winner,
            board: room.board,
            scores: room.scores
        });
        console.log(`Round over in room ${roomId}. Winner: ${winner}`);
    } else if (room.board.every(cell => cell !== '')) {
        // It's a draw if all cells are filled and no winner
        io.to(roomId).emit('roundOver', {
            winner: 'draw',
            board: room.board,
            scores: room.scores
        });
        console.log(`Round over in room ${roomId}. It's a draw.`);
    } else {
        // Continue game, switch turn
        room.turn = room.turn === 'X' ? 'O' : 'X';
        io.to(roomId).emit('boardUpdate', {
            board: room.board,
            turn: room.turn
        });
    }
}


server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    console.log(`Open http://localhost:${PORT} in your browser`);
});