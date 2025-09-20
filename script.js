import { randomInt, randomItemInArray, randomChance } from 'https://unpkg.com/randomness-helpers@0.0.1/dist/index.js';

// --- DOM ELEMENTS ---
const mapContainer = document.getElementById('map-container');
const videoContainer = document.getElementById('video-container');
const gateVideoElement = document.getElementById('gate-video');
const mazeContainer = document.getElementById('maze-container');
const welcomeContainer = document.getElementById('welcome-container');
const welcomeVideoElement = document.getElementById('welcome-video');
const allGates = document.querySelectorAll('.gate');

// --- MAZE GAME VARIABLES ---
const svgEl = document.querySelector('#maze-container svg');
const patternEl = document.querySelector('#maze-container .pattern');
const gridEl = document.querySelector('#maze-container .grid');
const mazeWrapper = document.getElementById('maze-wrapper');
const gridWidth = 20, gridHeight = 20, splittingChance = 0.000005, retryLimit = 30;
let mainPathPoints = [], otherPaths = [], gridData = [];
let turtle = { x: 0, y: 0, direction: 'north' };
let turtleEl, cellSize, endPoint = null;

// --- GAME STATE MANAGEMENT ---
let currentLevel = 1;
const totalLevels = 5;
let completedLevels = []; // Tracks which levels are done

// Add your 5 video filenames here
const gateVideos = [
    "level1_video.mp4",
    "level2_video.mp4",
    "level3_video.mp4",
    "level4_video.mp4",
    "level5_video.mp4"
];

// Initializes the game or sets up the next level
function initLevel() {
    mapContainer.classList.add('hidden');
    videoContainer.classList.add('hidden');
    mazeContainer.classList.add('hidden');
    welcomeContainer.classList.add('hidden');

    if (currentLevel > totalLevels) {
        welcomeContainer.classList.remove('hidden');
        welcomeVideoElement.currentTime = 0;
        welcomeVideoElement.play();
    } else {
        mapContainer.classList.remove('hidden');
        updateMapMarkers();
    }
}

// Updates gate icons (❓, ✅, pulse)
function updateMapMarkers() {
    allGates.forEach(gate => {
        const level = parseInt(gate.dataset.level);
        gate.classList.remove('active', 'completed');

        if (completedLevels.includes(level)) {
            gate.classList.add('completed'); // Show check mark
        } else if (level === currentLevel) {
            gate.classList.add('active'); // Show pulsing question mark
        }
    });
}

// Starts the video and pre-generates the maze
function startMazeChallenge() {
    mapContainer.classList.add('hidden');
    videoContainer.classList.remove('hidden');
    
    // Set the correct video for the current level
    gateVideoElement.src = gateVideos[currentLevel - 1];
    gateVideoElement.currentTime = 0;
    gateVideoElement.play();

    // Generate the maze data in the background while the video plays
    generateMazeData();
}

// --- EVENT LISTENERS ---
document.addEventListener('keydown', (e) => {
    if (!mapContainer.classList.contains('hidden') && e.key === 'ArrowUp') {
        e.preventDefault();
        startMazeChallenge();
    }
});

gateVideoElement.addEventListener('ended', () => {
    videoContainer.classList.add('hidden');
    mazeContainer.classList.remove('hidden');
    
    // Maze data is already generated, now just draw it instantly
    renderMazeFromData(); 
    initializeTurtle();
});

// --- MAZE GENERATION & RENDERING ---

// Generates maze data silently without visual updates or delays
// In script.js, replace the old generateMazeData function with this one

