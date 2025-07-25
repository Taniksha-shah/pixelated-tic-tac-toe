//computer's color -> #6B5B95
//player's color -> #FF6F61

/*
1.function to handle turns
2.function to check for win
3.functions for onclick events
*/

let currentPlayer = 'X';
let gameOver = false;
let gameboard =["","","","","","","","",""]

const tiles = document.querySelectorAll(".col");

tiles.forEach ( col => {
    col.addEventListener("click", () => handleTileClick(col));
});

function handleTileClick(col) {
    if (gameOver || col.textContent !== "") return;

    col.textContent = currentPlayer;

    if(currentPlayer === 'X') {
        col.style.color = "#FF6F61";
    }
    else {
        col.style.color = "#6B5B95";
    }
    updateGameboard(col, currentPlayer);
    
    if(!gameOver) {
        currentPlayer = currentPlayer === 'X' ? 'O' : 'X';
        updateTurntext(currentPlayer);
    }

    if (!gameOver && currentPlayer === 'O') {
        setTimeout(() => {
            makeComputermove();
        }, 500); // adds 500ms delay for realism
    }
}

function makeComputermove() {
    let tiles = document.querySelectorAll(".col");

    for (let i = 0; i < tiles.length; i++) {
        if (tiles[i].textContent === "") {
            tiles[i].textContent = 'O';
            tiles[i].style.color = "#6B5B95";
            gameboard[i] = 'O';  // update game state

            checkWin('O', gameboard); // pass computer as currentPlayer
            break;
        }
    }
    

    if (!gameOver) {
        currentPlayer = 'X';
        updateTurntext(currentPlayer);
    }
}


function updateTurntext(currentPlayer) {
    let turn = document.querySelector(".turn-text");
    if(currentPlayer === 'X') {
        turn.textContent = "Your turn!";
        turn.style.color = "#FF6F61";
    }
    else {
        turn.textContent = "Computer's turn!";
        turn.style.color = "#6B5B95";
    }
}

function updateGameboard(col, currentPlayer) {
    let index = Number(col.getAttribute("data-index"));
    gameboard[index] = currentPlayer;

    checkWin(currentPlayer, gameboard);

    if (!gameOver && gameboard.every(cell => cell !== "")) {
        let winText = document.querySelector(".turn-text");
        winText.textContent = "It's a tie!";
        winText.style.color = "#999";
        gameOver = true;
    }
}

function checkWin(currentPlayer, gameboard) {
    let winText = document.querySelector(".turn-text");
    let scoreText = document.querySelector(".score");
    let player1avatar = document.querySelector(".player-1-avatar");
    let player2avatar = document.querySelector(".player-2-avatar");
    
    const winConditions = [
        [0, 1, 2],
        [3, 4, 5],
        [6, 7, 8],
        [0, 3, 6],
        [1, 4, 7],
        [2, 5, 8],
        [0, 4, 8],
        [2, 4, 6]
    ];
    for (let condition of winConditions) {
        const [a, b, c] = condition;

        if (
            gameboard[a] &&
            gameboard[a] === gameboard[b] &&
            gameboard[b] === gameboard[c]
        ) {
            if(currentPlayer === 'X') {
                winText.textContent = "Player-1 wins!";
                winText.style.color = "#FF6F61";
                scoreText.textContent = "1 vs 0";
                player1avatar.src = "assets/player1win.png";
            }
            else {
                winText.textContent = "Player-2 wins!";
                winText.style.color = "#6B5B95";
                scoreText.textContent = "0 vs 1";
                player2avatar.src = "assets/player2win.png";
            }
            gameOver = true;
        }
    }
}

