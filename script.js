import { randomInt, randomItemInArray, randomChance } from 'https://unpkg.com/randomness-helpers@0.0.1/dist/index.js';

// --- NEW WEBSOCKET ---
// !! IMPORTANT !!
// Change this to your server's REAL Wi-Fi IP Address
const socket = io("http:// 172.17.213.181:3000"); 

// --- NEW MODAL LOGIC ---
const nameModalOverlay = document.getElementById('name-modal-overlay');
const nameModal = document.getElementById('name-modal');
const nameInput = document.getElementById('player-name-input');
const teamInput = document.getElementById('team-name-input');
const nameButton = document.getElementById('submit-name-button');

nameButton.addEventListener('click', () => {
    const playerName = nameInput.value || "Nameless Wizard";
    const teamName = teamInput.value || "No Team";
    
    // 1. Send the name to the server
    socket.emit("joinGame", { name: playerName, team: teamName });
    
    // 2. Hide the modal
    nameModal.style.display = 'none';
    nameModalOverlay.style.display = 'none';
});
// --- END NEW MODAL LOGIC ---



// --- DOM ELEMENTS ---
const mapContainer = document.getElementById('map-container');
const videoContainer = document.getElementById('video-container');
const gateVideoElement = document.getElementById('gate-video');
const mazeContainer = document.getElementById('maze-container');
const welcomeContainer = document.getElementById('welcome-container');
const welcomeVideoElement = document.getElementById('welcome-video');
const allGates = document.querySelectorAll('.gate');
const mazeHeaderEl = document.querySelector('#maze-container header h1');

// --- MAZE GAME VARIABLES ---
const levelPaths = [
    null, // No path leading to level 1
    "M 23 65 C 20 60, 18 55, 16 48", // Path from gate 1 to 2
    "M 16 48 C 25 45, 40 55, 55 80", // Path from gate 2 to 3
    "M 55 80 C 60 70, 70 60, 75 50", // Path from gate 3 to 4
    "M 75 50 C 78 40, 80 30, 80 25", // Path from gate 4 to 5
];
const svgEl = document.querySelector('#maze-container svg');
const patternEl = document.querySelector('#maze-container .pattern');
const gridEl = document.querySelector('#maze-container .grid');
const mazeWrapper = document.getElementById('maze-wrapper');

const gridWidth = 20, gridHeight = 20;
let gridData = [];
let allPaths = []; 
let turtle = { x: 0, y: 0, direction: 'north' };
let turtleEl, cellSize, endPoint = null, startPoint = null;

// --- GAME STATE MANAGEMENT ---
let currentLevel = 1;
const totalLevels = 5;
let completedLevels = [];

// --- NEW 10-MINUTE TIMER VARIABLES ---
let gameStartTime; // The one and only start time (in ms)
let globalTimerInterval; // The interval for the countdown
const totalGameDuration = 10 * 60 * 1000; // 10 minutes in milliseconds
// -------------------------------------

const levelThemes = [
    { name: "Hogsmeade Railway Station", pathColor: '#CDBA96', backgroundImage: 'hogsmeade-bg.jpg' },
    { name: "The Whomping Willows",      pathColor: '#d4e025ff', backgroundImage: 'willow-bg.jpg' },
    { name: "The Quidditch Ground",      pathColor: '#cd2bbaff', backgroundImage: 'quidditch-bg.jpg' },
    { name: "The Forbidden Forest",      pathColor: '#109c9cff', backgroundImage: 'forest-bg.jpg' },
    { name: "The Hogwarts Gate",         pathColor: '#D4AF37', backgroundImage: 'gate-bg.jpg' }
];

const gateVideos = [
    "level1_video.mp4", "level2_video.mp4", "level3_video.mp4", "level4_video.mp4", "level5_video.mp4"
];


