import { randomInt, randomItemInArray, randomChance } from 'https://unpkg.com/randomness-helpers@0.0.1/dist/index.js';

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
const svgEl = document.querySelector('#maze-container svg');
const patternEl = document.querySelector('#maze-container .pattern');
const gridEl = document.querySelector('#maze-container .grid');
const mazeWrapper = document.getElementById('maze-wrapper');
// Adjust splittingChance for maze difficulty (lower is harder)
const gridWidth = 20, gridHeight = 20, splittingChance = 0.00005, retryLimit = 30;
let mainPathPoints = [], otherPaths = [], gridData = [];
let turtle = { x: 0, y: 0, direction: 'north' };
let turtleEl, cellSize, endPoint = null;

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
        welcomeVideoElement.play();
    } else {
        mapContainer.classList.remove('hidden');
        updateMapMarkers();
    }
}

function updateMapMarkers() {
    allGates.forEach(gate => {
        const level = parseInt(gate.dataset.level);
        gate.classList.remove('active', 'completed');
        if (completedLevels.includes(level)) {
            gate.classList.add('completed');
        } else if (level === currentLevel) {
            gate.classList.add('active');
        }
    });
}

function startMazeChallenge() {
    mapContainer.classList.add('hidden');
    videoContainer.classList.remove('hidden');
    gateVideoElement.src = gateVideos[currentLevel - 1];
    gateVideoElement.currentTime = 0;
    gateVideoElement.play();
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
    renderMazeFromData(); 
    initializeTurtle();
});

