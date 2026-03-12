/**
 * NEON TETRIS - Core Game Logic
 */

const canvas = document.getElementById('gameBoard');
const ctx = canvas.getContext('2d');
const nextCanvas = document.getElementById('nextPieceCanvas');
const nextCtx = nextCanvas.getContext('2d');

// Constants
const ROWS = 20;
const COLS = 10;
const BLOCK_SIZE = 30;
const NEXT_BLOCK_SIZE = 25;

canvas.width = COLS * BLOCK_SIZE;
canvas.height = ROWS * BLOCK_SIZE;
nextCanvas.width = 4 * NEXT_BLOCK_SIZE;
nextCanvas.height = 4 * NEXT_BLOCK_SIZE;

const COLORS = {
    'I': '#00f2ff',
    'J': '#0070ff',
    'L': '#ff9d00',
    'O': '#fbff00',
    'S': '#00ff66',
    'T': '#cc00ff',
    'Z': '#ff0066'
};

const PIECES = {
    'I': [[0,0,0,0], [1,1,1,1], [0,0,0,0], [0,0,0,0]],
    'J': [[1,0,0], [1,1,1], [0,0,0]],
    'L': [[0,0,1], [1,1,1], [0,0,0]],
    'O': [[1,1], [1,1]],
    'S': [[0,1,1], [1,1,0], [0,0,0]],
    'T': [[0,1,0], [1,1,1], [0,0,0]],
    'Z': [[1,1,0], [0,1,1], [0,0,0]]
};

// Game State
let board = Array.from({ length: ROWS }, () => Array(COLS).fill(0));
let score = 0;
let lines = 0;
let level = 1;
let gameOver = false;
let paused = false;
let dropCounter = 0;
let dropInterval = 1000; // ms
let lastTime = 0;

let player = {
    pos: { x: 0, y: 0 },
    matrix: null,
    type: null,
    next: null
};

// Initialize
function init() {
    resetPlayer();
    updateScore();
    requestAnimationFrame(update);
}

function resetPlayer() {
    const types = 'IJLOSTZ';
    if (!player.next) {
        player.next = types[Math.floor(Math.random() * types.length)];
    }
    
    player.type = player.next;
    player.matrix = PIECES[player.type];
    player.pos.y = 0;
    player.pos.x = Math.floor(COLS / 2) - Math.floor(player.matrix[0].length / 2);
    
    player.next = types[Math.floor(Math.random() * types.length)];
    drawNextPiece();

    if (collide(board, player)) {
        board.forEach(row => row.fill(0));
        score = 0;
        lines = 0;
        level = 1;
        dropInterval = 1000;
        updateScore();
        showGameOver();
    }
}

function drawNextPiece() {
    nextCtx.clearRect(0, 0, nextCanvas.width, nextCanvas.height);
    const matrix = PIECES[player.next];
    const color = COLORS[player.next];
    
    // Center the piece in the small canvas
    const offsetX = (4 - matrix[0].length) / 2;
    const offsetY = (4 - matrix.length) / 2;

    matrix.forEach((row, y) => {
        row.forEach((value, x) => {
            if (value !== 0) {
                drawBlock(nextCtx, x + offsetX, y + offsetY, color, NEXT_BLOCK_SIZE);
            }
        });
    });
}

function drawBlock(context, x, y, color, size) {
    // Glow effect
    context.shadowBlur = 10;
    context.shadowColor = color;
    
    // Main block
    context.fillStyle = color;
    context.fillRect(x * size + 2, y * size + 2, size - 4, size - 4);
    
    // Top highlight
    context.fillStyle = 'rgba(255, 255, 255, 0.4)';
    context.fillRect(x * size + 2, y * size + 2, size - 4, 3);
    
    context.shadowBlur = 0;
}

function draw() {
    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Draw grid lines (subtle)
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.03)';
    ctx.lineWidth = 1;
    for(let i = 0; i <= COLS; i++) {
        ctx.beginPath();
        ctx.moveTo(i * BLOCK_SIZE, 0);
        ctx.lineTo(i * BLOCK_SIZE, canvas.height);
        ctx.stroke();
    }
    for(let i = 0; i <= ROWS; i++) {
        ctx.beginPath();
        ctx.moveTo(0, i * BLOCK_SIZE);
        ctx.lineTo(canvas.width, i * BLOCK_SIZE);
        ctx.stroke();
    }

    // Draw board
    board.forEach((row, y) => {
        row.forEach((value, x) => {
            if (value !== 0) {
                drawBlock(ctx, x, y, COLORS[value], BLOCK_SIZE);
            }
        });
    });

    // Draw ghost piece
    drawGhost();

    // Draw active player piece
    player.matrix.forEach((row, y) => {
        row.forEach((value, x) => {
            if (value !== 0) {
                drawBlock(ctx, x + player.pos.x, y + player.pos.y, COLORS[player.type], BLOCK_SIZE);
            }
        });
    });
}

