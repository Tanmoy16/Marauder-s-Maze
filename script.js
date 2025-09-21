import { randomInt, randomItemInArray, randomChance } from 'https://unpkg.com/randomness-helpers@0.0.1/dist/index.js';

// --- NEW WEBSOCKET ---
// Connect to your server (make sure server.js is running)
// Use "http://localhost:3000" for testing
// Use your server's public IP when you deploy
const socket = io("http://172.18.237.108:3000"); 

// Get the player's name (you can make this a proper UI later)
const playerName = prompt("Enter your wizard name:") || "Nameless Wizard";
socket.emit("joinGame", { name: playerName });
// --- END NEW WEBSOCKET ---

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
// Add this new array
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
let allPaths = []; // REPLACES mainPathPoints and otherPaths
let turtle = { x: 0, y: 0, direction: 'north' };
let turtleEl, cellSize, endPoint = null, startPoint = null;

// --- GAME STATE MANAGEMENT ---
let currentLevel = 1;
const totalLevels = 5;
let completedLevels = [];

// NEW: Array to hold theme data for each level
const levelThemes = [
    { name: "Hogsmeade Railway Station", pathColor: '#CDBA96', backgroundImage: 'hogsmeade-bg.jpg' },
    { name: "The Whomping Willows",      pathColor: '#8B4513', backgroundImage: 'willow-bg.jpg' },
    { name: "The Quidditch Ground",      pathColor: '#6B8E23', backgroundImage: 'quidditch-bg.jpg' },
    { name: "The Forbidden Forest",      pathColor: '#2F4F4F', backgroundImage: 'forest-bg.jpg' },
    { name: "The Hogwarts Gate",         pathColor: '#D4AF37', backgroundImage: 'gate-bg.jpg' }
];

// IMPORTANT: Make sure you have video files with these exact names in your folder
const gateVideos = [
    "level1_video.mp4", "level2_video.mp4", "level3_video.mp4", "level4_video.mp4", "level5_video.mp4"
];


function initLevel() {
    mapContainer.classList.add('hidden');
    videoContainer.classList.add('hidden');
    mazeContainer.classList.add('hidden');
    welcomeContainer.classList.add('hidden');

    if (currentLevel > totalLevels) {
        welcomeContainer.classList.remove('hidden');
        welcomeVideoElement.currentTime = 0;
        welcomeVideoElement.play().catch(e => console.error("Welcome video play failed:", e));
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
            // Add static footprints for completed levels
            const fp1 = document.createElement('div');
            fp1.className = 'footprint static-1';
            const fp2 = document.createElement('div');
            fp2.className = 'footprint static-2';
            gate.append(fp1, fp2);
        } else if (level === currentLevel) {
            // Add appearing footprints for the active level
            for (let i = 0; i < 3; i++) {
                const fp = document.createElement('div');
                fp.className = 'footprint active';
                // Position and delay each footprint
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
    // Generate the maze data in the background while the video plays
    generateMazeData();
}

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
});


// --- NEW MAZE GENERATION (RECURSIVE BACKTRACKER) ---
function generateMazeData() {
    // 1. Initialize
    gridData = new Array(gridHeight).fill().map(() => new Array(gridWidth).fill(0));
    allPaths = [];
    const stack = [];

    // 2. Define Start and End Points
    startPoint = { x: 0, y: gridHeight - 1 };
    endPoint = { x: randomInt(Math.floor(gridWidth / 2), gridWidth - 1), y: 0 };
    
    let current = startPoint;
    gridData[current.y][current.x] = 1; // Mark as visited
    stack.push(current);

    // 3. The Algorithm Loop
    let safety = 0;
    while (stack.length > 0 && safety < gridWidth * gridHeight * 5) {
        safety++;
        current = stack.pop();
        const neighbors = getUnvisitedNeighbors(current);

        if (neighbors.length > 0) {
            stack.push(current); // Push current back to stack
            const next = randomItemInArray(neighbors);
            
            // "Carve" the path between current and next
            allPaths.push([current, next]);

            gridData[next.y][next.x] = 1; // Mark next as visited
            stack.push(next);
        }
    }
}

