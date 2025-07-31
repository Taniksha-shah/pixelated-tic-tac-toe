// script-multiplayer.js

const socket = io();

// Get elements (updated to remove roomLinkElement and use hiddenGameLinkInput)
const playerStatus = document.getElementById('player-status');
const copyLinkBtn = document.getElementById('copy-link-btn');
const hiddenGameLinkInput = document.getElementById('hidden-game-link'); // New element to hold the link for copying
const roundsSelect = document.getElementById('rounds-select');
const roundsForm = document.getElementById('rounds-form');
const roundsSelectDropdown = document.getElementById('rounds-select-dropdown');
const gameBoard = document.getElementById('game-board');
const cells = document.querySelectorAll('.col');
const scoreDisplay = document.getElementById('score');
const playAgainBtn = document.getElementById('play-again-btn');

let currentRoomId = null;
let isHost = false;
let myPlayerSymbol = null; // 'X' or 'O'

// --- Initial Setup on Page Load ---
const urlParams = new URLSearchParams(window.location.search);
currentRoomId = urlParams.get("room");

if (currentRoomId) {
    // Construct the shareable link and store in hidden input
    const shareableLink = window.location.origin + `/game-multiplayer.html?room=${currentRoomId}`;
    hiddenGameLinkInput.value = shareableLink; // Populate the hidden input

    playerStatus.textContent = `Joining room ${currentRoomId}...`;
    console.log("game-multiplayer.html: Attempting to join room:", currentRoomId);
} else {
    playerStatus.textContent = "Error: Room ID missing. Redirecting to home...";
    console.error("game-multiplayer.html: No room ID in URL. Redirecting.");
    setTimeout(() => window.location.href = 'index.html', 3000);
}


// --- Socket.IO Connection ---
socket.on('connect', () => {
    console.log('game-multiplayer.html: Connected to Socket.io server with ID:', socket.id);
    if (currentRoomId) {
        socket.emit("join-room", currentRoomId);
    }
});

// --- Copy Link Button ---
copyLinkBtn.addEventListener('click', () => {
    const linkToCopy = hiddenGameLinkInput.value; // Get link from the hidden input
    if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(linkToCopy)
            .then(() => {
                alert('Game link copied to clipboard!');
                console.log('Link copied:', linkToCopy);
            })
            .catch(err => {
                console.error('Failed to copy link:', err);
                alert('Failed to copy link. Please copy it manually: ' + linkToCopy);
            });
    } else {
        // Fallback for older browsers
        hiddenGameLinkInput.type = 'text'; // Temporarily make it visible
        hiddenGameLinkInput.select();
        try {
            document.execCommand('copy');
            alert('Game link copied to clipboard!');
        } catch (err) {
            console.error('Failed to copy link (fallback):', err);
            alert('Failed to copy link. Please copy it manually from the URL bar.');
        }
        hiddenGameLinkInput.type = 'hidden'; // Hide it again
    }
});


// --- Socket.IO Event Handlers ---

socket.on('roomJoined', (data) => {
    console.log('Room Joined:', data);
    isHost = data.isHost;
    playerStatus.textContent = `Joined Room: ${data.roomId}. Waiting for opponent...`;

    // The hidden input value is already set on initial load via URL params.
    // If you wanted to update it here in case roomId changed (unlikely for join), you could:
    // hiddenGameLinkInput.value = window.location.origin + `/game-multiplayer.html?room=${data.roomId}`;

    // Show rounds select only if host
    if (isHost) {
        roundsSelect.style.display = 'block';
        playerStatus.textContent += " You are the host. Select rounds and click 'Start Game'.";
    }
});

socket.on('playerSymbol', (symbol) => {
    myPlayerSymbol = symbol;
    console.log('Your symbol is:', myPlayerSymbol);
    // No need to update player name spans as they were removed from HTML.
});

socket.on('player-joined', (data) => {
    console.log('Opponent joined:', data);
    playerStatus.textContent = `Opponent joined! Ready to play.`;
    // Player name spans removed, so no update needed here.
    if (isHost) {
        // Host should now see the "Start Game" button is active
    } else {
        roundsSelect.style.display = 'none'; // Ensure guest doesn't see start game button
    }
});


socket.on('game-started', (data) => {
    console.log('Game Started:', data);
    roundsSelect.style.display = 'none'; // Hide rounds select form
    gameBoard.style.display = 'grid'; // Show the game board
    updateBoard(data.board);
    updateTurnStatus(data.turn);
    updateScores(data.scores);
    playerStatus.textContent = `Round ${data.currentRound}/${data.roundsTotal}. It's ${data.turn}'s turn.`;

    // No player name spans to update here.
});

