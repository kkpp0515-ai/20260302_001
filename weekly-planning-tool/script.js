// Default data structure matching the user's setup
const defaultData = [
    {
        language: '繁体字',
        titles: [
            { name: 'arifure', members: ['安部田', '林'] },
            { name: 'shinchan', members: ['伊藤', '洪', '松本'] },
            { name: 'dragon', members: ['安部田', '林'] },
            { name: 'kakegurui', members: ['林', '洪', '興野'] },
            { name: 'isesuma', members: ['林', '洪'] }
        ]
    },
    {
        language: '韓国語',
        titles: [
            { name: 'arifure', members: ['孫'] },
            { name: 'shinchan', members: ['ユン'] },
            { name: 'kakegurui', members: ['孫'] },
            { name: 'isesuma', members: ['金'] }
        ]
    },
    {
        language: '日本語',
        titles: [
            { name: 'arifure', members: ['安部田', '大友', '松本'] },
            { name: 'kakegurui', members: ['興野', '大友'] },
            { name: 'dragon', members: ['安部田', '松本'] },
            { name: 'shinchan', members: ['伊藤'] },
            { name: 'highschool', members: ['興野'] },
            { name: 'isesuma', members: ['伊藤'] }
        ]
    }
];

// Application state
let state = {};

// Initialize state with default data or fetch from localStorage
function initState() {
    const saved = localStorage.getItem('weeklyPlanningToolState');
    if (saved) {
        try {
            state = JSON.parse(saved);
            return;
        } catch (e) {
            console.error('Failed to parse saved state:', e);
        }
    }
    
    // Create new state based on default structure
    defaultData.forEach(langGroup => {
        state[langGroup.language] = {
            titles: {}
        };
        langGroup.titles.forEach(t => {
            const titleState = {
                total: 0,
                members: {}
            };
            t.members.forEach(m => titleState.members[m] = 0);
            state[langGroup.language].titles[t.name] = titleState;
        });
    });
}

function saveState() {
    localStorage.setItem('weeklyPlanningToolState', JSON.stringify(state));
    render();
}

function distributeToMembers(total, membersArray, lang, titleName) {
    const titleState = state[lang].titles[titleName];
    if (!membersArray || membersArray.length === 0 || isNaN(total)) return;

    if (total <= 0) {
        membersArray.forEach(m => titleState.members[m] = 0);
        return;
    }

    // Auto calculate even distribution
    const baseAmount = Math.floor(total / membersArray.length);
    let remainder = total % membersArray.length;

    membersArray.forEach((m, idx) => {
        let amount = baseAmount;
        // Distribute remainder to first N members
        if (idx < remainder) {
            amount += 1;
        }
        titleState.members[m] = amount;
    });
}

// When a member input changes, update the total count of the title automatically
function updateTitleTotal(lang, titleName) {
    const titleState = state[lang].titles[titleName];
    let sum = 0;
    Object.values(titleState.members).forEach(val => sum += parseInt(val) || 0);
    titleState.total = sum;
}

