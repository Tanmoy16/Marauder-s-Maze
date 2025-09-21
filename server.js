const express = require('express');
const http = require('http');
const { Server } = require("socket.io");
const cors = require('cors');

const app = express();
app.use(cors()); // Allow connections from your game
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
    leaderboard: [] // Stores scores
};

// Store the host's unique socket ID
let hostSocketId = null;

io.on('connection', (socket) => {
    console.log('A user connected:', socket.id);

    // --- 1. Handle PLAYER joining ---
    socket.on('joinGame', (data) => {
        console.log('Player joined:', data.name);
        // Save player data
        gameState.players[socket.id] = {
            id: socket.id,
            name: data.name,
            currentMaze: "Hogwarts Map", // Starting location
            score: 0
        };
        // Broadcast the new state to the Host
        broadcastToHost();
    });

    // --- 2. Handle HOST joining ---
    socket.on('joinHost', () => {
        console.log('Host connected!', socket.id);
        hostSocketId = socket.id;
        // Send them the current state right away
        broadcastToHost();
    });

    // --- 3. Handle Player Updates ---
    socket.on('playerUpdate', (data) => {
        if (gameState.players[socket.id]) {
            gameState.players[socket.id].currentMaze = data.mazeName;
            console.log(gameState.players[socket.id].name, "is now in", data.mazeName);
            // Broadcast the new state to the Host
            broadcastToHost();
        }
    });

    // --- 4. Handle Maze Completion ---
    socket.on('mazeComplete', (data) => {
        if (gameState.players[socket.id]) {
            gameState.players[socket.id].score += data.score;
            // Update leaderboard
            updateLeaderboard();
            console.log(gameState.players[socket.id].name, "completed a maze! Score:", gameState.players[socket.id].score);
            // Broadcast the new state to the Host
            broadcastToHost();
        }
    });

    // --- 5. Handle Disconnects ---
    socket.on('disconnect', () => {
        console.log('User disconnected:', socket.id);
        // Check if it was a player
        if (gameState.players[socket.id]) {
            console.log('Player disconnected:', gameState.players[socket.id].name);
            delete gameState.players[socket.id];
            updateLeaderboard();
            broadcastToHost();
        }
        // Check if it was the host
        if (socket.id === hostSocketId) {
            console.log('Host disconnected');
            hostSocketId = null;
        }
    });
});

// --- Helper Functions ---

function updateLeaderboard() {
    // Get all players, sort by score, and update the leaderboard array
    gameState.leaderboard = Object.values(gameState.players)
        .sort((a, b) => b.score - a.score) // Sort descending
        .map(player => ({ name: player.name, score: player.score }));
}

function broadcastToHost() {
    // Check if the host is still connected
    if (hostSocketId && io.sockets.sockets.get(hostSocketId)) {
        // Send the *entire* game state to the host
        io.sockets.sockets.get(hostSocketId).emit('gameStateUpdate', gameState);
    }
}

// Start the server
const PORT = 3000;
server.listen(PORT, () => {
    console.log(`Server running on http://localhost:3000`);
});