function initLevel(forceReset = false) {
    mapContainer.classList.add('hidden');
    videoContainer.classList.add('hidden');
    mazeContainer.classList.add('hidden');
    welcomeContainer.classList.add('hidden');

    // This is called from gameOver to reset the game
    if (forceReset) {
        currentLevel = 1;
        completedLevels = [];
        stopGlobalTimer();
        const timerElement = document.getElementById('game-timer-display');
        if(timerElement) {
            timerElement.textContent = `Time Left: 10:00`;
            timerElement.classList.remove('low-time');
        }
        mapContainer.classList.remove('hidden');
        updateMapMarkers();
        return;
    }
    
    if (currentLevel > totalLevels) {
        welcomeContainer.classList.remove('hidden');
        welcomeVideoElement.currentTime = 0;
        welcomeVideoElement.play().catch(e => console.error("Welcome video play failed:", e));
        stopGlobalTimer(); // Game is over, stop the timer
    } else {
        mapContainer.classList.remove('hidden');
        updateMapMarkers();
    }
}

function updateMapMarkers() {
    allGates.forEach(gate => {
        const level = parseInt(gate.dataset.level);
        gate.innerHTML = ''; // Clear previous icons

        if (completedLevels.includes(level)) {
            const fp1 = document.createElement('div');
            fp1.className = 'footprint static-1';
            const fp2 = document.createElement('div');
            fp2.className = 'footprint static-2';
            gate.append(fp1, fp2);
        } else if (level === currentLevel) {
            for (let i = 0; i < 3; i++) {
                const fp = document.createElement('div');
                fp.className = 'footprint active';
                fp.style.left = `${15 + i * 25}%`;
                fp.style.top = `${60 - i * 15}%`;
                fp.style.animationDelay = `${i * 0.3}s`;
                gate.append(fp);
            }
        }
    });
}

function startMazeChallenge() {
    mapContainer.classList.add('hidden');
    videoContainer.classList.remove('hidden');
    gateVideoElement.src = gateVideos[currentLevel - 1];
    gateVideoElement.currentTime = 0;
    gateVideoElement.play().catch(e => console.error("Gate video play failed:", e));
    generateMazeData();
}

