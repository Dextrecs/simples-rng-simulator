/* ======================================================================
   SECTION 1: CORE GAME LOGIC, STATE, AND INITIAL SETUP
   ====================================================================== */

/* --- CONFIGURATION & DATA --- */
const rarities = [
    { name: "Dirt", chance: 1, color: "#4e342e", value: 1 },
    { name: "Common", chance: 1/2, color: "#9e9e9e", value: 2 },
    { name: "Uncommon", chance: 1/4, color: "#4caf50", value: 5 },
    { name: "Rare", chance: 1/8, color: "#2196f3", value: 10 },
    { name: "Epic", chance: 1/16, color: "#9c27b0", value: 25 },
    { name: "Legendary", chance: 1/32, color: "#ffeb3b", value: 50 },
    { name: "Mythic", chance: 1/64, color: "#ff9800", value: 100 },
    { name: "Divine", chance: 1/128, color: "#00bcd4", value: 250 },
    { name: "Celestial", chance: 1/256, color: "#e91e63", value: 500 },
    { name: "Galaxy", chance: 1/512, color: "#3f51b5", value: 1000 },
    { name: "Universe", chance: 1/1024, color: "#673ab7", value: 2500 },
    { name: "Multiverse", chance: 1/2048, color: "#000000", border: "2px solid white", value: 5000 },
    { name: "Time", chance: 1/4096, color: "#009688", value: 10000 },
    { name: "Space", chance: 1/8192, color: "#795548", value: 20000 },
    { name: "Reality", chance: 1/16384, color: "#f44336", value: 50000 },
    { name: "Void", chance: 1/32768, color: "#212121", value: 100000 },
    { name: "Light", chance: 1/65536, color: "#ffffff", border: "2px solid black", value: 200000 },
    { name: "Darkness", chance: 1/131072, color: "#000000", value: 500000 },
    { name: "Omnipotent", chance: 1/250000, color: "linear-gradient(45deg, red, blue)", value: 1000000 },
    { name: "Singularity", chance: 1/750000, color: "radial-gradient(circle, #8A2BE2, #000000)", value: 25000000 },
    { name: "The End", chance: 1/1000000, color: "linear-gradient(45deg, gold, silver)", value: 5000000 },
    { name: "Developer", chance: 1/2000000, color: "rainbow", value: 10000000 }
];

/* --- STATE AND CONSTANTS --- */
let state = {
    money: 0,
    inventory: {},
    luck: 1.0,
    luckLevel: 0,
    autoRollEnabled: false, 
    autoRollSpeedLevel: 0, 
    settings: {
        sfxVol: 1.0,
        particles: true,
        theme: 'light',
        customBg: ''
    }
};

let inventorySelection = [];
let selectModeActive = false;
let longPressTimer = null;
let autoRollInterval = null; 
const LONG_PRESS_DURATION = 500;
const AUTOROLL_COST = 1000;
const AUTOROLL_REFUND = 800;
const MANUAL_ROLL_COOLDOWN = 500;
let isRolling = false; 

const AUTO_SPEEDS = [2000, 1500, 1000, 750, 500];
const AUTO_SPEED_COSTS = [1500, 3000, 5000, 10000];

/* --- INITIALIZATION --- */
window.onload = () => {
    loadGame();
    setupAudio();
    setupSettings();
    setupInventoryListeners(); 
    renderInventory();
    renderAutoRollManager(); 
    updateMoney();
    applyTheme(state.settings.theme);
    if(state.settings.particles) initParticles();
    
    if (state.autoRollEnabled) {
        startAutoRoll();
    }
};

/* --- CORE GAMEPLAY (ROLLING) --- */
document.getElementById('btn-roll').addEventListener('click', rollRNG);

