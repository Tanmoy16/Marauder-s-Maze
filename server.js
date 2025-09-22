const express = require('express');
const http = require('http');
const { Server } = require("socket.io");
const cors = require('cors');
const path = require('path'); 

const app = express();
app.use(cors()); // Allow connections from your game

// --- FIX 1: This serves your HTML, CSS, and JS files ---
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
    leaderboard: [] // Stores Golden Eggs
};

// Store the host's unique socket ID
let hostSocketId = null;

io.on('connection', (socket) => {
    console.log('A user connected:', socket.id);

    // --- 1. Handle PLAYER joining ---
    socket.on('joinGame', (data) => {
        console.log('Player joined:', data.name);
        gameState.players[socket.id] = {
            id: socket.id,
            name: data.name,
            level: 1, // All players start at level 1
            eggs: 0,  // All players start with 0 Golden Eggs
            currentMaze: "Hogwarts Map" // Set initial location
        };
        updateLeaderboard();
        broadcastToHost();
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

    // --- 4. Handle Maze Completion (AWARDS GOLDEN EGGS) ---
    socket.on('mazeComplete', (data) => {
        if (gameState.players[socket.id]) {
            const eggsToAward = 100; // REWARD for finishing a maze
            gameState.players[socket.id].eggs += eggsToAward;
            gameState.players[socket.id].level = data.newLevel; // Update their level
            
            console.log(`${gameState.players[socket.id].name} finished a maze! Total Eggs: ${gameState.players[socket.id].eggs}`);
            
            updateLeaderboard(); // Re-sort the leaderboard
            broadcastToHost();
        }
    });

    // --- 5. Handle Disconnects ---
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
    // Sorts the leaderboard by Golden Eggs (most eggs wins)
    gameState.leaderboard = Object.values(gameState.players)
        .sort((a, b) => b.eggs - a.eggs) // Sort descending by eggs
        .map(player => ({ name: player.name, eggs: player.eggs })); 
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
// ----------------------------------------