function render() {
    const tbody = document.getElementById('table-body');
    tbody.innerHTML = '';
    let grandTotal = 0;

    defaultData.forEach(langGroup => {
        const lang = langGroup.language;
        let subtotal = 0;

        langGroup.titles.forEach((t, index) => {
            const tr = document.createElement('tr');
            
            // 1. Language column (Rowspan for first item)
            if (index === 0) {
                const tdLang = document.createElement('td');
                tdLang.rowSpan = langGroup.titles.length + 1; // +1 for the subtotal row
                tdLang.className = 'lang-cell';
                tdLang.textContent = lang;
                tr.appendChild(tdLang);
            }

            // 2. Title column
            const tdTitle = document.createElement('td');
            tdTitle.textContent = t.name;
            tr.appendChild(tdTitle);

            // 3. Total input column
            const tdTotal = document.createElement('td');
            const totalInput = document.createElement('input');
            totalInput.type = 'number';
            totalInput.min = '0';
            
            const currentTotal = state[lang].titles[t.name].total;
            totalInput.value = currentTotal > 0 ? currentTotal : '';
            subtotal += currentTotal;
            grandTotal += currentTotal;

            totalInput.addEventListener('change', (e) => {
                let val = parseInt(e.target.value) || 0;
                if (val < 0) val = 0;
                state[lang].titles[t.name].total = val;
                distributeToMembers(val, t.members, lang, t.name);
                saveState();
            });

            tdTotal.appendChild(totalInput);
            tr.appendChild(tdTotal);

            // 4. Members allocation column
            const tdMembers = document.createElement('td');
            const membersContainer = document.createElement('div');
            membersContainer.className = 'members-container';
            
            t.members.forEach(member => {
                const memberDiv = document.createElement('div');
                memberDiv.className = 'member-item';
                
                const label = document.createElement('label');
                label.textContent = member;

                const mInput = document.createElement('input');
                mInput.type = 'number';
                mInput.min = '0';
                
                const mValue = state[lang].titles[t.name].members[member];
                mInput.value = mValue > 0 ? mValue : '';

                mInput.addEventListener('change', (e) => {
                    let val = parseInt(e.target.value) || 0;
                    if (val < 0) val = 0;
                    state[lang].titles[t.name].members[member] = val;
                    updateTitleTotal(lang, t.name);
                    saveState();
                });

                memberDiv.appendChild(label);
                memberDiv.appendChild(mInput);
                membersContainer.appendChild(memberDiv);
            });
            
            tdMembers.appendChild(membersContainer);
            tr.appendChild(tdMembers);

            tbody.appendChild(tr);
        });

        // 5. Subtotal row (colspan=2 because lang is already rowspanned)
        const trSub = document.createElement('tr');
        trSub.className = 'subtotal-row';
        
        const tdSubLabel = document.createElement('td');
        tdSubLabel.textContent = `${lang}合計`;
        trSub.appendChild(tdSubLabel);
        
        const tdSubTotal = document.createElement('td');
        tdSubTotal.className = 'number-cell';
        tdSubTotal.textContent = subtotal;
        trSub.appendChild(tdSubTotal);
        
        const tdSubEmpty = document.createElement('td');
        trSub.appendChild(tdSubEmpty);

        tbody.appendChild(trSub);
    });

    document.getElementById('grand-total-count').textContent = grandTotal;
}

document.addEventListener('DOMContentLoaded', () => {
    initState();
    render();

    // Reset button
    document.getElementById('reset-btn').addEventListener('click', () => {
        if(confirm('全ての割り振りデータをリセットしますか？')) {
            localStorage.removeItem('weeklyPlanningToolState');
            initState();
            render();
        }
    });

    // Copy to clipboard button
    document.getElementById('copy-btn').addEventListener('click', () => {
        let textToCopy = '';
        
        defaultData.forEach(langGroup => {
            const lang = langGroup.language;
            let subtotal = 0;
            let hasContent = false;
            let groupText = `【${lang}】\n`;
            
            langGroup.titles.forEach(t => {
                const total = state[lang].titles[t.name].total;
                subtotal += total;
                if(total > 0) {
                    hasContent = true;
                    groupText += `・${t.name} (${total}本)\n  担当: `;
                    
                    const assignees = [];
                    t.members.forEach(m => {
                        const mVal = state[lang].titles[t.name].members[m];
                        if (mVal > 0) {
                            assignees.push(`${m}：${mVal}`);
                        }
                    });
                    groupText += assignees.join(' / ') + '\n';
                }
            });
            
            if (hasContent) {
                groupText += `-> ${lang}合計: ${subtotal}本\n\n`;
                textToCopy += groupText;
            }
        });
        
        const grandTotal = document.getElementById('grand-total-count').textContent;
        textToCopy += `======================\n合計: ${grandTotal}本\n`;

        // If no data inputted
        if (grandTotal === "0") {
            alert("コピーするデータがありません。数値を入力してください。");
            return;
        }

        navigator.clipboard.writeText(textToCopy).then(() => {
            alert('クリップボードにコピーしました！そのままSlack等に貼り付け可能です。');
        }).catch(err => {
            console.error('Copy failed', err);
            prompt('以下のテキストをコピーしてください:', textToCopy);
        });
    });
});