function generateMazeData() {
    let generationSuccess = false;
    let attempts = 0;

    // This outer loop will try to generate a complete maze up to 50 times.
    while (!generationSuccess && attempts < 50) {
        attempts++;
        refreshState(); // Start fresh with a new random endPoint

        // 1. Build the main path with a much higher safety limit
        let pathSafety = 0;
        // CHANGE THIS VALUE from 5000 to 50000
        while (pathSafety < 50000) { 
            pathSafety++;
            const lastPoint = mainPathPoints.at(-1);

            // If we reached the end, the path is a success.
            if (lastPoint.x === endPoint.x && lastPoint.y === endPoint.y) {
                generationSuccess = true;
                break; // Exit the inner path-building loop
            }

            const nextPoint = findNextPoint(lastPoint);
            if (nextPoint) {
                mainPathPoints.push(nextPoint);
                markPointAsTaken(nextPoint);
            } else {
                // If we have to backtrack past the very first step, this path has failed.
                if (mainPathPoints.length <= 2) {
                    break; // Exit the inner loop to let the outer loop try again.
                }
                markPointAsTaken(mainPathPoints.pop(), 0);
            }
        }
    }

    // If it still failed after many attempts, log an error.
    if (!generationSuccess) {
        console.error("Failed to generate a valid maze main path.");
        return; // Stop here to prevent further errors.
    }

    // 2. Build all other paths to fill the maze, also with a higher safety limit.
    let otherPathSafety = 0;
    // CHANGE THIS VALUE from 10000 to 100000
    while (!mazeComplete() && otherPathSafety < 100000) { 
        otherPathSafety++;
        addMorePaths();
        otherPaths.forEach(path => {
            const nextPoint = findNextPoint(path.at(-1));
            if (nextPoint) {
                path.push(nextPoint);
                markPointAsTaken(nextPoint);
            }
        });
    }
}

// Instantly draws the pre-generated maze to the screen
function renderMazeFromData() {
    const containerWidth = mazeWrapper.clientWidth - 20;
    const containerHeight = mazeWrapper.clientHeight - 20;
    cellSize = Math.floor(Math.min(containerWidth / gridWidth, containerHeight / gridHeight));
    
    const mazeWidth = gridWidth * cellSize;
    const mazeHeight = gridHeight * cellSize;
    svgEl.setAttribute('viewBox', `0 0 ${mazeWidth} ${mazeHeight}`);
    svgEl.setAttribute('width', mazeWidth);
    svgEl.setAttribute('height', mazeHeight);
    
    gridEl.innerHTML = drawGrid();
    let markup = otherPaths.map(path => drawLine(path)).join('') + drawLine(mainPathPoints, 'main');
    markup += drawEndPoint();
    patternEl.innerHTML = markup;
}

// --- CORE MAZE HELPER FUNCTIONS ---

function refreshState() {
    mainPathPoints = mainPathStartPoints();
    gridData = buildFreshGrid();
    markPointAsTaken(mainPathPoints.at(-1));
    otherPaths = [];
    endPoint = { x: randomInt(0, gridWidth - 1), y: 0 };
}

function findNextPoint(point) {
    const potentialPoints = [];
    if (gridData[point.y - 1]?.[point.x] === 0) potentialPoints.push({ y: point.y - 1, x: point.x });
    if (gridData[point.y + 1]?.[point.x] === 0) potentialPoints.push({ y: point.y + 1, x: point.x });
    if (gridData[point.y]?.[point.x - 1] === 0) potentialPoints.push({ y: point.y, x: point.x - 1 });
    if (gridData[point.y]?.[point.x + 1] === 0) potentialPoints.push({ y: point.y, x: point.x + 1 });
    return randomItemInArray(potentialPoints);
}

function mazeComplete() { return gridData.flat().every(cell => cell === 1); }

function addMorePaths() {
    gridData.forEach((row, y) => row.forEach((cell, x) => {
        if (cell && randomChance(splittingChance)) otherPaths.push([{ y, x }]);
    }));
}

function markPointAsTaken(point, value = 1) {
    if (point.y >= 0 && point.y < gridHeight && point.x >= 0 && point.x < gridWidth) {
        gridData[point.y][point.x] = value;
    }
}

function buildFreshGrid() { return new Array(gridHeight).fill().map(() => new Array(gridWidth).fill(0)); }

function mainPathStartPoints() { return [{ x: 0, y: gridHeight }, { x: 0, y: gridHeight - 1 }]; }

function drawGrid() {
    let markup = '';
    for (let y = 0; y <= gridHeight; y++) markup += `<line class="grid-line" x1="0" x2="${gridWidth * cellSize}" y1="${y * cellSize}" y2="${y * cellSize}"/>`;
    for (let x = 0; x <= gridWidth; x++) markup += `<line class="grid-line" y1="0" y2="${gridHeight * cellSize}" x1="${x * cellSize}" x2="${x * cellSize}"/>`;
    return markup;
}

function adjustMazePoint(point) { return { x: cellSize / 2 + point.x * cellSize, y: cellSize / 2 + point.y * cellSize }; }

