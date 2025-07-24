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

const tiles = document.querySelectorAll(".col");

tiles.forEach ( col => {
    col.addEventListener("click", () => handleTileClick(col));
});

function handleTileClick(col) {
    if (col.textContent !== "") return; // ignore already-filled tiles

    col.textContent = currentPlayer; // place "X" or "O"
    if(currentPlayer === 'X') {
        col.style.color = "#FF6F61";
    }
    else {
        col.style.color = "#6B5B95";
    }
    currentPlayer = currentPlayer === 'X' ? 'O' : 'X';
    updateTurntext(currentPlayer);
}

function updateTurntext(currentPlayer) {
    let turn = document.querySelector(".turn-text");
    if(currentPlayer === 'X') {
        turn.textContent = 'Your turn!';
        turn.style.color = "#FF6F61";
    }
    else {
        turn.textContent = "Computer's turn!";
        turn.style.color = "#6B5B95";
    }
}
