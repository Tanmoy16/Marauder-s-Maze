import { randomInt, randomItemInArray, randomChance } from 'https://unpkg.com/randomness-helpers@0.0.1/dist/index.js';

const svgEl = document.querySelector('svg');
const patternEl = document.querySelector('.pattern');
const gridEl = document.querySelector('.grid');
const mazeWrapper = document.getElementById('maze-wrapper');

const gridWidth =20;
const gridHeight = 20;
const splittingChance = 0.1;
const animationSpeed = 20;
const retryLimit = 30;
let interval;
let failedCount = 0;
let mainPathPoints = [];
let otherPaths = [];
let gridData = buildFreshGrid();
let turtle = { x: 0, y: 0, direction: 'north' };
let turtleEl;
let cellSize;

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
    points = points.map(adjustMazePoint);
    const firstPoint = points.shift();
    let commands = [`M ${firstPoint.x}, ${firstPoint.y}`];
    points.forEach(point => commands.push(`L ${point.x}, ${point.y}`));
    return commands.join(' ');
}

function drawLine(points, className = '') {
    return `<path class="maze-path ${className}" d="${buildPathData(points)}"/>`;
}

function mainPathStartPoints() {
    return [
        {
            x: 0, 
            y: gridHeight
        },
        {
            x: 0, 
            y: gridHeight - 1
        }
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
}

function drawLines() {
    let markup = otherPaths.map(drawLine).join('') + drawLine(mainPathPoints, 'main');
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
            if (nextPoint.y === 0) {
                mainPathPoints.push({ x: nextPoint.x, y: -1 });
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
    clearInterval(interval);
    buildMainPath();
}

function initializeTurtle() {
    if (!turtleEl) {
        turtleEl = document.createElement('div');
        turtleEl.classList.add('turtle');
        mazeWrapper.appendChild(turtleEl);
    }
    const startPoint = mainPathPoints[1];
    turtle.x = startPoint.x;
    turtle.y = startPoint.y;
    turtle.direction = 'north';
    positionTurtle();
}

function positionTurtle() {
    // Get the exact position and dimensions of the SVG element
    const svgRect = svgEl.getBoundingClientRect();
    const mazeWrapperRect = mazeWrapper.getBoundingClientRect();

    // Calculate the offset of the SVG from the top-left of the wrapper
    const offsetX = svgRect.left - mazeWrapperRect.left;
    const offsetY = svgRect.top - mazeWrapperRect.top;

    // Position the turtle relative to the maze, plus the offset
    const top = offsetY + (turtle.y * cellSize) + (cellSize / 2) - 12.5;
    const left = offsetX + (turtle.x * cellSize) + (cellSize / 2) - 12.5;

    turtleEl.style.left = `${left}px`;
    turtleEl.style.top = `${top}px`;

    let rotation = 0;
    switch (turtle.direction) {
        case 'north': rotation = 0; break;
        case 'east': rotation = 90; break;
        case 'south': rotation = 180; break;
        case 'west': rotation = 270; break;
    }
    turtleEl.style.transform = `rotate(${rotation}deg)`;
}

function moveTurtle(direction) {
    let newX = turtle.x;
    let newY = turtle.y;

    switch (direction) {
        case 'north': newY--; break;
        case 'east': newX++; break;
        case 'south': newY++; break;
        case 'west': newX--; break;
    }
    
    if (newX >= 0 && newX < gridWidth && newY >= 0 && newY < gridHeight) {
        if (gridData[newY][newX] === 1) {
            turtle.x = newX;
            turtle.y = newY;
            turtle.direction = direction;
            positionTurtle();
        }
    } else if (newY < 0 && turtle.y === 0) {
        alert("🎉 Congratulations! You've solved the maze!");
    }
}

document.body.addEventListener('keydown', (e) => {
    e.preventDefault(); 
    
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
            draw();
            break;
    }
});

draw();