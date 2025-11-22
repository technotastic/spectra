class SpectraGame {
    constructor() {
        this.difficulty = 'medium'; // easy, medium, hard
        this.board = [];
        this.selected = new Set();
        this.score = 0;
        this.level = 1;
        this.moves = 0;
        this.combo = 0;
        this.isAnimating = false;
        this.timerInterval = null;
        this.isGameOver = false;
        this.lastClearTime = 0;

        this.initElements();
        this.loadHighScore();
        this.setupDifficulty('medium');
    }

    setupDifficulty(difficulty) {
        this.difficulty = difficulty;
        
        const difficultySettings = {
            easy: {
                cols: 5,
                rows: 5,
                colors: ['red', 'blue', 'yellow', 'green'],
                timeLeft: 45,
                maxTime: 45,
                comboTimeout: 2
            },
            medium: {
                cols: 6,
                rows: 6,
                colors: ['red', 'blue', 'yellow', 'green', 'purple', 'cyan'],
                timeLeft: 30,
                maxTime: 30,
                comboTimeout: 1
            },
            hard: {
                cols: 7,
                rows: 7,
                colors: ['red', 'blue', 'yellow', 'green', 'purple', 'cyan', 'orange'],
                timeLeft: 20,
                maxTime: 20,
                comboTimeout: 0.5
            }
        };

        const settings = difficultySettings[difficulty];
        this.cols = settings.cols;
        this.rows = settings.rows;
        this.colors = settings.colors;
        this.timeLeft = settings.timeLeft;
        this.maxTime = settings.maxTime;
        this.comboTimeout = settings.comboTimeout;
    }

    initElements() {
        this.boardEl = document.getElementById('gameBoard');
        this.scoreEl = document.getElementById('score');
        this.levelEl = document.getElementById('level');
        this.comboEl = document.getElementById('comboDisplay');
        this.highScoreEl = document.getElementById('highScore');
        this.restartBtn = document.getElementById('restartBtn');
        this.timerEl = document.getElementById('timer');
        this.restartBtn.addEventListener('click', () => this.init());
        
        // Handle clicks anywhere on board, including gaps
        this.boardEl.addEventListener('click', (e) => {
            if (e.target.classList.contains('tile')) {
                const key = e.target.dataset.key;
                const [row, col] = key.split(',').map(Number);
                this.onTileClick(row, col);
            } else if (e.target === this.boardEl) {
                // Click on gap - find nearest tile
                const rect = this.boardEl.getBoundingClientRect();
                const x = e.clientX - rect.left;
                const y = e.clientY - rect.top;
                
                const tileSize = 50;
                const gap = 3;
                const col = Math.floor(x / (tileSize + gap));
                const row = Math.floor(y / (tileSize + gap));
                
                if (row >= 0 && row < this.rows && col >= 0 && col < this.cols) {
                    this.onTileClick(row, col);
                }
            }
        });
    }

    startGame(difficulty) {
        this.setupDifficulty(difficulty);
        this.init();
    }

    init() {
        this.board = this.generateBoard();
        this.selected.clear();
        this.score = 0;
        this.level = 1;
        this.moves = 0;
        this.combo = 0;
        this.isAnimating = false;
        this.timeLeft = this.maxTime;
        this.isGameOver = false;
        this.lastClearTime = Date.now();
        
        if (this.timerInterval) clearInterval(this.timerInterval);
        this.startTimer();
        
        this.render();
        this.updateUI();
    }

    startTimer() {
        this.timerInterval = setInterval(() => {
            if (!this.isGameOver) {
                this.timeLeft--;
                
                // Check if combo should timeout
                const timeSinceLastClear = (Date.now() - this.lastClearTime) / 1000;
                if (timeSinceLastClear > this.comboTimeout) {
                    this.combo = 0;
                }
                
                this.updateUI();
                
                if (this.timeLeft <= 0) {
                    this.endGame();
                }
            }
        }, 1000);
    }

    generateBoard() {
        let board;
        let attempts = 0;
        
        do {
            board = [];
            for (let r = 0; r < this.rows; r++) {
                board[r] = [];
                for (let c = 0; c < this.cols; c++) {
                    let color;
                    
                    // All difficulties use full color range (evenly distributed)
                    color = this.colors[Math.floor(Math.random() * this.colors.length)];
                    
                    // Avoid 3-in-a-row on generation
                    let attempts2 = 0;
                    while (this.checkInitialMatch(board, r, c, color) && attempts2 < 10) {
                        color = this.colors[Math.floor(Math.random() * this.colors.length)];
                        attempts2++;
                    }
                    board[r][c] = color;
                }
            }
            
            // Temporarily set board to check for valid moves
            this.board = board;
            attempts++;
        } while (!this.hasValidMoves() && attempts < 50);
        
        return board;
    }

    checkInitialMatch(board, row, col, color) {
        // Check horizontal
        if (col >= 2 && board[row][col-1] === color && board[row][col-2] === color) return true;
        // Check vertical
        if (row >= 2 && board[row-1][col] === color && board[row-2][col] === color) return true;
        return false;
    }

    getConnected(row, col, color = null) {
        const color_ = color || this.board[row][col];
        const visited = new Set();
        const queue = [[row, col]];
        visited.add(`${row},${col}`);

        while (queue.length > 0) {
            const [r, c] = queue.shift();
            const neighbors = [[r-1, c], [r+1, c], [r, c-1], [r, c+1]];

            for (const [nr, nc] of neighbors) {
                if (nr >= 0 && nr < this.rows && nc >= 0 && nc < this.cols) {
                    const key = `${nr},${nc}`;
                    if (!visited.has(key) && this.board[nr][nc] === color_) {
                        visited.add(key);
                        queue.push([nr, nc]);
                    }
                }
            }
        }

        return visited;
    }

    onTileClick(row, col) {
        if (this.isAnimating || this.isGameOver) return;

        const key = `${row},${col}`;
        const color = this.board[row][col];

        // Start new selection
        const connected = this.getConnected(row, col);
        if (connected.size >= 3) {
            this.selected = connected;
            this.render();
            // Auto-clear after brief delay for visual feedback
            setTimeout(() => this.clearSelected(), 150);
        }
    }

    clearSelected() {
        if (this.selected.size < 3) {
            this.selected.clear();
            return false;
        }

        this.isAnimating = true;
        const multiplier = Math.min(1 + this.combo * 0.2, 3);
        const baseScore = this.selected.size * 10;
        const points = Math.floor(baseScore * multiplier);

        this.score += points;
        
        // Add combo bonus points (100 per combo level)
        if (this.combo > 0) {
            const comboBonus = this.combo * 100;
            this.score += comboBonus;
        }
        
        this.combo++;
        this.moves++;

        // Clear selected tiles
        const clearPromise = new Promise(resolve => {
            this.selected.forEach(key => {
                const tileEl = document.querySelector(`[data-key="${key}"]`);
                if (tileEl) {
                    tileEl.classList.add('clearing');
                }
            });

            setTimeout(() => {
                this.selected.forEach(key => {
                    const [row, col] = key.split(',').map(Number);
                    this.board[row][col] = null;
                });
                this.selected.clear();
                this.dropTiles();
                resolve();
            }, 250);
        });

        clearPromise.then(() => {
            this.isAnimating = false;
            this.updateLevel();
            
            // Track time of last clear for combo timeout
            this.lastClearTime = Date.now();
            
            // Check if there are valid moves left
            if (!this.hasValidMoves()) {
                this.shuffleBoard();
            }
            
            this.render();
        });

        return true;
    }

    dropTiles() {
        for (let c = 0; c < this.cols; c++) {
            const column = [];
            for (let r = 0; r < this.rows; r++) {
                if (this.board[r][c] !== null) {
                    column.push(this.board[r][c]);
                }
            }
            for (let r = 0; r < this.rows; r++) {
                this.board[r][c] = column[r] || null;
            }
        }

        // Add new tiles from top
        for (let c = 0; c < this.cols; c++) {
            for (let r = 0; r < this.rows; r++) {
                if (this.board[r][c] === null) {
                    this.board[r][c] = this.colors[Math.floor(Math.random() * this.colors.length)];
                }
            }
        }

        this.render();
    }



    hasValidMoves() {
        for (let r = 0; r < this.rows; r++) {
            for (let c = 0; c < this.cols; c++) {
                if (this.board[r][c]) {
                    const connected = this.getConnected(r, c);
                    if (connected.size >= 3) {
                        return true;
                    }
                }
            }
        }
        return false;
    }

    shuffleBoard() {
        // Keep shuffling until we have valid moves available
        let attempts = 0;
        do {
            // Collect all tiles
            const tiles = [];
            for (let r = 0; r < this.rows; r++) {
                for (let c = 0; c < this.cols; c++) {
                    if (this.board[r][c]) {
                        tiles.push(this.board[r][c]);
                    }
                }
            }

            // Shuffle array
            for (let i = tiles.length - 1; i > 0; i--) {
                const j = Math.floor(Math.random() * (i + 1));
                [tiles[i], tiles[j]] = [tiles[j], tiles[i]];
            }

            // Redistribute back to board
            let idx = 0;
            for (let r = 0; r < this.rows; r++) {
                for (let c = 0; c < this.cols; c++) {
                    this.board[r][c] = tiles[idx] || this.colors[Math.floor(Math.random() * this.colors.length)];
                    idx++;
                }
            }

            attempts++;
        } while (!this.hasValidMoves() && attempts < 100);

        // If still no valid moves after 100 attempts, regenerate entire board
        if (!this.hasValidMoves()) {
            this.board = this.generateBoard();
        }
    }

    endGame() {
        this.isGameOver = true;
        if (this.timerInterval) clearInterval(this.timerInterval);
        this.saveHighScore();
        
        this.boardEl.style.position = 'relative';
        this.boardEl.innerHTML = `
            <div style="position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); display: flex; flex-direction: column; gap: 20px; align-items: center; justify-content: center; background: rgba(0,0,0,0.9); padding: 40px; border: 2px solid #ff0033; border-radius: 5px; z-index: 100; text-align: center;">
                <div style="font-size: 2em; color: #ff0033; text-shadow: 0 0 20px #ff0033; font-weight: bold;">TIME'S UP!</div>
                <div style="color: #0ff; font-size: 1.2em;">Game Over</div>
                <div style="color: #ffff00; font-size: 1.8em; font-weight: bold;">Score: ${this.score.toString().padStart(6, '0')}</div>
            </div>
        `;
        this.restartBtn.textContent = 'PLAY AGAIN';
    }

    updateLevel() {
        const newLevel = Math.floor(this.moves / 5) + 1;
        if (newLevel !== this.level) {
            this.level = newLevel;
            // Increase difficulty - shuffle some tiles
            if (Math.random() < 0.3) {
                const randomRow = Math.floor(Math.random() * this.rows);
                const randomCol = Math.floor(Math.random() * this.cols);
                this.board[randomRow][randomCol] = this.colors[Math.floor(Math.random() * this.colors.length)];
            }
        }
    }

    updateUI() {
        if (!this.scoreEl) return; // Guard against missing elements
        
        this.scoreEl.textContent = this.score.toString().padStart(6, '0');
        this.levelEl.textContent = this.level;
        this.highScoreEl.textContent = this.loadHighScore().toString().padStart(6, '0');
        
        // Update timer display with color change when low
        if (this.timerEl) {
            this.timerEl.textContent = this.timeLeft;
            if (this.timeLeft <= 10) {
                this.timerEl.style.color = '#ff0033';
                this.timerEl.style.textShadow = '0 0 20px #ff0033';
            } else {
                this.timerEl.style.color = '#0ff';
                this.timerEl.style.textShadow = '0 0 10px #0ff';
            }
        }
        
        if (this.combo > 1) {
            this.comboEl.textContent = `${this.combo}x COMBO!`;
            this.comboEl.style.color = '#ffff00';
        } else {
            this.comboEl.textContent = '';
        }
    }

    render() {
        this.boardEl.innerHTML = '';
        this.boardEl.style.gridTemplateColumns = `repeat(${this.cols}, 50px)`;
        this.boardEl.style.gridTemplateRows = `repeat(${this.rows}, 50px)`;
        
        for (let r = 0; r < this.rows; r++) {
            for (let c = 0; c < this.cols; c++) {
                const color = this.board[r][c];
                const tile = document.createElement('div');
                const key = `${r},${c}`;
                tile.className = 'tile ' + (color || 'empty');
                tile.dataset.key = key;
                
                if (color) {
                    tile.textContent = '■';
                }

                if (this.selected.has(key)) {
                    tile.classList.add('selected');
                }

                tile.addEventListener('click', () => this.onTileClick(r, c));
                this.boardEl.appendChild(tile);
            }
        }
        this.updateUI();
    }

    loadHighScore() {
        const key = `spectra-highscore-${this.difficulty}`;
        const high = localStorage.getItem(key) || '0';
        return Math.max(parseInt(high), this.score);
    }

    saveHighScore() {
        const key = `spectra-highscore-${this.difficulty}`;
        const high = localStorage.getItem(key) || '0';
        if (this.score > parseInt(high)) {
            localStorage.setItem(key, this.score.toString());
        }
    }
}

// Initialize game
let game;
window.addEventListener('DOMContentLoaded', () => {
    game = new SpectraGame();
    
    const difficultyMenu = document.getElementById('difficultyMenu');
    const gameContainer = document.querySelector('.game-container');
    const difficultyBtns = document.querySelectorAll('.difficulty-btn');
    
    // Difficulty selection
    difficultyBtns.forEach(btn => {
        btn.addEventListener('click', (e) => {
            const difficulty = e.target.dataset.difficulty;
            difficultyMenu.style.display = 'none';
            gameContainer.style.display = 'flex';
            game.startGame(difficulty);
        });
    });
    
    // Restart button
    const restartBtn = document.getElementById('restartBtn');
    restartBtn.addEventListener('click', () => {
        difficultyMenu.style.display = 'flex';
        gameContainer.style.display = 'none';
    });
    
    // Disable right-click context menu
    document.addEventListener('contextmenu', (e) => e.preventDefault());
    
    // Show combo on enter key
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            game.clearSelected();
        }
    });
});