function rollRNG() {
    if (isRolling) return; 

    if (autoRollInterval !== null && this.id === 'btn-roll') {
        alert("Manual rolling is disabled while Auto-Roll is active.");
        return;
    }
    
    isRolling = true; 
    
    if (!state.autoRollEnabled || !autoRollInterval) { 
        playSFX('roll');
    }
    
    const roll = Math.random() * (1 / state.luck);
    let chosenItem = rarities[0];

    for (let i = rarities.length - 1; i >= 0; i--) {
        if (roll <= rarities[i].chance) {
            chosenItem = rarities[i];
            break;
        }
    }

    displayResult(chosenItem);
    
    if (!state.inventory[chosenItem.name]) state.inventory[chosenItem.name] = 0;
    state.inventory[chosenItem.name]++;
    
    if (chosenItem.value >= 1000) playSFX('legendary');

    renderInventory();
    saveGame();
    
    setTimeout(() => {
        isRolling = false;
    }, MANUAL_ROLL_COOLDOWN);
}

function displayResult(item) {
    const nameEl = document.getElementById('item-name');
    const badgeEl = document.getElementById('rarity-badge');

    nameEl.innerText = item.name;
    badgeEl.innerText = `1 in ${Math.round(1/item.chance)}`;
    
    if(item.color.includes('gradient') || item.color === 'rainbow') {
        badgeEl.style.background = item.color === 'rainbow' ? 
            'linear-gradient(to right, red, orange, yellow, green, blue, indigo, violet)' : item.color;
        nameEl.style.color = '#333'; 
    } else {
        badgeEl.style.background = item.color;
        nameEl.style.color = state.settings.theme === 'dark' ? '#fff' : '#000';
    }
    
    nameEl.style.animation = 'none';
    nameEl.offsetHeight; 
    nameEl.style.animation = 'pop 0.3s ease-out';
}

/* --- SHOP, UPGRADES, & AUTO-ROLL MANAGEMENT --- */

function calculateLuckCost() {
    return 500 + (state.luckLevel * 500); 
}

function buyUpgrade(type) {
    if (type === 'luck') {
        const cost = calculateLuckCost();
        if (state.money >= cost) {
            state.money -= cost;
            state.luck += 0.1;
            state.luckLevel++; 
            alert(`Luck increased to ${state.luck.toFixed(1)}! Next upgrade costs $${calculateLuckCost()}`);
        } else {
            alert("Not enough money!");
        }
    } else if (type === 'auto' && state.money >= AUTOROLL_COST && state.autoRollSpeedLevel === 0) {
        state.money -= AUTOROLL_COST;
        state.autoRollSpeedLevel = 1;
        startAutoRoll();
        alert("Auto-Roll Activated! Speed: 2.0s");
    } else if (type === 'speed') {
        const nextLevel = state.autoRollSpeedLevel + 1;
        if (nextLevel < AUTO_SPEEDS.length) {
            const cost = AUTO_SPEED_COSTS[state.autoRollSpeedLevel - 1];
            if (state.money >= cost) {
                state.money -= cost;
                state.autoRollSpeedLevel = nextLevel;
                if(state.autoRollEnabled) {
                    stopAutoRoll();
                    startAutoRoll();
                }
                alert(`Auto-Roll Speed Upgraded! New Speed: ${getCurrentAutoRollSpeed() / 1000}s`);
            } else {
                alert("Not enough money!");
            }
        } else {
            alert("Auto-Roll Speed is already maxed!");
        }
    } else {
        alert("Not enough money, or Auto-Roll is already purchased.");
    }
    updateMoney();
    saveGame();
    renderAutoRollManager();
}

function getCurrentAutoRollSpeed() {
    return AUTO_SPEEDS[state.autoRollSpeedLevel];
}

function startAutoRoll() {
    if (autoRollInterval === null) {
        const speed = getCurrentAutoRollSpeed(); 
        autoRollInterval = setInterval(rollRNG, speed);
        state.autoRollEnabled = true;
        document.getElementById('btn-roll').disabled = true;
        document.getElementById('btn-roll').innerHTML = 'AUTO'; 
        saveGame();
        renderAutoRollManager();
    }
}