function getUnvisitedNeighbors(point) {
    const neighbors = [];
    const { x, y } = point;
    // North
    if (y > 0 && gridData[y - 1][x] === 0) neighbors.push({ x, y: y - 1 });
    // South
    if (y < gridHeight - 1 && gridData[y + 1][x] === 0) neighbors.push({ x, y: y + 1 });
    // West
    if (x > 0 && gridData[y][x - 1] === 0) neighbors.push({ x: x - 1, y });
    // East
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
    
    // Create the markup for all the maze paths first
    let markup = allPaths.map(pathSegment => drawLine(pathSegment, '', theme.pathColor)).join('');
    
    // Add fake entrance and exit paths for visual clarity
    markup += drawLine([{ x: startPoint.x, y: gridHeight }, startPoint], '', theme.pathColor);
    markup += drawLine([endPoint, { x: endPoint.x, y: -1 }], '', theme.pathColor);
    
    // NOW, add the endpoint gate LAST so it draws on top
    markup += drawEndPoint(); 
    
    patternEl.innerHTML = markup;
}

function adjustMazePoint(p) { return { x: cellSize / 2 + p.x * cellSize, y: cellSize / 2 + p.y * cellSize }; }
function buildPathData(points) { let t = points.map(adjustMazePoint); const f = t.shift(); if (!f) return ''; return `M ${f.x},${f.y} L ${t[0].x},${t[0].y}`; }
function drawLine(points, className = '', color = 'white') { const wallThickness = 4; const pathStrokeWidth = Math.max(1, cellSize - wallThickness); const style = `stroke-width: ${pathStrokeWidth}px; stroke: ${color};`; return `<path class="maze-path ${className}" d="${buildPathData([...points])}" style="${style}"/>`; }
function drawEndPoint() {
    if (!endPoint) return '';

    // Gate dimensions relative to the cell size
    const gateWidth = cellSize * 0.8;
    const gateHeight = cellSize * 0.8;
    const postWidth = gateWidth * 0.15;
    const topBarHeight = postWidth;
    
    // Calculate offsets to center the gate in the cell
    const cellX = endPoint.x * cellSize;
    const cellY = endPoint.y * cellSize;
    const offsetX = (cellSize - gateWidth) / 2;
    const offsetY = (cellSize - gateHeight) / 2;

    const gateColor = "#A0522D"; // A stone/wood color that fits the theme

    // Define the three rectangles that make up the gate
    const leftPost = `<rect 
        x="${cellX + offsetX}" 
        y="${cellY + offsetY + topBarHeight}" 
        width="${postWidth}" 
        height="${gateHeight - topBarHeight}" 
        fill="${gateColor}" 
    />`;

    const rightPost = `<rect 
        x="${cellX + offsetX + gateWidth - postWidth}" 
        y="${cellY + offsetY + topBarHeight}" 
        width="${postWidth}" 
        height="${gateHeight - topBarHeight}" 
        fill="${gateColor}" 
    />`;

    const topBar = `<rect 
        x="${cellX + offsetX}" 
        y="${cellY + offsetY}" 
        width="${gateWidth}" 
        height="${topBarHeight}" 
        fill="${gateColor}" 
    />`;

    return leftPost + rightPost + topBar;
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

        if (turtle.x === endPoint.x && turtle.y === endPoint.y) {
            setTimeout(() => {
                alert(`Level ${currentLevel} complete!`);
                completedLevels.push(currentLevel);
                const fromLevel = currentLevel;
                currentLevel++;
                
                // Call the new path animation!
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
        // If there's no path or game is over, just initialize next level
        initLevel();
        return;
    }

    const animator = document.getElementById('path-animator');
    animator.style.offsetPath = `path('${pathData}')`;
    
    // One-time event listener for when the animation finishes
    animator.addEventListener('animationend', () => {
        animator.classList.remove('animate');
        animator.style.opacity = 0; // Hide it again
        initLevel(); // Now update the map markers
    }, { once: true });

    // Start the animation
    animator.style.opacity = 1;
    animator.classList.add('animate');
}

// --- INITIALIZE THE GAME ---
initLevel();