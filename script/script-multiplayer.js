const socket = io();
let currentRoom = null;
let myTurn = true;
let playerSymbol = 'X';
let gameOver = false;
let gameboard = ["", "", "", "", "", "", "", "", ""];

const tiles = document.querySelectorAll(".col");

// ROOM CREATION
document.getElementById('createRoomBtn').addEventListener('click', () => {
  socket.emit('createRoom');
});

// JOIN ROOM
document.getElementById('joinRoomBtn').addEventListener('click', () => {
  const code = document.getElementById('joinRoomInput').value.trim().toUpperCase();
  if (code) {
    socket.emit('joinRoom', code);
  }
});

// COPY ROOM CODE TO CLIPBOARD
function copyCode() {
  const text = document.getElementById('roomCodeText').textContent;
  navigator.clipboard.writeText(text);
}

// === SOCKET EVENTS ===

// When a new room is created
socket.on('roomCreated', (code) => {
  currentRoom = code;
  playerSymbol = 'X';
  myTurn = true;
  document.getElementById('roomDisplay').style.display = 'block';
  document.getElementById('roomCodeText').textContent = code;
  document.getElementById('roomStatus').textContent = "Waiting for opponent...";
});

// When a user joins an existing room
socket.on('roomJoined', (code) => {
  currentRoom = code;
  playerSymbol = 'O';
  myTurn = false;
  document.getElementById('roomDisplay').style.display = 'block';
  document.getElementById('roomCodeText').textContent = code;
  document.getElementById('roomStatus').textContent = "Room joined. Waiting for opponent move.";
});

// Start the game
socket.on('startGame', () => {
  gameOver = false;
  gameboard = ["", "", "", "", "", "", "", "", ""];
  tiles.forEach(tile => tile.textContent = "");
  document.getElementById('roomStatus').textContent = "Game started!";
  updateTurnText(myTurn ? playerSymbol : getOpponentSymbol());
});

// Opponent makes a move
socket.on('opponentMove', ({ index, player }) => {
  const cell = document.querySelector(`.col[data-index="${index}"]`);
  if (!cell.textContent) {
    cell.textContent = player;
    colorTile(cell, player);
    updateGameboard(cell, player);
    myTurn = true;
    updateTurnText(playerSymbol);
  }
});

// Opponent leaves the room
socket.on('playerLeft', () => {
  document.getElementById('roomStatus').textContent = "Opponent left.";
  gameOver = true;
});

// === GAME INTERACTION ===

tiles.forEach(tile => {
  tile.addEventListener("click", () => {
    if (gameOver || !myTurn || tile.textContent !== "") return;

    const index = tile.getAttribute("data-index");
    tile.textContent = playerSymbol;
    colorTile(tile, playerSymbol);
    updateGameboard(tile, playerSymbol);
    myTurn = false;

    socket.emit('makeMove', {
      roomCode: currentRoom,
      index,
      player: playerSymbol
    });

    if (!gameOver) updateTurnText(getOpponentSymbol());
  });
});

function colorTile(tile, symbol) {
  tile.style.color = symbol === 'X' ? "#FF6F61" : "#6B5B95";
}

function getOpponentSymbol() {
  return playerSymbol === 'X' ? 'O' : 'X';
}

function updateTurnText(currentSymbol) {
  const turnText = document.querySelector(".turn-text");
  if (gameOver) return;
  if (currentSymbol === 'X') {
    turnText.textContent = "Player-1's turn!";
    turnText.style.color = "#FF6F61";
  } else {
    turnText.textContent = "Player-2's turn!";
    turnText.style.color = "#6B5B95";
  }
}

function updateGameboard(tile, symbol) {
  const index = Number(tile.getAttribute("data-index"));
  gameboard[index] = symbol;
  checkWin(symbol);

  if (!gameOver && gameboard.every(cell => cell !== "")) {
    const turnText = document.querySelector(".turn-text");
    turnText.textContent = "It's a tie!";
    turnText.style.color = "#999";
    gameOver = true;
  }
}

function checkWin(currentPlayer) {
  const turnText = document.querySelector(".turn-text");
  const scoreText = document.querySelector(".score");
  const player1avatar = document.querySelector(".player-1-avatar");
  const player2avatar = document.querySelector(".player-2-avatar");

  const winPatterns = [
    [0,1,2],[3,4,5],[6,7,8],
    [0,3,6],[1,4,7],[2,5,8],
    [0,4,8],[2,4,6]
  ];

  for (let pattern of winPatterns) {
    const [a, b, c] = pattern;
    if (gameboard[a] && gameboard[a] === gameboard[b] && gameboard[b] === gameboard[c]) {
      gameOver = true;

      if (currentPlayer === 'X') {
        turnText.textContent = "Player-1 wins!";
        turnText.style.color = "#FF6F61";
        scoreText.textContent = "1 vs 0";
        player1avatar.src = "../assets/player1win.png";
      } else {
        turnText.textContent = "Player-2 wins!";
        turnText.style.color = "#6B5B95";
        scoreText.textContent = "0 vs 1";
        player2avatar.src = "../assets/player2win.png";
      }

      break;
    }
  }
}