function stopAutoRoll() {
    if (autoRollInterval !== null) {
        clearInterval(autoRollInterval);
        autoRollInterval = null;
        state.autoRollEnabled = false;
        document.getElementById('btn-roll').disabled = false;
        document.getElementById('btn-roll').innerHTML = '<i class="fas fa-dice"></i> Roll'; 
        saveGame();
        renderAutoRollManager();
    }
}

function renderAutoRollManager() {
    const container = document.getElementById('auto-roll-container');
    container.innerHTML = '';
    
    const currentSpeed = getCurrentAutoRollSpeed();
    const nextLevel = state.autoRollSpeedLevel + 1;
    const isMaxSpeed = nextLevel >= AUTO_SPEEDS.length;

    if (state.autoRollEnabled) {
        container.innerHTML = `
            <p style="color:#ffd700;">Auto-Roll Active (${currentSpeed / 1000}s interval)</p>
            <button class="btn-sell" onclick="confirmSellAutoRoll()"><i class="fas fa-undo"></i> Sell Auto-Roll ($${AUTOROLL_REFUND})</button>
        `;
    } else if (state.autoRollSpeedLevel === 0) {
        container.innerHTML = `
            <button onclick="buyUpgrade('auto')">Buy Auto-Roll ($${AUTOROLL_COST})</button>
        `;
    }
    
    if (state.autoRollSpeedLevel > 0 && !isMaxSpeed) {
        const nextSpeedCost = AUTO_SPEED_COSTS[state.autoRollSpeedLevel - 1]; 
        container.innerHTML += `<hr>
            <p>Current Speed: ${currentSpeed / 1000}s</p>
            <button onclick="buyUpgrade('speed')">Upgrade Speed to ${AUTO_SPEEDS[nextLevel] / 1000}s ($${nextSpeedCost})</button>
        `;
    } else if (isMaxSpeed && state.autoRollSpeedLevel > 0) {
        container.innerHTML += `<hr><p style="color:#00e676;">Auto-Roll Speed MAX!</p>`;
    }
}

function confirmSellAutoRoll() {
    showConfirmationModal(
        "Confirm Auto-Roll Sale",
        `Are you sure you want to sell Auto-Roll for a refund of **$${AUTOROLL_REFUND}**?`,
        executeSellAutoRoll
    );
}

function executeSellAutoRoll() {
    if (state.autoRollEnabled) {
        stopAutoRoll();
        state.money += AUTOROLL_REFUND;
        updateMoney();
        alert(`Auto-Roll sold for $${AUTOROLL_REFUND}.`);
    }
    saveGame();
    renderAutoRollManager();
}


/* --- INVENTORY & SELLING --- */

function confirmSellAllCommons() {
    const itemsToSell = ['Dirt', 'Common'];
    let count = 0;
    let value = 0;
    itemsToSell.forEach(rarity => {
        if (state.inventory[rarity]) {
            count += state.inventory[rarity];
            const itemVal = rarities.find(r => r.name === rarity).value;
            value += state.inventory[rarity] * itemVal;
        }
    });

    if (count === 0) {
        alert("You have no Dirt or Common items to sell.");
        return;
    }

    showConfirmationModal(
        "Confirm Sale",
        `Sell all **${count}** common items for **$${value}**?`,
        () => executeSellAllCommons(itemsToSell, value)
    );
}

function executeSellAllCommons(itemsToSell, value) {
    itemsToSell.forEach(rarity => {
        if (state.inventory[rarity]) {
            delete state.inventory[rarity];
        }
    });
    state.money += value;
    updateMoney();
    renderInventory();
    saveGame();
    alert(`Sold ${itemsToSell.join(' & ')} for $${value}!`);
}

function confirmSellSelected() {
    if (inventorySelection.length === 0) {
        alert("No items selected.");
        return;
    }
    
    let totalValue = 0;
    let totalCount = 0;

    inventorySelection.forEach(rarityName => {
        const count = state.inventory[rarityName];
        const rarityData = rarities.find(r => r.name === rarityName);
        totalValue += count * rarityData.value;
        totalCount += count;
    });

    showConfirmationModal(
        "Confirm Bulk Sale",
        `Sell **${totalCount}** selected items for **$${totalValue}**?`,
        () => executeSellSelected(totalValue)
    );
}