// --- NEW TIMER FUNCTIONS ---
function formatTime(milliseconds) {
    const totalSeconds = Math.max(0, Math.floor(milliseconds / 1000));
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

function stopGlobalTimer() {
    clearInterval(globalTimerInterval);
}

function gameOver(message) {
    stopGlobalTimer();
    alert(message);
    
    // Send a "game over" time to the server (a very high number)
    const finalTime = 99999;
    socket.emit("mazeComplete", {
        level: currentLevel,
        time: finalTime 
    });
    
    // Reset the game
    initLevel(true); 
}

function startGlobalTimer() {
    // Only start if it's not already running
    if (gameStartTime) return; 

    gameStartTime = Date.now();
    const timerElement = document.getElementById('game-timer-display');
    if (!timerElement) return;

    globalTimerInterval = setInterval(() => {
        const elapsed = Date.now() - gameStartTime;
        const remaining = totalGameDuration - elapsed;

        timerElement.textContent = `Time Left: ${formatTime(remaining)}`;

        // Check for low time (last minute)
        if (remaining <= 60 * 1000 && !timerElement.classList.contains('low-time')) {
            timerElement.classList.add('low-time');
        }

        // Check for time's up
        if (remaining <= 0) {
            gameOver("Time's up! The magic has faded...");
        }
    }, 1000);
}
// --- END NEW TIMER FUNCTIONS ---

// --- EVENT LISTENERS ---
document.addEventListener('keydown', (e) => {
    // Start level from map screen
    if (!mapContainer.classList.contains('hidden') && e.key === 'ArrowUp') {
        e.preventDefault();
        startMazeChallenge();
    }
    // Move turtle in maze
    if (!mazeContainer.classList.contains('hidden')) {
        e.preventDefault();
        switch (e.key) {
            case 'ArrowUp': moveTurtle('north'); break;
            case 'ArrowDown': moveTurtle('south'); break;
            case 'ArrowLeft': moveTurtle('west'); break;
            case 'ArrowRight': moveTurtle('east'); break;
        }
    }
});

gateVideoElement.addEventListener('ended', () => {
    videoContainer.classList.add('hidden');
    mazeContainer.classList.remove('hidden');
    renderMazeFromData(); 
    initializeTurtle();
    
    // --- NEW: Start global timer only on level 1 ---
    if (currentLevel === 1) {
        startGlobalTimer();
    }
    // ---------------------------------------------

    // Tell the server which maze this player is now in
    const theme = levelThemes[currentLevel - 1];
    socket.emit("playerUpdate", {
        mazeName: theme.name,
        mazeLevel: currentLevel
    });
});


// --- NEW MAZE GENERATION (RECURSIVE BACKTRACKER) ---
function generateMazeData() {
    gridData = new Array(gridHeight).fill().map(() => new Array(gridWidth).fill(0));
    allPaths = [];
    const stack = [];

    startPoint = { x: 0, y: gridHeight - 1 };
    endPoint = { x: randomInt(Math.floor(gridWidth / 2), gridWidth - 1), y: 0 };
    
    let current = startPoint;
    gridData[current.y][current.x] = 1; // Mark as visited
    stack.push(current);

    let safety = 0;
    while (stack.length > 0 && safety < gridWidth * gridHeight * 5) {
        safety++;
        current = stack.pop();
        const neighbors = getUnvisitedNeighbors(current);

        if (neighbors.length > 0) {
            stack.push(current); 
            const next = randomItemInArray(neighbors);
            
            allPaths.push([current, next]);

            gridData[next.y][next.x] = 1; 
            stack.push(next);
        }
    }
}

function getUnvisitedNeighbors(point) {
    const neighbors = [];
    const { x, y } = point;
    if (y > 0 && gridData[y - 1][x] === 0) neighbors.push({ x, y: y - 1 });
    if (y < gridHeight - 1 && gridData[y + 1][x] === 0) neighbors.push({ x, y: y + 1 });
    if (x > 0 && gridData[y][x - 1] === 0) neighbors.push({ x: x - 1, y });
    if (x < gridWidth - 1 && gridData[y][x + 1] === 0) neighbors.push({ x: x + 1, y });
    return neighbors;
}

// --- MAZE RENDERING ---
function renderMazeFromData() {
    const theme = levelThemes[currentLevel - 1];
    mazeHeaderEl.textContent = `PotterNova: ${theme.name}`;
    mazeContainer.style.backgroundImage = `url('${theme.backgroundImage}')`;

    const containerWidth = mazeWrapper.clientWidth - 20;
    const containerHeight = mazeWrapper.clientHeight - 20;
    cellSize = Math.floor(Math.min(containerWidth / gridWidth, containerHeight / gridHeight));
    
    const mazeWidth = gridWidth * cellSize;
    const mazeHeight = gridHeight * cellSize;
    svgEl.setAttribute('viewBox', `0 0 ${mazeWidth} ${mazeHeight}`);
    svgEl.setAttribute('width', mazeWidth);
    svgEl.setAttribute('height', mazeHeight);
    
    gridEl.innerHTML = '';
    
    let markup = allPaths.map(pathSegment => drawLine(pathSegment, '', theme.pathColor)).join('');
    markup += drawLine([{ x: startPoint.x, y: gridHeight }, startPoint], '', theme.pathColor);
    markup += drawLine([endPoint, { x: endPoint.x, y: -1 }], '', theme.pathColor);
    markup += drawEndPoint(); 
    
    patternEl.innerHTML = markup;
}

function adjustMazePoint(p) { return { x: cellSize / 2 + p.x * cellSize, y: cellSize / 2 + p.y * cellSize }; }
function buildPathData(points) { let t = points.map(adjustMazePoint); const f = t.shift(); if (!f) return ''; return `M ${f.x},${f.y} L ${t[0].x},${t[0].y}`; }
function drawLine(points, className = '', color = 'white') { const wallThickness = 4; const pathStrokeWidth = Math.max(1, cellSize - wallThickness); const style = `stroke-width: ${pathStrokeWidth}px; stroke: ${color};`; return `<path class="maze-path ${className}" d="${buildPathData([...points])}" style="${style}"/>`; }
function drawEndPoint() {
    if (!endPoint) return '';
    const gateWidth = cellSize * 0.8;
    const gateHeight = cellSize * 0.8;
    const postWidth = gateWidth * 0.15;
    const topBarHeight = postWidth;
    const cellX = endPoint.x * cellSize;
    const cellY = endPoint.y * cellSize;
    const offsetX = (cellSize - gateWidth) / 2;
    const offsetY = (cellSize - gateHeight) / 2;
    const gateColor = "#A0522D"; 
    const leftPost = `<rect x="${cellX + offsetX}" y="${cellY + offsetY + topBarHeight}" width="${postWidth}" height="${gateHeight - topBarHeight}" fill="${gateColor}" />`;
    const rightPost = `<rect x="${cellX + offsetX + gateWidth - postWidth}" y="${cellY + offsetY + topBarHeight}" width="${postWidth}" height="${gateHeight - topBarHeight}" fill="${gateColor}" />`;
    const topBar = `<rect x="${cellX + offsetX}" y="${cellY + offsetY}" width="${gateWidth}" height="${topBarHeight}" fill="${gateColor}" />`;
    return `<g class="end-point">${leftPost + rightPost + topBar}</g>`;
}

// --- TURTLE FUNCTIONS ---
function initializeTurtle() {
    if (!turtleEl) {
        turtleEl = document.createElement('div');
        turtleEl.classList.add('turtle');
        mazeWrapper.appendChild(turtleEl);
    }
    turtleEl.style.display = 'block';
    turtle.x = startPoint.x;
    turtle.y = startPoint.y;
    turtle.direction = 'north';
    positionTurtle();
}

function positionTurtle() {
    const svgRect = svgEl.getBoundingClientRect();
    const wrapperRect = mazeWrapper.getBoundingClientRect();
    const offsetX = svgRect.left - wrapperRect.left;
    const offsetY = svgRect.top - wrapperRect.top;
    const targetX = offsetX + (turtle.x * cellSize) + (cellSize / 2);
    const targetY = offsetY + (turtle.y * cellSize) + (cellSize / 2);
    let rotation = 0;
    switch (turtle.direction) {
        case 'east': rotation = 90; break;
        case 'south': rotation = 180; break;
        case 'west': rotation = 270; break;
    }
    turtleEl.style.transform = `translateX(${targetX}px) translateY(${targetY}px) translate(-50%, -50%) rotate(${rotation}deg)`;
}

function isPathConnected(p1, p2) {
    for (const path of allPaths) {
        const [start, end] = path;
        if ((start.x === p1.x && start.y === p1.y && end.x === p2.x && end.y === p2.y) ||
            (start.x === p2.x && start.y === p2.y && end.x === p1.x && end.y === p1.y)) {
            return true;
        }
    }
    return false;
}

function moveTurtle(direction) {
    let nextX = turtle.x, nextY = turtle.y;
    switch (direction) {
        case 'north': nextY--; break;
        case 'east': nextX++; break;
        case 'south': nextY++; break;
        case 'west': nextX--; break;
    }

    if (isPathConnected({ x: turtle.x, y: turtle.y }, { x: nextX, y: nextY })) {
        turtle.x = nextX;
        turtle.y = nextY;
        turtle.direction = direction;
        positionTurtle();

        // --- WIN CONDITION ---
        if (turtle.x === endPoint.x && turtle.y === endPoint.y) {
            setTimeout(() => {
                alert(`Level ${currentLevel} complete! You earned 100 Golden Eggs!`);
                completedLevels.push(currentLevel);
                const fromLevel = currentLevel;
                currentLevel++; // Advance the level
                
                // --- NEW: Emit maze complete with new level ---
                // The server will see this and give you 100 eggs
                socket.emit("mazeComplete", {
                    newLevel: currentLevel // Send the *new* level they are on
                });
                // ------------------------------------------------
                
                playPathAnimation(fromLevel, currentLevel);
            }, 200);
        }
    }
}

function playPathAnimation(fromLevel, toLevel) {
    mazeContainer.classList.add('hidden');
    mapContainer.classList.remove('hidden');

    const pathData = levelPaths[toLevel -1];
    if (!pathData || toLevel > totalLevels) {
        initLevel();
        return;
    }

    const animator = document.getElementById('path-animator');
    animator.style.offsetPath = `path('${pathData}')`;
    
    animator.addEventListener('animationend', () => {
        animator.classList.remove('animate');
        animator.style.opacity = 0; 
        initLevel(); 
    }, { once: true });

    animator.style.opacity = 1;
    animator.classList.add('animate');
}

// --- INITIALIZE THE GAME ---
initLevel();