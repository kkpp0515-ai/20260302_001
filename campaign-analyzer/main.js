/**
 * Campaign Priority Optimizer - Core Logic
 */

document.addEventListener('DOMContentLoaded', () => {
    // DOM Elements
    const dropZone = document.getElementById('drop-zone');
    const fileInput = document.getElementById('csv-file');
    const browseBtn = document.getElementById('browse-btn');
    const fileInfo = document.getElementById('file-info');
    const fileNameDisplay = document.getElementById('filename-display');
    const processBtn = document.getElementById('process-btn');
    const dashboard = document.getElementById('dashboard');
    const uploadSection = document.getElementById('upload-section');
    const resultsBody = document.getElementById('results-body');
    const targetRoasInput = document.getElementById('target-roas');
    const searchInput = document.getElementById('table-search');
    const resetBtn = document.getElementById('reset-btn');
    const loader = document.getElementById('loader');

    // State
    let rawData = [];
    let campaignStats = [];
    let charts = {};

    // --- Core Logic ---

    // 1. CSV Parsing with PapaParse
    function parseCSV(file) {
        showLoader();
        Papa.parse(file, {
            header: true,
            skipEmptyLines: true,
            dynamicTyping: true,
            complete: (results) => {
                hideLoader();
                if (results.data.length > 0) {
                    rawData = results.data;
                    processData();
                } else {
                    showToast('エラー: ファイルが空か、形式が正しくありません', 'error');
                }
            },
            error: (err) => {
                hideLoader();
                showToast('エラー: ' + err.message, 'error');
            }
        });
    }

    // 2. Data Aggregation by Campaign
    function processData() {
        const targetROAS = parseFloat(targetRoasInput.value) || 50;
        const campaigns = {};

        // Detect correct headers (Case insensitive and fuzzy matching)
        const findHeader = (patterns) => {
            const headers = Object.keys(rawData[0]);
            for (let p of patterns) {
                const found = headers.find(h => h.toLowerCase().includes(p.toLowerCase()));
                if (found) return found;
            }
            return null;
        };

        const costKey = findHeader(['COST', 'コスト', '費用']);
        const roasKey = findHeader(['Real_Roas', 'ROAS', '費用対効果']);
        const campaignKey = findHeader(['Campaign', 'キャンペーン']);

        if (!costKey || !roasKey || !campaignKey) {
            showToast('必須カラム (Campaign, COST, ROAS) が見つかりませんでした。', 'error');
            return;
        }

        // Aggregate by Campaign
        rawData.forEach(row => {
            // Ignore potential summary rows
            if (row[campaignKey] === '合計' || row[campaignKey] === '総計' || !row[campaignKey]) return;

            const name = row[campaignKey];
            const cost = cleanNumber(row[costKey]);
            const roas = cleanPercent(row[roasKey]);

            if (!campaigns[name]) {
                campaigns[name] = { totalCost: 0, weightedRoasSum: 0, count: 0 };
            }

            campaigns[name].totalCost += cost;
            campaigns[name].weightedRoasSum += (roas * cost);
            campaigns[name].count += 1;
        });

        // Calculate final weighted ROAS per campaign
        campaignStats = Object.keys(campaigns).map(name => {
            const data = campaigns[name];
            const avgRoas = data.totalCost > 0 ? (data.weightedRoasSum / data.totalCost) : 0;

            return {
                name,
                cost: data.totalCost,
                roas: avgRoas,
                priority: 0, // placeholder
                priorityText: '',
                action: ''
            };
        });

        // Determine priority based on Cost vs ROAS relationship
        const avgTotalCost = campaignStats.reduce((acc, c) => acc + c.cost, 0) / campaignStats.length;

        campaignStats.forEach(c => {
            const roasDiff = c.roas - targetROAS;
            const isHighCost = c.cost > avgTotalCost;

            if (roasDiff < 0) {
                // ROAS failure
                if (isHighCost) {
                    c.priority = 3;
                    c.priorityText = '最優先';
                    c.priorityClass = 'priority-high';
                    c.action = '急ぎ広告停止または入札大幅引き下げを推奨。';
                } else {
                    c.priority = 2;
                    c.priorityText = '警告';
                    c.priorityClass = 'priority-medium';
                    c.action = 'パフォーマンス低下中。クリエイティブ調整を検討。';
                }
            } else {
                // ROAS success
                if (!isHighCost) {
                    c.priority = 2.5;
                    c.priorityText = '拡大';
                    c.priorityClass = 'priority-medium';
                    c.action = '効率良好。予算拡大とスケールを推奨。';
                } else {
                    c.priority = 1;
                    c.priorityText = '維持';
                    c.priorityClass = 'priority-low';
                    c.action = '現状維持で安定。モニタリング継続。';
                }
            }
        });

        // Sort by Priority then Cost
        campaignStats.sort((a, b) => b.priority - a.priority || b.cost - a.cost);

        updateUI();
    }

    // --- UI Helper Functions ---

    function updateUI() {
        dashboard.style.display = 'block';
        uploadSection.style.display = 'none';

        // Stats
        const total = campaignStats.reduce((acc, c) => acc + c.cost, 0);
        const avgRoas = campaignStats.reduce((acc, c) => acc + (c.roas * c.cost), 0) / total;
        const urgentCount = campaignStats.filter(c => c.priority === 3).length;

        document.getElementById('total-cost').textContent = '¥' + total.toLocaleString();
        document.getElementById('avg-roas').textContent = avgRoas.toFixed(1) + '%';
        document.getElementById('urgent-count').textContent = urgentCount;

        renderTable(campaignStats);
        renderCharts(campaignStats);
    }

    function renderTable(data) {
        resultsBody.innerHTML = '';
        data.forEach(c => {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td><span class="badge ${c.priorityClass}">${c.priorityText}</span></td>
                <td><strong>${c.name}</strong></td>
                <td>¥${c.cost.toLocaleString()}</td>
                <td style="color: ${c.roas < (parseFloat(targetRoasInput.value) || 50) ? '#ff4d4d' : '#3fb950'}">${c.roas.toFixed(1)}%</td>
                <td>${(c.cost * (c.roas / 100)).toLocaleString()} pts</td>
                <td style="font-size: 0.85rem">${c.action}</td>
            `;
            resultsBody.appendChild(row);
        });
    }

    function renderCharts(data) {
        const ctxScatter = document.getElementById('scatter-chart').getContext('2d');
        const ctxPriority = document.getElementById('priority-chart').getContext('2d');

        // Clear existing charts
        if (charts.scatter) charts.scatter.destroy();
        if (charts.priority) charts.priority.destroy();

        // 1. Scatter Plot
        charts.scatter = new Chart(ctxScatter, {
            type: 'scatter',
            data: {
                datasets: [{
                    label: 'キャンペーンデータ',
                    data: data.map(c => ({ x: c.cost, y: c.roas })),
                    backgroundColor: data.map(c => c.priority === 3 ? 'rgba(248, 81, 73, 0.7)' : 'rgba(0, 129, 255, 0.7)'),
                    borderColor: '#fff',
                    borderWidth: 1,
                    pointRadius: 6,
                    pointHoverRadius: 8
                }]
            },
            options: {
                responsive: true,
                scales: {
                    x: {
                        title: { display: true, text: 'COST (¥)', color: '#8b949e' },
                        grid: { color: 'rgba(255,255,255,0.05)' },
                        ticks: { color: '#8b949e' }
                    },
                    y: {
                        title: { display: true, text: 'ROAS (%)', color: '#8b949e' },
                        grid: { color: 'rgba(255,255,255,0.05)' },
                        ticks: { color: '#8b949e' }
                    }
                },
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        callbacks: {
                            label: (ctx) => {
                                const c = data[ctx.dataIndex];
                                return `[${c.name}] Cost: ¥${c.cost.toLocaleString()} | ROAS: ${c.roas.toFixed(1)}%`;
                            }
                        }
                    }
                }
            }
        });

        // 2. Priority Distribution
        const priorities = ['最優先', '警告', '拡大', '維持'];
        const pCounts = [
            data.filter(c => c.priorityText === '最優先').length,
            data.filter(c => c.priorityText === '警告').length,
            data.filter(c => c.priorityText === '拡大').length,
            data.filter(c => c.priorityText === '維持').length,
        ];

        charts.priority = new Chart(ctxPriority, {
            type: 'doughnut',
            data: {
                labels: priorities,
                datasets: [{
                    data: pCounts,
                    backgroundColor: ['#f85149', '#d29922', '#0081ff', '#3fb950'],
                    borderWidth: 0,
                    hoverOffset: 10
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'right',
                        labels: { color: '#8b949e', boxWidth: 12, padding: 15 }
                    }
                },
                cutout: '70%'
            }
        });
    }

    // --- Utilities ---

    function cleanNumber(val) {
        if (typeof val === 'number') return val;
        if (!val) return 0;
        return parseFloat(val.toString().replace(/[^\d.+-]/g, '')) || 0;
    }

    function cleanPercent(val) {
        if (typeof val === 'number') return val * 100; // Assume 0.32 -> 32% if number
        if (!val) return 0;
        let s = val.toString().replace(/[^\d.+-]/g, '');
        return parseFloat(s) || 0;
    }

    function showLoader() { loader.style.display = 'flex'; }
    function hideLoader() { loader.style.display = 'none'; }

    function showToast(msg, type = 'info') {
        const container = document.getElementById('toast-container');
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        toast.textContent = msg;
        container.appendChild(toast);
        setTimeout(() => toast.remove(), 4000);
    }

    // --- Event Listeners ---

    browseBtn.onclick = () => fileInput.click();

    fileInput.onchange = (e) => {
        const file = e.target.files[0];
        if (file) {
            fileNameDisplay.textContent = file.name;
            fileInfo.style.display = 'flex';
        }
    };

    // Drag & Drop
    dropZone.ondragover = (e) => {
        e.preventDefault();
        dropZone.classList.add('active');
    };
    dropZone.ondragleave = () => dropZone.classList.remove('active');
    dropZone.ondrop = (e) => {
        e.preventDefault();
        dropZone.classList.remove('active');
        const file = e.dataTransfer.files[0];
        if (file && file.name.endsWith('.csv')) {
            fileInput.files = e.dataTransfer.files;
            fileNameDisplay.textContent = file.name;
            fileInfo.style.display = 'flex';
        } else {
            showToast('CSVファイルをドロップしてください', 'error');
        }
    };

    processBtn.onclick = () => {
        if (fileInput.files.length > 0) {
            parseCSV(fileInput.files[0]);
        }
    };

    resetBtn.onclick = () => {
        dashboard.style.display = 'none';
        uploadSection.style.display = 'block';
        fileInput.value = '';
        fileInfo.style.display = 'none';
    };

    searchInput.oninput = (e) => {
        const term = e.target.value.toLowerCase();
        const filtered = campaignStats.filter(c => c.name.toLowerCase().includes(term));
        renderTable(filtered);
    };

    targetRoasInput.onchange = () => {
        if (rawData.length > 0) processData();
    };
});