function executeSellSelected(totalValue) {
    inventorySelection.forEach(rarityName => {
        delete state.inventory[rarityName];
    });

    state.money += totalValue;
    toggleSelectMode();
    updateMoney();
    renderInventory();
    saveGame();
    alert(`Sold selected items for $${totalValue}!`);
}

function confirmSellRarity(rarityName, sellAll) {
    const rarityData = rarities.find(r => r.name === rarityName);
    const count = state.inventory[rarityName];
    
    if (!rarityData || !count) return;

    if (sellAll) {
        const value = count * rarityData.value;
        showConfirmationModal(
            `Sell All ${rarityName}`,
            `Sell all **${count}** ${rarityName} items for **$${value}**?`,
            () => executeSellRarity(rarityName, count)
        );
    } else {
        const value = rarityData.value;
        showConfirmationModal(
            `Sell 1 ${rarityName}`,
            `Sell one ${rarityName} item for **$${value}**?`,
            () => executeSellRarity(rarityName, 1)
        );
    }
    hideContextMenu();
}

function executeSellRarity(rarityName, amount) {
    if (state.inventory[rarityName] >= amount) {
        const rarityData = rarities.find(r => r.name === rarityName);
        const value = amount * rarityData.value;
        
        state.inventory[rarityName] -= amount;
        state.money += value;

        if (state.inventory[rarityName] <= 0) {
            delete state.inventory[rarityName];
        }
        
        updateMoney();
        renderInventory();
        saveGame();
        alert(`Sold ${amount} ${rarityName} for $${value}!`);
    }
}

function renderInventory() {
    const grid = document.getElementById('inventory-grid');
    grid.innerHTML = '';
    
    const sortedRarities = Object.keys(state.inventory).sort((a, b) => {
        const indexA = rarities.findIndex(r => r.name === a);
        const indexB = rarities.findIndex(r => r.name === b);
        return indexA - indexB;
    });

    sortedRarities.forEach(key => {
        const count = state.inventory[key];
        if (count <= 0) return;

        const itemData = rarities.find(r => r.name === key);
        
        const div = document.createElement('div');
        div.className = 'inv-item';
        div.dataset.rarity = key; 
        div.style.background = itemData.color;
        if(itemData.color === 'rainbow') div.style.background = 'linear-gradient(45deg, red, blue)';
        
        if (inventorySelection.includes(key)) {
            div.classList.add('selected');
        }

        div.innerHTML = `
            <span>${key.substring(0, 2)}</span>
            <div class="inv-count">${count}</div>
        `;
        
        div.addEventListener('click', (e) => {
            handleItemClick(key, div);
        });
        
        div.addEventListener('contextmenu', (e) => {
            e.preventDefault(); 
            showContextMenu(key, count, div);
        });

        div.addEventListener('touchstart', (e) => {
            if (selectModeActive) return;
            e.preventDefault();
            longPressTimer = setTimeout(() => {
                showContextMenu(key, count, div);
            }, LONG_PRESS_DURATION);
        });
        
        div.addEventListener('touchend', (e) => {
            clearTimeout(longPressTimer);
        });
        div.addEventListener('touchmove', (e) => {
            clearTimeout(longPressTimer);
        });

        grid.appendChild(div);
    });
}

/* ======================================================================
   SECTION 2: UTILITIES, UI MANAGEMENT, AND PERSISTENCE
   ====================================================================== */

/* --- UI/MODAL FUNCTIONS --- */

function updateMoney() {
    document.getElementById('money').innerText = state.money;
    const luckButton = document.querySelector('.shop-actions button[onclick="buyUpgrade(\'luck\')"]');
    if (luckButton) {
        luckButton.title = `Buy Luck Upgrade ($${calculateLuckCost()})`;
    }
}

