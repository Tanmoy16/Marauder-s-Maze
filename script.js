import { randomInt, randomItemInArray, randomChance } from 'https://unpkg.com/randomness-helpers@0.0.1/dist/index.js';

// --- DOM ELEMENTS ---
const mapContainer = document.getElementById('map-container');
const videoContainer = document.getElementById('video-container');
const videoElement = document.getElementById('gate-video');
const mazeContainer = document.getElementById('maze-container');
const welcomeContainer = document.getElementById('welcome-container');
const allGates = document.querySelectorAll('.gate');

// --- MAZE GAME VARIABLES ---
const svgEl = document.querySelector('#maze-container svg');
const patternEl = document.querySelector('#maze-container .pattern');
const gridEl = document.querySelector('#maze-container .grid');
const mazeWrapper = document.getElementById('maze-wrapper');
const gridWidth = 20;
const gridHeight = 20;
const splittingChance = 0.1;
const animationSpeed = 20;
const retryLimit = 30;
let interval;
let failedCount = 0;
let mainPathPoints = [];
let otherPaths = [];
let gridData;
let turtle = { x: 0, y: 0, direction: 'north' };
let turtleEl;
let cellSize;
let endPoint = null;

// --- GAME STATE MANAGEMENT ---
let currentLevel = 1;
const totalLevels = 5;

// Initializes the game or sets up the next level
function initLevel() {
    // Hide all screens first
    mapContainer.classList.add('hidden');
    videoContainer.classList.add('hidden');
    mazeContainer.classList.add('hidden');
    welcomeContainer.classList.add('hidden');

    if (currentLevel > totalLevels) {
        // Game is over, show welcome message
        welcomeContainer.classList.remove('hidden');
    } else {
        // Show the map and highlight the active gate
        mapContainer.classList.remove('hidden');
        updateActiveGate();
    }
}

// Updates which gate has the pulsing "active" effect
function updateActiveGate() {
    allGates.forEach(gate => {
        gate.classList.remove('active');
        if (parseInt(gate.dataset.level) === currentLevel) {
            gate.classList.add('active');
        }
    });
}

// Starts the video-to-maze transition
function startMazeChallenge() {
    mapContainer.classList.add('hidden');
    videoContainer.classList.remove('hidden');
    videoElement.currentTime = 0; // Rewind video
    videoElement.play();
}

// --- EVENT LISTENERS ---

// Listen for the up arrow key only when the map is visible
document.addEventListener('keydown', (e) => {
    if (!mapContainer.classList.contains('hidden') && e.key === 'ArrowUp') {
        e.preventDefault();
        startMazeChallenge();
    }
});

// Listen for when the transition video ends
videoElement.addEventListener('ended', () => {
    videoContainer.classList.add('hidden');
    mazeContainer.classList.remove('hidden');
    // Start generating a new maze for the current level
    draw();
});

// --- ALL MAZE FUNCTIONS ---

function drawGrid() {
    let gridMarkup = '';
    for (let y = 0; y <= gridHeight; y++) {
        gridMarkup += `<line class="grid-line" x1="0" x2="${gridWidth * cellSize}" y1="${y * cellSize}" y2="${y * cellSize}"/>`;
    }
    for (let x = 0; x <= gridWidth; x++) {
        gridMarkup += `<line class="grid-line" y1="0" y2="${gridHeight * cellSize}" x1="${x * cellSize}" x2="${x * cellSize}"/>`;
    }
    return gridMarkup;
}

function buildFreshGrid() {
    return new Array(gridHeight).fill().map(() => new Array(gridWidth).fill(0));
}

function adjustMazePoint(point) {
    return {
        x: cellSize / 2 + point.x * cellSize,
        y: cellSize / 2 + point.y * cellSize
    };
}

function buildPathData(points) {
    let transformedPoints = points.map(adjustMazePoint);
    const firstPoint = transformedPoints.shift();
    if (!firstPoint) return '';
    let commands = [`M ${firstPoint.x}, ${firstPoint.y}`];
    transformedPoints.forEach(point => commands.push(`L ${point.x}, ${point.y}`));
    return commands.join(' ');
}

function drawLine(points, className = '') {
    return `<path class="maze-path ${className}" d="${buildPathData([...points])}"/>`;
}

function mainPathStartPoints() {
    return [
        { x: 0, y: gridHeight },
        { x: 0, y: gridHeight - 1 }
    ];
}

function markPointAsTaken(point, value = 1) {
    if (point.y >= 0 && point.y < gridHeight && point.x >= 0 && point.x < gridWidth) {
        gridData[point.y][point.x] = value;
    }
}

function findNextPoint(point) {
    const potentialPoints = [];
    if (gridData[point.y - 1]?.[point.x] === 0) potentialPoints.push({ y: point.y - 1, x: point.x });
    if (gridData[point.y + 1]?.[point.x] === 0) potentialPoints.push({ y: point.y + 1, x: point.x });
    if (gridData[point.y]?.[point.x - 1] === 0) potentialPoints.push({ y: point.y, x: point.x - 1 });
    if (gridData[point.y]?.[point.x + 1] === 0) potentialPoints.push({ y: point.y, x: point.x + 1 });
    return potentialPoints.length === 0 ? undefined : randomItemInArray(potentialPoints);
}

function refreshState() {
    mainPathPoints = mainPathStartPoints();
    gridData = buildFreshGrid();
    markPointAsTaken(mainPathPoints.at(-1));
    otherPaths = [];
    failedCount = 0;
    endPoint = { x: randomInt(0, gridWidth - 1), y: 0 };
}

