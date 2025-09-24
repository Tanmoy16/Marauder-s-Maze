// ---> IMPORTANT: REPLACE "localhost" with your computer's Wi-Fi IP address <---
const socket = io("http://localhost:3000"); 

socket.on('connect', () => {
    console.log('Connected to server as host!');
    socket.emit('joinHost');
});

// --- Function to format seconds into MM:SS ---
function formatTime(seconds) {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${String(minutes).padStart(2, '0')}:${String(remainingSeconds).padStart(2, '0')}`;
}

socket.on('gameStateUpdate', (gameState) => {
    console.log("Received Game State:", gameState);

    // --- 1. Update Player List ---
    const playerList = document.getElementById('player-list');
    playerList.innerHTML = ''; // Clear old list
    Object.values(gameState.players).forEach(player => {
        const li = document.createElement('li');
        li.textContent = `${player.name} (Team: ${player.team}) - Location: ${player.currentMaze}`;
        playerList.appendChild(li);
    });

    // --- 2. Update Leaderboard with TIME ---
    const leaderboardBody = document.querySelector('#leaderboard tbody');
    leaderboardBody.innerHTML = ''; // Clear old data
    gameState.leaderboard.forEach((team, index) => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${index + 1}</td>
            <td>${team.team}</td>
            <td>${formatTime(team.timeLeft)}</td>
        `;
        leaderboardBody.appendChild(row);
    });
});

// --- 3. Handle Game Over ---
socket.on('gameover', (leaderboard) => {
    const winner = leaderboard[0];
    if (winner) {
        alert(`Game Over! The winning team is ${winner.team} with ${formatTime(winner.timeLeft)} remaining!`);
    } else {
        alert('Game Over!');
    }
});

// --- 4. Add event listener for the Start Game button ---
document.getElementById('startGameBtn').addEventListener('click', () => {
    socket.emit('startGame');
    console.log("'startGame' event emitted to server.");
    document.getElementById('startGameBtn').disabled = true; // Disable button after starting
});