//computer's color -> #6B5B95
//player's color -> #FF6F61

/*
1.function to handle turns
2.function to keep track of scores
3.function for checks for win
4.function for onclick events
*/

let currentPlayer = 'X';
let gameOver = false;
let gameboard =["","","","","","","","",""]

const tiles = document.querySelectorAll(".col");

tiles.forEach ( col => {
    col.addEventListener("click", () => handleTileClick(col));
});

function handleTileClick(col) {
    if (gameOver || col.textContent !== "") return; // ignore already-filled tiles

    col.textContent = currentPlayer; // place "X" or "O"

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
}

function updateTurntext(currentPlayer) {
    let turn = document.querySelector(".turn-text");
    if(currentPlayer === 'X') {
        turn.textContent = "Player-1's turn!";
        turn.style.color = "#FF6F61";
    }
    else {
        turn.textContent = "Player-2's turn!";
        turn.style.color = "#6B5B95";
    }
}

function updateGameboard(col, currentPlayer) {
    let index = Number(col.getAttribute("data-index"));
    gameboard[index] = currentPlayer;
    console.log(gameboard);
    console.log(index);

    checkWin(currentPlayer, gameboard);
}

function checkWin(currentPlayer, gameboard) {
    let winText = document.querySelector(".turn-text");
    let scoreText = document.querySelector(".score");
    let player1avatar = document.querySelector(".player-1-avatar");
    let player2avatar = document.querySelector(".player-2-avatar");
    
    const winConditions = [
        [0, 1, 2], // Row 1
        [3, 4, 5], // Row 2
        [6, 7, 8], // Row 3
        [0, 3, 6], // Column 1
        [1, 4, 7], // Column 2
        [2, 5, 8], // Column 3
        [0, 4, 8], // Diagonal 1
        [2, 4, 6]  // Diagonal 2
    ];
    for (let condition of winConditions) {
        const [a, b, c] = condition;

        // Check if all 3 cells are equal and not empty
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
                player1avatar.src = "assets/player2win.png";
            }
            gameOver = true;
        }
    }
}