function drawEndPoint() {
    if (!endPoint) return '';
    const markerSize = cellSize * 0.7;
    const offset = (cellSize - markerSize) / 2;
    const x = endPoint.x * cellSize + offset;
    const y = endPoint.y * cellSize + offset;
    return `<rect class="end-point" x="${x}" y="${y}" width="${markerSize}" height="${markerSize}" />`;
}

function drawLines() {
    let markup = otherPaths.map(path => drawLine(path)).join('') + drawLine(mainPathPoints, 'main');
    markup += drawEndPoint();
    patternEl.innerHTML = markup;
}

function buildMainPath() {
    refreshState();
    drawLines();
    interval = setInterval(() => {
        const nextPoint = findNextPoint(mainPathPoints.at(-1));
        if (!nextPoint) {
            if (failedCount > retryLimit) {
                refreshState();
            } else {
                failedCount++;
                for (let i = 0; i < failedCount; i++) markPointAsTaken(mainPathPoints.pop(), 0);
            }
        } else {
            mainPathPoints.push(nextPoint);
            markPointAsTaken(nextPoint);
            if (nextPoint.x === endPoint.x && nextPoint.y === endPoint.y) {
                clearInterval(interval);
                buildOtherPaths();
            }
        }
        drawLines();
    }, animationSpeed);
}

function addMorePaths() {
    gridData.forEach((row, y) => {
        row.forEach((cell, x) => {
            if (cell && randomChance(splittingChance)) {
                otherPaths.push([{ y, x }]);
            }
        });
    });
}

function mazeComplete() {
    return gridData.flat().every(cell => cell === 1);
}

function buildOtherPaths() {
    interval = setInterval(() => {
        addMorePaths();
        otherPaths.forEach((path) => {
            const nextPoint = findNextPoint(path.at(-1));
            if (nextPoint) {
                path.push(nextPoint);
                markPointAsTaken(nextPoint);
            }
        });
        drawLines();
        if (mazeComplete()) {
            clearInterval(interval);
            initializeTurtle();
        }
    }, animationSpeed);
}

function draw() {
    const containerWidth = mazeWrapper.clientWidth - 20;
    const containerHeight = mazeWrapper.clientHeight - 20;
    cellSize = Math.floor(Math.min(containerWidth / gridWidth, containerHeight / gridHeight));
    
    gridEl.innerHTML = drawGrid();
    const mazeWidth = gridWidth * cellSize;
    const mazeHeight = gridHeight * cellSize;
    svgEl.setAttribute('viewBox', `0 0 ${mazeWidth} ${mazeHeight}`);
    svgEl.setAttribute('width', mazeWidth);
    svgEl.setAttribute('height', mazeHeight);
    patternEl.innerHTML = '';
    if (turtleEl) {
      turtleEl.style.display = 'none';
    }
    clearInterval(interval);
    buildMainPath();
}

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

// In script.js, replace the old function with this one

function positionTurtle() {
    const svgRect = svgEl.getBoundingClientRect();
    const mazeWrapperRect = mazeWrapper.getBoundingClientRect();

    // Calculate the SVG's top-left corner relative to the maze-wrapper
    const offsetX = svgRect.left - mazeWrapperRect.left;
    const offsetY = svgRect.top - mazeWrapperRect.top;

    // Calculate the center of the turtle's target cell
    const targetX = offsetX + (turtle.x * cellSize) + (cellSize / 2);
    const targetY = offsetY + (turtle.y * cellSize) + (cellSize / 2);

    // Position the turtle's top-left corner at the cell's center
    turtleEl.style.left = `${targetX}px`;
    turtleEl.style.top = `${targetY}px`;

    // Determine rotation
    let rotation = 0;
    switch (turtle.direction) {
        case 'north': rotation = 0; break;
        case 'east': rotation = 90; break;
        case 'south': rotation = 180; break;
        case 'west': rotation = 270; break;
    }
    
    // Use CSS transform to perfectly center the turtle on the point and rotate it
    turtleEl.style.transform = `translate(-50%, -50%) rotate(${rotation}deg)`;
}

function isPathConnected(p1, p2) {
    const allPaths = [mainPathPoints, ...otherPaths];
    for (const path of allPaths) {
        for (let i = 0; i < path.length - 1; i++) {
            const currentPoint = path[i];
            const nextPoint = path[i + 1];
            if ((currentPoint.x === p1.x && currentPoint.y === p1.y && nextPoint.x === p2.x && nextPoint.y === p2.y) ||
                (currentPoint.x === p2.x && currentPoint.y === p2.y && nextPoint.x === p1.x && nextPoint.y === p1.y)) {
                return true;
            }
        }
    }
    return false;
}

// MODIFIED moveTurtle function for level progression
function moveTurtle(direction) {
    let newX = turtle.x;
    let newY = turtle.y;

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
                currentLevel++; // Advance to the next level
                initLevel();    // Go back to the map (or finish the game)
            }, 200);
        }
    }
}

// Final event listener for maze-specific keys
document.body.addEventListener('keydown', (e) => {
    // Only respond to these keys if the maze is visible
    if (!mazeContainer.classList.contains('hidden')) {
        switch (e.key) {
            case 'ArrowUp':
                moveTurtle('north');
                break;
            case 'ArrowDown':
                moveTurtle('south');
                break;
            case 'ArrowLeft':
                moveTurtle('west');
                break;
            case 'ArrowRight':
                moveTurtle('east');
                break;
            case 'r':
                draw(); // Redraw current maze
                break;
        }
    }
});

// --- INITIALIZE THE GAME ---
initLevel(); // Start the game!