socket.on('boardUpdate', (data) => {
    updateBoard(data.board);
    updateTurnStatus(data.turn);
});

socket.on('roundOver', (data) => {
    updateBoard(data.board); // Show final move
    updateScores(data.scores);
    if (data.winner === 'draw') {
        playerStatus.textContent = `Round Draw! Scores: X:${data.scores.X} O:${data.scores.O}`;
    } else {
        playerStatus.textContent = `Round Winner: ${data.winner}! Scores: X:${data.scores.X} O:${data.scores.O}`;
    }
    playAgainBtn.style.display = 'block'; // Or a more appropriate "Ready for next round" button
});

socket.on('nextRound', (data) => {
    console.log('Starting next round:', data);
    updateBoard(data.board);
    updateTurnStatus(data.turn);
    updateScores(data.scores);
    playerStatus.textContent = `Round ${data.currentRound}/${data.roundsTotal}. It's ${data.turn}'s turn.`;
    playAgainBtn.style.display = 'none'; // Hide play again button for new round
});

socket.on('gameOver', (data) => {
    console.log('Game Over:', data);
    let message = '';
    if (data.finalWinner === 'draw') {
        message = `Game Over! It's a Tie! Final Scores: X:${data.finalScores.X} O:${data.finalScores.O}`;
    } else {
        message = `Game Over! ${data.finalWinner} Wins the Game! Final Scores: X:${data.finalScores.X} O:${data.finalScores.O}`;
    }
    playerStatus.textContent = message;
    playAgainBtn.style.display = 'block'; // Show play again button
});

socket.on('roomNotFound', () => {
    playerStatus.textContent = "Error: Room has expired or not found. Redirecting to home...";
    console.error("Room not found or expired.");
    setTimeout(() => window.location.href = 'index.html', 3000);
});

socket.on('roomFull', () => {
    playerStatus.textContent = "Error: Room is full. Redirecting to home...";
    console.error("Room is full.");
    setTimeout(() => window.location.href = 'index.html', 3000);
});

socket.on('error', (message) => {
    console.error("Socket error:", message);
    playerStatus.textContent = `Error: ${message}. Redirecting...`;
    setTimeout(() => window.location.href = 'index.html', 3000);
});

socket.on('opponentDisconnected', (message) => {
    console.log('Opponent disconnected:', message);
    playerStatus.textContent = message + " Waiting for new opponent or click 'Play Again' to reset.";
    gameBoard.style.display = 'none'; // Hide board if game ended
    roundsSelect.style.display = 'block'; // Show rounds select to potentially start new game as host
    playAgainBtn.style.display = 'none'; // Hide if play again logic is different
});


// --- Event Listeners for Game Play ---
roundsForm.addEventListener('submit', (e) => {
    e.preventDefault();
    if (isHost && currentRoomId) {
        const selectedRounds = parseInt(roundsSelectDropdown.value);
        socket.emit('start-game', { roomId: currentRoomId, rounds: selectedRounds });
    } else {
        alert('You are not the host or room is not ready.');
    }
});

cells.forEach(cell => {
    cell.addEventListener('click', () => {
        const index = parseInt(cell.dataset.index);
        if (currentRoomId && myPlayerSymbol) { // Ensure room ID and symbol are set
            socket.emit('makeMove', { roomId: currentRoomId, index: index });
        }
    });
});

playAgainBtn.addEventListener('click', () => {
    if (currentRoomId) {
        socket.emit('playerReadyForNextRound', currentRoomId);
        playAgainBtn.style.display = 'none'; // Hide button after clicking
        playerStatus.textContent = "Waiting for opponent to be ready...";
    }
});


// --- Helper Functions ---

function updateBoard(board) {
    cells.forEach((cell, index) => {
        cell.textContent = board[index];
        cell.classList.remove('x-mark', 'o-mark');
        if (board[index] === 'X') {
            cell.classList.add('x-mark');
        } else if (board[index] === 'O') {
            cell.classList.add('o-mark');
        }
    });
}

function updateTurnStatus(turn) {
    playerStatus.textContent = `It's ${turn}'s turn.`;
}

function updateScores(scores) {
    scoreDisplay.textContent = `${scores.X} vs ${scores.O}`;
}