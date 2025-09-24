const express = require('express');
const http = require('http');
const { Server } = require("socket.io");
const cors = require('cors');
const path = require('path');

const app = express();
app.use(cors()); // Allow connections from your game

// --- FIX 1: This serves your HTML, CSS, and JS files ---
// This line fixes your "TIMED_OUT" and "Cannot GET" errors
app.use(express.static(__dirname));
// ----------------------------------------------------

const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: "*", // Allow all origins
        methods: ["GET", "POST"]
    }
});

// This is the MASTER GAME STATE.
let gameState = {
    players: {}, // Stores data for all 6 players
    teams: {}, // Stores data for each team
    leaderboard: [] // Stores team time left
};

// Store the host's unique socket ID
let hostSocketId = null;
let gameTimer = null;

io.on('connection', (socket) => {
    console.log('A user connected:', socket.id);

    // --- 1. Handle PLAYER joining (NOW INCLUDES TEAM) ---
    socket.on('joinGame', (data) => {
        console.log(`Player joined: ${data.name} (Team: ${data.team})`);
        gameState.players[socket.id] = {
            id: socket.id,
            name: data.name,
            team: data.team || "No Team", // NEW: Add team name
            level: 1, // All players start at level 1
            currentMaze: "Hogwarts Map" // Set initial location
        };

        if (!gameState.teams[data.team]) {
            gameState.teams[data.team] = {
                timeLeft: 600 // 10 minutes per team
            };
        }
        updateLeaderboard();
        broadcastToHost();
        
        // Start the game if it hasn't started yet
        if (!gameTimer) {
            console.log('Game started!');
            gameTimer = setInterval(() => {
                let gameEnded = true;
                for (const team in gameState.teams) {
                    if (gameState.teams[team].timeLeft > 0) {
                        gameState.teams[team].timeLeft--;
                        gameEnded = false;
                    }
                }
                updateLeaderboard();
                broadcastToHost();

                if (gameEnded) {
                    clearInterval(gameTimer);
                    gameTimer = null;
                    io.emit('gameover', gameState.leaderboard);
                }
            }, 1000);
        }
    });

    // --- 2. Handle HOST joining ---
    socket.on('joinHost', () => {
        console.log('Host connected!', socket.id);
        hostSocketId = socket.id;
        broadcastToHost();
    });

    // --- 3. Handle Player Updates (for maze name) ---
    socket.on('playerUpdate', (data) => {
        if (gameState.players[socket.id]) {
            gameState.players[socket.id].currentMaze = data.mazeName;
            broadcastToHost();
        }
    });

    // --- 4. Handle Disconnects ---
    socket.on('disconnect', () => {
        console.log('User disconnected:', socket.id);
        if (gameState.players[socket.id]) {
            console.log('Player disconnected:', gameState.players[socket.id].name);
            delete gameState.players[socket.id];
            updateLeaderboard();
            broadcastToHost();
        }
        if (socket.id === hostSocketId) {
            console.log('Host disconnected');
            hostSocketId = null;
        }
    });
});

// --- Helper Functions ---
function updateLeaderboard() {
    // Sorts the leaderboard by time left (most time wins)
    gameState.leaderboard = Object.entries(gameState.teams)
        .map(([team, data]) => ({
            team: team,
            timeLeft: data.timeLeft
        }))
        .sort((a, b) => b.timeLeft - a.timeLeft); // Sort descending by time left
}

function broadcastToHost() {
    if (hostSocketId && io.sockets.sockets.get(hostSocketId)) {
        io.sockets.sockets.get(hostSocketId).emit('gameStateUpdate', gameState);
    }
}

// --- FIX 2: This listens on your Wi-Fi IP ---
const PORT = 3000;
server.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running! Find your Wi-Fi IP address with the 'ipconfig' command.`);
});