function drawGhost() {
    let ghostPos = { x: player.pos.x, y: player.pos.y };
    while (!collide(board, { pos: { x: ghostPos.x, y: ghostPos.y + 1 }, matrix: player.matrix })) {
        ghostPos.y++;
    }
    
    player.matrix.forEach((row, y) => {
        row.forEach((value, x) => {
            if (value !== 0) {
                ctx.strokeStyle = COLORS[player.type];
                ctx.lineWidth = 2;
                ctx.globalAlpha = 0.3;
                ctx.strokeRect((x + ghostPos.x) * BLOCK_SIZE + 4, (y + ghostPos.y) * BLOCK_SIZE + 4, BLOCK_SIZE - 8, BLOCK_SIZE - 8);
                ctx.globalAlpha = 1.0;
            }
        });
    });
}

function collide(board, player) {
    const [m, o] = [player.matrix, player.pos];
    for (let y = 0; y < m.length; ++y) {
        for (let x = 0; x < m[y].length; ++x) {
            if (m[y][x] !== 0 &&
               (board[y + o.y] && board[y + o.y][x + o.x]) !== 0) {
                return true;
            }
        }
    }
    return false;
}

function merge(board, player) {
    player.matrix.forEach((row, y) => {
        row.forEach((value, x) => {
            if (value !== 0) {
                board[y + player.pos.y][x + player.pos.x] = player.type;
            }
        });
    });
}

function rotate(matrix, dir) {
    for (let y = 0; y < matrix.length; ++y) {
        for (let x = 0; x < y; ++x) {
            [
                matrix[x][y],
                matrix[y][x],
            ] = [
                matrix[y][x],
                matrix[x][y],
            ];
        }
    }
    if (dir > 0) {
        matrix.forEach(row => row.reverse());
    } else {
        matrix.reverse();
    }
}

function playerDrop() {
    player.pos.y++;
    if (collide(board, player)) {
        player.pos.y--;
        merge(board, player);
        resetPlayer();
        arenaSweep();
        updateScore();
    }
    dropCounter = 0;
}

function playerMove(dir) {
    player.pos.x += dir;
    if (collide(board, player)) {
        player.pos.x -= dir;
    }
}

function playerRotate(dir) {
    const pos = player.pos.x;
    let offset = 1;
    rotate(player.matrix, dir);
    while (collide(board, player)) {
        player.pos.x += offset;
        offset = -(offset + (offset > 0 ? 1 : -1));
        if (offset > player.matrix[0].length) {
            rotate(player.matrix, -dir);
            player.pos.x = pos;
            return;
        }
    }
}

function arenaSweep() {
    let rowCount = 1;
    outer: for (let y = board.length - 1; y > 0; --y) {
        for (let x = 0; x < board[y].length; ++x) {
            if (board[y][x] === 0) {
                continue outer;
            }
        }
        const row = board.splice(y, 1)[0].fill(0);
        board.unshift(row);
        ++y;

        score += rowCount * 100 * level;
        rowCount *= 2;
        lines++;
        
        if (lines % 10 === 0) {
            level++;
            dropInterval = Math.max(100, 1000 - (level - 1) * 100);
        }
    }
}

function updateScore() {
    document.getElementById('score').innerText = score.toString().padStart(6, '0');
    document.getElementById('level').innerText = level;
    document.getElementById('lines').innerText = lines;
}

function showGameOver() {
    gameOver = true;
    document.getElementById('overlay').classList.remove('hidden');
    document.getElementById('overlayText').innerText = 'GAME OVER';
}

function restartGame() {
    board.forEach(row => row.fill(0));
    score = 0;
    lines = 0;
    level = 1;
    dropInterval = 1000;
    gameOver = false;
    updateScore();
    document.getElementById('overlay').classList.add('hidden');
    resetPlayer();
}

document.getElementById('restartBtn').addEventListener('click', restartGame);

function update(time = 0) {
    if (gameOver || paused) return;
    
    const deltaTime = time - lastTime;
    lastTime = time;

    dropCounter += deltaTime;
    if (dropCounter > dropInterval) {
        playerDrop();
    }

    draw();
    requestAnimationFrame(update);
}

// Input handling
document.addEventListener('keydown', event => {
    if (gameOver) return;

    if (event.keyCode === 37) { // Left
        playerMove(-1);
    } else if (event.keyCode === 39) { // Right
        playerMove(1);
    } else if (event.keyCode === 40) { // Down
        playerDrop();
    } else if (event.keyCode === 81) { // Q (Rotate counter-clockwise)
        playerRotate(-1);
    } else if (event.keyCode === 38 || event.keyCode === 87) { // Up or W (Rotate clockwise)
        playerRotate(1);
    } else if (event.keyCode === 32) { // Space (Hard drop)
        while(!collide(board, { pos: { x: player.pos.x, y: player.pos.y + 1 }, matrix: player.matrix })) {
            player.pos.y++;
        }
        playerDrop();
    }
});

// Start game
init();
