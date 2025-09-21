// --- Map locations for each maze name ---
// !! YOU MUST UPDATE these top/left % values
// to match the locations on *your* map image !!
const mazeLocations = {
    "Hogsmeade Railway Station": { top: "80%", left: "20%" }, // Level 1 guess
    "The Whomping Willows":      { top: "50%", left: "18%" }, // Level 2 guess
    "The Quidditch Ground":       { top: "25%", left: "80%" }, // Level 5 guess
    "The Forbidden Forest":       { top: "50%", left: "75%" }, // Level 4 guess
    "The Hogwarts Gate":          { top: "80%", left: "55%" }, // Level 3 guess
    "Hogwarts Map":               { top: "10%", left: "10%" }  // Default
};

// --- DOM Elements ---
const mapContainer = document.getElementById('main-map-container');
const leaderboardList = document.getElementById('leaderboard-list');

// --- Connect to Server as HOST ---
const socket = io("http://localhost:3000"); // Use your server's address
socket.emit("joinHost");

// --- Listen for updates from the Server ---
socket.on("gameStateUpdate", (gameState) => {
    console.log("Received new game state:", gameState);
    
    // Clear old data
    mapContainer.innerHTML = '';
    leaderboardList.innerHTML = '';

    // --- 1. Render Players on Map ---
    for (const id in gameState.players) {
        const player = gameState.players[id];
        const location = mazeLocations[player.currentMaze] || mazeLocations["Hogwarts Map"];

        // Create a new element for the player
        const playerEl = document.createElement('div');
        playerEl.className = 'player-icon';
        playerEl.id = player.id; // Set id for easy tracking
        playerEl.style.top = location.top;
        playerEl.style.left = location.left;

        playerEl.innerHTML = `
            <div class="player-name">${player.name}</div>
            <div class="player-location">${player.currentMaze}</div>
        `;
        mapContainer.appendChild(playerEl);
    }

    // --- 2. Render Leaderboard ---
    for (const entry of gameState.leaderboard) {
        const li = document.createElement('li');
        li.textContent = `${entry.name} - ${entry.score} points`;
        leaderboardList.appendChild(li);
    }
});