function buildPathData(points) {
    let transformedPoints = points.map(adjustMazePoint);
    const firstPoint = transformedPoints.shift();
    if (!firstPoint) return '';
    let commands = [`M ${firstPoint.x}, ${firstPoint.y}`];
    transformedPoints.forEach(point => commands.push(`L ${point.x}, ${point.y}`));
    return commands.join(' ');
}

// CORRECTED drawLine function
function drawLine(points, className = '') {
    const wallThickness = 4;
    const pathStrokeWidth = Math.max(1, cellSize - wallThickness);
    const style = `stroke-width: ${pathStrokeWidth}px`;
    return `<path class="maze-path ${className}" d="${buildPathData([...points])}" style="${style}"/>`;
}

function drawEndPoint() {
    if (!endPoint) return '';
    const markerSize = cellSize * 0.7;
    const offset = (cellSize - markerSize) / 2;
    const x = endPoint.x * cellSize + offset;
    const y = endPoint.y * cellSize + offset;
    return `<rect class="end-point" x="${x}" y="${y}" width="${markerSize}" height="${markerSize}" />`;
}

// --- TURTLE FUNCTIONS ---

function initializeTurtle() {
    if (!turtleEl) {
        turtleEl = document.createElement('div');
        turtleEl.classList.add('turtle');
        mazeWrapper.appendChild(turtleEl);
    }
    turtleEl.style.display = 'block';
    const startPoint = mainPathPoints[1];
    turtle.x = startPoint.x;
    turtle.y = startPoint.y;
    turtle.direction = 'north';
    positionTurtle();
}

function positionTurtle() {
    const svgRect = svgEl.getBoundingClientRect();
    const mazeWrapperRect = mazeWrapper.getBoundingClientRect();
    const offsetX = svgRect.left - mazeWrapperRect.left;
    const offsetY = svgRect.top - mazeWrapperRect.top;
    const targetX = offsetX + (turtle.x * cellSize) + (cellSize / 2);
    const targetY = offsetY + (turtle.y * cellSize) + (cellSize / 2);
    turtleEl.style.left = `${targetX}px`;
    turtleEl.style.top = `${targetY}px`;
    let rotation = 0;
    switch (turtle.direction) {
        case 'north': rotation = 0; break;
        case 'east': rotation = 90; break;
        case 'south': rotation = 180; break;
        case 'west': rotation = 270; break;
    }
    turtleEl.style.transform = `translate(-50%, -50%) rotate(${rotation}deg)`;
}

function isPathConnected(p1, p2) {
    const allPaths = [mainPathPoints, ...otherPaths];
    for (const path of allPaths) {
        for (let i = 0; i < path.length - 1; i++) {
            const currentPoint = path[i], nextPoint = path[i + 1];
            if ((currentPoint.x === p1.x && currentPoint.y === p1.y && nextPoint.x === p2.x && nextPoint.y === p2.y) ||
                (currentPoint.x === p2.x && currentPoint.y === p2.y && nextPoint.x === p1.x && nextPoint.y === p1.y)) {
                return true;
            }
        }
    }
    return false;
}

function moveTurtle(direction) {
    let newX = turtle.x, newY = turtle.y;
    switch (direction) {
        case 'north': newY--; break;
        case 'east':  newX++; break;
        case 'south': newY++; break;
        case 'west':  newX--; break;
    }
    if (isPathConnected({x: turtle.x, y: turtle.y}, {x: newX, y: newY})) {
        turtle.x = newX;
        turtle.y = newY;
        turtle.direction = direction;
        positionTurtle();
        if (turtle.x === endPoint.x && turtle.y === endPoint.y) {
            setTimeout(() => {
                alert(`Level ${currentLevel} complete!`);
                completedLevels.push(currentLevel);
                currentLevel++;
                initLevel();
            }, 200);
        }
    }
}

document.body.addEventListener('keydown', (e) => {
    if (!mazeContainer.classList.contains('hidden')) {
        switch (e.key) {
            case 'ArrowUp': moveTurtle('north'); break;
            case 'ArrowDown': moveTurtle('south'); break;
            case 'ArrowLeft': moveTurtle('west'); break;
            case 'ArrowRight': moveTurtle('east'); break;
        }
    }
});

// --- INITIALIZE THE GAME ---
initLevel();