function toggleSettings() {
    document.getElementById('settings-modal').classList.toggle('hidden');
}

function toggleCreditsModal() {
    document.getElementById('credits-modal').classList.toggle('hidden');
}

function setupInventoryListeners() {
    document.getElementById('btn-select-mode').addEventListener('click', toggleSelectMode);
    document.getElementById('btn-cancel-select').addEventListener('click', toggleSelectMode);
    document.getElementById('btn-sell-selected').addEventListener('click', confirmSellSelected);
    
    document.getElementById('context-sell-one').addEventListener('click', () => {
        const rarityName = document.getElementById('context-menu-rarity-name').dataset.rarity;
        confirmSellRarity(rarityName, false);
    });
    document.getElementById('context-sell-all').addEventListener('click', () => {
        const rarityName = document.getElementById('context-menu-rarity-name').dataset.rarity;
        confirmSellRarity(rarityName, true);
    });
}

function toggleSelectMode() {
    selectModeActive = !selectModeActive;
    inventorySelection = [];
    
    const selectBtn = document.getElementById('btn-select-mode');
    const footer = document.getElementById('selection-footer');
    
    if (selectModeActive) {
        selectBtn.innerHTML = '<i class="fas fa-times-circle"></i> Cancel';
        footer.classList.remove('hidden');
    } else {
        selectBtn.innerHTML = '<i class="fas fa-check-square"></i>';
        footer.classList.add('hidden');
    }
    updateSelectionUI();
    renderInventory(); 
}

function handleItemClick(rarityName, itemElement) {
    if (selectModeActive) {
        const index = inventorySelection.indexOf(rarityName);
        if (index > -1) {
            inventorySelection.splice(index, 1);
            itemElement.classList.remove('selected');
        } else {
            inventorySelection.push(rarityName);
            itemElement.classList.add('selected');
        }
        updateSelectionUI();
    }
}

function updateSelectionUI() {
    document.getElementById('selected-count').innerText = inventorySelection.length;
}

function showContextMenu(rarityName, count, itemElement) {
    if (selectModeActive) return; 
    
    const rarityData = rarities.find(r => r.name === rarityName);
    
    const nameEl = document.getElementById('context-menu-rarity-name');
    nameEl.innerText = rarityName;
    nameEl.dataset.rarity = rarityName; 
    
    document.getElementById('context-menu-count').innerText = count;
    document.getElementById('context-menu-value').innerText = '$' + rarityData.value;
    
    const sellOneBtn = document.getElementById('context-sell-one');
    sellOneBtn.disabled = count <= 0;
    
    document.getElementById('context-menu-modal').classList.remove('hidden');
}

function hideContextMenu() {
    document.getElementById('context-menu-modal').classList.add('hidden');
}

let currentConfirmationCallback = null;

function showConfirmationModal(title, message, callback) {
    document.getElementById('confirmation-title').innerText = title;
    document.getElementById('confirmation-message').innerHTML = message;
    
    currentConfirmationCallback = callback;
    
    const modal = document.getElementById('confirmation-modal');
    modal.classList.remove('hidden');
    
    document.getElementById('btn-confirm-yes').onclick = () => {
        if (currentConfirmationCallback) currentConfirmationCallback();
        modal.classList.add('hidden');
        currentConfirmationCallback = null;
    };
    
    document.getElementById('btn-confirm-no').onclick = () => {
        modal.classList.add('hidden');
        currentConfirmationCallback = null;
    };
}


/* --- SETTINGS, AUDIO, THEME --- */

function setupAudio() {
    const sfxRoll = document.getElementById('sfx-roll');
    const sfxLeg = document.getElementById('sfx-legendary');
    
    if (sfxRoll) sfxRoll.volume = state.settings.sfxVol;
    if (sfxLeg) sfxLeg.volume = state.settings.sfxVol;
    
    document.getElementById('vol-sfx').value = state.settings.sfxVol * 100;
}