// --- MAZE GENERATION & RENDERING ---
function generateMazeData() {
    let generationSuccess = false;
    let attempts = 0;
    while (!generationSuccess && attempts < 50) {
        attempts++;
        refreshState();
        let pathSafety = 0;
        while (pathSafety < 250000) {
            pathSafety++;
            const lastPoint = mainPathPoints.at(-1);
            if (lastPoint.x === endPoint.x && lastPoint.y === endPoint.y) {
                generationSuccess = true;
                break;
            }
            const nextPoint = findNextPoint(lastPoint);
            if (nextPoint) {
                mainPathPoints.push(nextPoint);
                markPointAsTaken(nextPoint);
            } else {
                if (mainPathPoints.length <= 2) break;
                markPointAsTaken(mainPathPoints.pop(), 0);
            }
        }
    }
    if (!generationSuccess) { console.error("Failed to generate a valid maze main path."); return; }
    let otherPathSafety = 0;
    while (!mazeComplete() && otherPathSafety < 500000) {
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
    
    gridEl.innerHTML = ''; // Ensure grid is empty
    let markup = otherPaths.map(path => drawLine(path, '', theme.pathColor)).join('') 
               + drawLine(mainPathPoints, 'main', theme.pathColor);
    markup += drawEndPoint();
    patternEl.innerHTML = markup;
}

// --- CORE MAZE HELPER FUNCTIONS ---
function refreshState() { mainPathPoints = mainPathStartPoints(); gridData = buildFreshGrid(); markPointAsTaken(mainPathPoints.at(-1)); otherPaths = []; endPoint = { x: randomInt(0, gridWidth - 1), y: 0 }; }
function findNextPoint(point) { const p = []; if (gridData[point.y - 1]?.[point.x] === 0) p.push({ y: point.y - 1, x: point.x }); if (gridData[point.y + 1]?.[point.x] === 0) p.push({ y: point.y + 1, x: point.x }); if (gridData[point.y]?.[point.x - 1] === 0) p.push({ y: point.y, x: point.x - 1 }); if (gridData[point.y]?.[point.x + 1] === 0) p.push({ y: point.y, x: point.x + 1 }); return randomItemInArray(p); }
function mazeComplete() { return gridData.flat().every(cell => cell === 1); }
function addMorePaths() { gridData.forEach((row, y) => row.forEach((cell, x) => { if (cell && randomChance(splittingChance)) otherPaths.push([{ y, x }]); })); }
function markPointAsTaken(point, value = 1) { if (point.y >= 0 && point.y < gridHeight && point.x >= 0 && point.x < gridWidth) gridData[point.y][point.x] = value; }
function buildFreshGrid() { return new Array(gridHeight).fill().map(() => new Array(gridWidth).fill(0)); }
function mainPathStartPoints() { return [{ x: 0, y: gridHeight }, { x: 0, y: gridHeight - 1 }]; }
function adjustMazePoint(p) { return { x: cellSize / 2 + p.x * cellSize, y: cellSize / 2 + p.y * cellSize }; }
function buildPathData(points) { let t = points.map(adjustMazePoint); const f = t.shift(); if (!f) return ''; let c = [`M ${f.x}, ${f.y}`]; t.forEach(p => c.push(`L ${p.x}, ${p.y}`)); return c.join(' '); }
function drawLine(points, className = '', color = 'white') { const wallThickness = 4; const pathStrokeWidth = Math.max(1, cellSize - wallThickness); const style = `stroke-width: ${pathStrokeWidth}px; stroke: ${color};`; return `<path class="maze-path ${className}" d="${buildPathData([...points])}" style="${style}"/>`; }
function drawEndPoint() { if (!endPoint) return ''; const s = cellSize * 0.7, o = (cellSize - s) / 2, x = endPoint.x * cellSize + o, y = endPoint.y * cellSize + o; return `<rect class="end-point" x="${x}" y="${y}" width="${s}" height="${s}" />`; }

// --- TURTLE FUNCTIONS ---
function initializeTurtle() { if (!turtleEl) { turtleEl = document.createElement('div'); turtleEl.classList.add('turtle'); mazeWrapper.appendChild(turtleEl); } turtleEl.style.display = 'block'; const s = mainPathPoints[1]; turtle.x = s.x; turtle.y = s.y; turtle.direction = 'north'; positionTurtle(); }
function positionTurtle() { const s = svgEl.getBoundingClientRect(), m = mazeWrapper.getBoundingClientRect(), oX = s.left - m.left, oY = s.top - m.top, tX = oX + (turtle.x * cellSize) + (cellSize / 2), tY = oY + (turtle.y * cellSize) + (cellSize / 2); let r = 0; switch (turtle.direction) { case 'east': r = 90; break; case 'south': r = 180; break; case 'west': r = 270; break; } turtleEl.style.transform = `translateX(${tX}px) translateY(${tY}px) translate(-50%, -50%) rotate(${r}deg)`; }
function isPathConnected(p1, p2) { const a = [mainPathPoints, ...otherPaths]; for (const p of a) { for (let i = 0; i < p.length - 1; i++) { const c = p[i], n = p[i + 1]; if ((c.x === p1.x && c.y === p1.y && n.x === p2.x && n.y === p2.y) || (c.x === p2.x && c.y === p2.y && n.x === p1.x && n.y === p1.y)) return true; } } return false; }
function moveTurtle(direction) { let nX = turtle.x, nY = turtle.y; switch (direction) { case 'north': nY--; break; case 'east': nX++; break; case 'south': nY++; break; case 'west': nX--; break; } if (isPathConnected({ x: turtle.x, y: turtle.y }, { x: nX, y: nY })) { turtle.x = nX; turtle.y = nY; turtle.direction = direction; positionTurtle(); if (turtle.x === endPoint.x && turtle.y === endPoint.y) { setTimeout(() => { alert(`Level ${currentLevel} complete!`); completedLevels.push(currentLevel); currentLevel++; initLevel(); }, 200); } } }
document.body.addEventListener('keydown', (e) => { if (!mazeContainer.classList.contains('hidden')) { switch (e.key) { case 'ArrowUp': moveTurtle('north'); break; case 'ArrowDown': moveTurtle('south'); break; case 'ArrowLeft': moveTurtle('west'); break; case 'ArrowRight': moveTurtle('east'); break; } } });

// --- INITIALIZE THE GAME ---
initLevel();