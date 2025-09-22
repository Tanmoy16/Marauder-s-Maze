// --- Map locations for each maze ---
// This is your "start point" and "move to" points
const levelPositions = [
    { top: "65%", left: "23%" }, // 1. Start at Gate 1
    { top: "48%", left: "16%" }, // 2. Move to Gate 2
    { top: "80%", left: "55%" }, // 3. Move to Gate 3
    { top: "50%", left: "75%" }, // 4. Move to Gate 4
    { top: "25%", left: "80%" }, // 5. Move to Gate 5
    { top: "30%", left: "50%" }  // 6. Finished! (At Hogwarts castle)
];

// --- DOM Elements ---
const mapContainer = document.getElementById('main-map-container');
const leaderboardList = document.getElementById('leaderboard-list');

// --- Connect to Server as HOST ---
// !! IMPORTANT !!
// Change "YOUR_REAL_IP" to your computer's actual Wi-Fi IP address
const socket = io("http://192.168.56.1:3000"); // <-- e.g., http://192.168.1.10:3000
socket.emit("joinHost");

// --- Listen for updates from the Server ---
socket.on("gameStateUpdate", (gameState) => {
    console.log("Received new game state:", gameState);
    
    // Clear old data
    mapContainer.innerHTML = '';
    leaderboardList.innerHTML = '';

    // --- 1. Render Players on Map (NOW USES LEVEL) ---
    for (const id in gameState.players) {
        const player = gameState.players[id];
        
        // Get the player's level (1-6) and find the correct position
        const location = levelPositions[player.level - 1] || levelPositions[0]; // Default to start

        // Create a new element for the player
        const playerEl = document.createElement('div');
        playerEl.className = 'player-icon';
        playerEl.id = player.id;
        playerEl.style.top = location.top;
        playerEl.style.left = location.left;

        playerEl.innerHTML = `
            <div class="player-name">${player.name}</div>
            <div class="player-location">${player.currentMaze || 'Hogwarts Map'}</div>
        `;
        mapContainer.appendChild(playerEl);
    }

    // --- 2. Render Leaderboard (NOW SHOWS EGGS) ---
    for (const entry of gameState.leaderboard) {
        const li = document.createElement('li');
        li.textContent = `${entry.name} - ${entry.eggs} Golden Eggs`;
        leaderboardList.appendChild(li);
    }
});