function playSFX(type) {
    const id = type === 'roll' ? 'sfx-roll' : 'sfx-legendary';
    const audio = document.getElementById(id);
    if(audio) {
        audio.currentTime = 0;
        audio.play();
    }
}

function setupSettings() {
    document.getElementById('vol-sfx').addEventListener('input', (e) => {
        const val = e.target.value / 100;
        state.settings.sfxVol = val;
        const sfxRoll = document.getElementById('sfx-roll');
        const sfxLeg = document.getElementById('sfx-legendary');
        if (sfxRoll) sfxRoll.volume = val;
        if (sfxLeg) sfxLeg.volume = val;
        saveGame();
    });

    document.getElementById('theme-select').addEventListener('change', (e) => {
        const val = e.target.value;
        state.settings.theme = val;
        if(val === 'custom') {
            document.getElementById('custom-theme-input').classList.remove('hidden');
        } else {
            document.getElementById('custom-theme-input').classList.add('hidden');
            applyTheme(val);
        }
        saveGame();
    });
    
    document.getElementById('theme-select').value = state.settings.theme;
}

function applyCustomTheme() {
    const url = document.getElementById('custom-bg-url').value;
    state.settings.customBg = url;
    applyTheme('custom');
    saveGame();
}

function applyTheme(themeName) {
    document.body.className = ''; 
    document.body.style.backgroundImage = 'none';
    
    if (themeName === 'dark') document.body.classList.add('dark-mode');
    else if (themeName === 'light') { /* Default */ }
    else if (themeName === 'custom' && state.settings.customBg) {
        document.body.classList.add('dark-mode'); 
        document.body.style.backgroundImage = `url('${state.settings.customBg}')`;
    }
}

function initParticles() {
    const canvas = document.getElementById('particleCanvas');
    const ctx = canvas.getContext('2d');
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    let particlesArray = [];
    
    class Particle {
        constructor() {
            this.x = Math.random() * canvas.width;
            this.y = Math.random() * canvas.height;
            this.size = Math.random() * 3 + 1;
            this.speedX = Math.random() * 1 - 0.5;
            this.speedY = Math.random() * 1 - 0.5;
        }
        update() {
            this.x += this.speedX;
            this.y += this.speedY;
            if (this.size > 0.2) this.size -= 0.01; 
            if (this.size <= 0.2) {
                this.x = Math.random() * canvas.width;
                this.y = Math.random() * canvas.height;
                this.size = Math.random() * 3 + 1;
            }
        }
        draw() {
            ctx.fillStyle = state.settings.theme === 'light' ? 'rgba(0,0,0,0.1)' : 'rgba(255,255,255,0.1)';
            ctx.beginPath();
            ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
            ctx.fill();
        }
    }

    function init() {
        for (let i = 0; i < 50; i++) particlesArray.push(new Particle());
    }

    function animate() {
        if(!state.settings.particles) {
            ctx.clearRect(0,0, canvas.width, canvas.height);
            return; 
        }
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        for (let i = 0; i < particlesArray.length; i++) {
            particlesArray[i].update();
            particlesArray[i].draw();
        }
        requestAnimationFrame(animate);
    }
    init();
    animate();
    
    window.addEventListener('resize', () => {
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
    });
}

document.getElementById('toggle-particles').addEventListener('click', () => {
    state.settings.particles = !state.settings.particles;
    document.getElementById('toggle-particles').innerText = state.settings.particles ? "ON" : "OFF";
    if(state.settings.particles) initParticles();
    saveGame();
});


/* --- PERSISTENCE --- */

function saveGame() {
    localStorage.setItem('rngProjectSave', JSON.stringify(state));
}

function loadGame() {
    const saved = localStorage.getItem('rngProjectSave');
    if (saved) {
        const parsed = JSON.parse(saved);
        state = { 
            ...state, 
            ...parsed, 
            settings: { 
                ...state.settings, 
                ...parsed.settings 
            },
            luckLevel: parsed.luckLevel || 0,
            autoRollSpeedLevel: parsed.autoRollSpeedLevel || 0
        };
    }
}
