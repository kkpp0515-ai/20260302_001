const diceArea = document.getElementById('diceArea');
const rollBtn = document.getElementById('rollBtn');
const diceCountInput = document.getElementById('diceCount');
const totalSumDisplay = document.getElementById('totalSum');
const resultArea = document.getElementById('resultArea');

// Mapping dice values to CSS rotations
const faceRotations = {
    1: { x: 0, y: 0 },
    2: { x: 0, y: -90 },
    3: { x: 0, y: 90 },
    4: { x: -90, y: 0 },
    5: { x: 90, y: 0 },
    6: { x: 0, y: 180 }
};

function createDice() {
    const dice = document.createElement('div');
    dice.className = 'dice';

    // Create 6 faces
    for (let i = 1; i <= 6; i++) {
        const face = document.createElement('div');
        face.className = `dice-face face-${i}`;

        // Add dots based on face number
        for (let j = 0; j < i; j++) {
            const dot = document.createElement('div');
            dot.className = 'dot';
            face.appendChild(dot);
        }
        dice.appendChild(face);
    }

    return dice;
}

function rollDice() {
    const count = parseInt(diceCountInput.value) || 1;
    const clampedCount = Math.min(Math.max(count, 1), 12);
    diceCountInput.value = clampedCount;

    // Clear previous results
    diceArea.innerHTML = '';
    resultArea.classList.remove('show');

    let totalSum = 0;
    const diceElements = [];

    // Create dice and start them with some initial chaos
    for (let i = 0; i < clampedCount; i++) {
        const diceWrap = document.createElement('div');
        diceWrap.style.perspective = '1000px';
        const dice = createDice();
        diceWrap.appendChild(dice);
        diceArea.appendChild(diceWrap);
        diceElements.push(dice);

        // Initial "thrown" animation
        const initialValue = Math.floor(Math.random() * 6) + 1;
        totalSum += initialValue;

        // Use timeout to ensure DOM is ready for transition
        setTimeout(() => {
            const rotations = faceRotations[initialValue];
            // Add extra full spins for dramatic effect
            const extraX = (Math.floor(Math.random() * 4) + 3) * 360;
            const extraY = (Math.floor(Math.random() * 4) + 3) * 360;

            dice.style.transform = `rotateX(${rotations.x + extraX}deg) rotateY(${rotations.y + extraY}deg)`;
        }, 50);
    }

    // Show result after animation finishes
    setTimeout(() => {
        totalSumDisplay.textContent = totalSum;
        resultArea.classList.add('show');
    }, 1100);
}

rollBtn.addEventListener('click', rollDice);

// Initial roll on load
window.addEventListener('load', rollDice);
