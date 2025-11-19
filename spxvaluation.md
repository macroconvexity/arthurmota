<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>SPX Fair Value – Gordon Growth Model</title>
    
    <!-- Chart.js CDN -->
    <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>

    <style>
        :root {
            --primary: #1e293b;
            --accent: #6366f1;
            --bg: #f1f5f9;
            --card: #ffffff;
            --text: #334155;
            --border: #e2e8f0;
            --positive: #10b981;
            --negative: #ef4444;
        }

        * { box-sizing: border-box; margin: 0; padding: 0; }

        body {
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
            background: var(--bg);
            color: var(--text);
            padding: 20px;
            line-height: 1.5;
        }

        .container {
            max-width: 1200px;
            margin: 0 auto;
            display: grid;
            grid-template-columns: 350px 1fr;
            gap: 24px;
        }

        header {
            grid-column: 1 / -1;
            margin-bottom: 10px;
            padding-bottom: 15px;
            border-bottom: 1px solid var(--border);
            display: flex;
            justify-content: space-between;
            align-items: center;
        }

        h1 { font-size: 1.5rem; font-weight: 700; color: var(--primary); }
        .subtitle { font-size: 0.9rem; color: #64748b; }

        .card {
            background: var(--card);
            border-radius: 12px;
            padding: 24px;
            box-shadow: 0 1px 3px rgba(0,0,0,0.05);
            border: 1px solid var(--border);
            margin-bottom: 20px;
        }

        h2 { 
            font-size: 0.85rem; 
            text-transform: uppercase; 
            letter-spacing: 0.05em; 
            color: #94a3b8; 
            margin-bottom: 15px; 
            font-weight: 700;
        }

        /* Input Styles */
        .control-group { margin-bottom: 20px; }

        label {
            display: flex;
            justify-content: space-between;
            font-size: 0.9rem;
            font-weight: 600;
            margin-bottom: 8px;
            color: var(--text);
        }

        .val-display { color: var(--accent); font-family: monospace; font-weight: 700; }

        input[type="range"] {
            width: 100%;
            accent-color: var(--accent);
            cursor: pointer;
        }

        input[type="number"] {
            width: 100%;
            padding: 8px 12px;
            border: 1px solid var(--border);
            border-radius: 6px;
            font-size: 1rem;
        }

        /* Scenario Buttons */
        .scenario-grid {
            display: grid;
            grid-template-columns: 1fr 1fr 1fr;
            gap: 10px;
            margin-bottom: 20px;
        }

        .scenario-btn {
            padding: 10px;
            border: 1px solid var(--border);
            background: #f8fafc;
            border-radius: 6px;
            cursor: pointer;
            font-size: 0.85rem;
            font-weight: 600;
            color: #64748b;
            transition: all 0.2s;
        }

        .scenario-btn:hover { background: #e2e8f0; color: var(--primary); }
        .scenario-btn.active {
            background: var(--accent);
            color: white;
            border-color: var(--accent);
        }

        /* Output Styles */
        .main-metric {
            text-align: center;
            padding: 20px;
            background: linear-gradient(135deg, #f8fafc 0%, #eef2ff 100%);
            border-radius: 12px;
            border: 1px solid #e0e7ff;
            margin-bottom: 20px;
        }

        .metric-label { font-size: 0.9rem; color: #64748b; font-weight: 600; text-transform: uppercase; }
        .metric-value { font-size: 3.5rem; font-weight: 800; color: var(--primary); margin: 10px 0; line-height: 1; }
        .metric-sub { font-size: 1rem; color: var(--accent); font-weight: 500; }

        .chart-container {
            position: relative;
            height: 300px;
            width: 100%;
        }

        .stats-table {
            width: 100%;
            border-collapse: collapse;
            margin-top: 20px;
        }

        .stats-table td {
            padding: 12px 0;
            border-bottom: 1px solid #f1f5f9;
            font-size: 0.95rem;
        }

        .stats-table td:last-child {
            text-align: right;
            font-weight: 700;
            font-family: monospace;
        }

        .helper-text {
            font-size: 0.8rem;
            color: #94a3b8;
            margin-top: 4px;
        }

        .derived-info {
            font-size: 0.8rem;
            background: #f1f5f9;
            padding: 8px;
            border-radius: 4px;
            color: #475569;
            margin-top: 8px;
            display: flex;
            justify-content: space-between;
        }

        @media (max-width: 768px) {
            .container { grid-template-columns: 1fr; }
            .metric-value { font-size: 2.5rem; }
        }
    </style>
</head>
<body>

<div class="container">
    <header>
        <div>
            <h1>SPX Fair Value</h1>
            <div class="subtitle">Gordon Growth Model (ROE & P/E Enhanced)</div>
        </div>
        <div style="text-align: right;">
            <div style="font-size: 0.8rem; color: #94a3b8;">MODEL:</div>
            <div style="font-family: monospace; font-weight: 700; color: var(--accent);">P = D₁ / (r - g)</div>
        </div>
    </header>

    <!-- Left Column: Controls -->
    <aside>
        <div class="card">
            <h2>Scenarios</h2>
            <div class="scenario-grid">
                <button class="scenario-btn" onclick="setScenario('softLanding')">Soft Landing</button>
                <button class="scenario-btn" onclick="setScenario('recession')">Recession</button>
                <button class="scenario-btn" onclick="setScenario('reflation')">Reflation</button>
            </div>
        </div>

        <div class="card">
            <h2>Market Data</h2>
            <div class="control-group">
                <label>Current SPX Price</label>
                <input type="number" id="in-price" value="5900" step="1">
            </div>
        </div>

        <div class="card">
            <h2>Fundamentals</h2>
            
            <div class="control-group">
                <label>Trailing EPS ($) <span id="val-eps" class="val-display">250</span></label>
                <input type="number" id="in-eps" value="250" step="1">
            </div>

            <div class="control-group">
                <label>Return on Equity (ROE) <span id="val-roe" class="val-display">18%</span></label>
                <input type="range" id="in-roe" min="5" max="30" value="18" step="0.1">
                <div class="helper-text">Profitability metric</div>
            </div>

            <div class="control-group">
                <label>LT Growth (g) <span id="val-g" class="val-display">5.5%</span></label>
                <input type="range" id="in-g" min="0" max="10" value="5.5" step="0.1">
                
                <div class="derived-info">
                    <span>Implied Payout:</span>
                    <span id="out-implied-payout" style="font-weight: 700;">---</span>
                </div>
            </div>
        </div>

        <div class="card">
            <h2>Discount Rate (r)</h2>
            
            <div class="control-group">
                <label>Real Risk-Free Rate (%) <span id="val-real" class="val-display">2.0%</span></label>
                <input type="number" id="in-real" value="2.0" step="0.1">
            </div>

            <div class="control-group">
                <label>Inflation Exp. (%) <span id="val-inf" class="val-display">2.3%</span></label>
                <input type="number" id="in-inf" value="2.3" step="0.1">
            </div>

            <div class="control-group">
                <label>Equity Risk Premium (%) <span id="val-erp" class="val-display">4.5%</span></label>
                <input type="range" id="in-erp" min="2.0" max="8.0" value="4.5" step="0.1">
            </div>
        </div>
    </aside>

    <!-- Right Column: Output -->
    <main>
        <div class="card">
            <div class="main-metric">
                <div class="metric-label">Fair Value (SPX)</div>
                <div class="metric-value" id="out-fair-value">---</div>
                
                <div style="display: flex; justify-content: center; gap: 20px; margin-top: 10px;">
                    <div class="metric-sub">Fair P/E: <span id="out-fair-pe">---</span></div>
                    <div class="metric-sub">Disc. Rate (r): <span id="out-r">---</span></div>
                </div>
            </div>

            <table class="stats-table">
                <tr>
                    <td>Current Market Price</td>
                    <td id="out-mkt-price">---</td>
                </tr>
                <tr>
                    <td>Upside / Downside</td>
                    <td id="out-upside">---</td>
                </tr>
                <tr>
                    <td>Implied Market P/E</td>
                    <td id="out-mkt-pe">---</td>
                </tr>
                <tr>
                    <td>Next Year Dividend (D₁)</td>
                    <td id="out-d1">---</td>
                </tr>
            </table>
        </div>

        <div class="card">
            <h2>Valuation Sensitivity</h2>
            <div style="font-size: 0.85rem; color: #64748b; margin-bottom: 10px;">
                Fair value curve as Discount Rate (r) changes.
            </div>
            <div class="chart-container">
                <canvas id="sensitivityChart"></canvas>
            </div>
        </div>
    </main>
</div>

<script>
/**
 * STATE & CONFIGURATION
 */
let chartInstance = null;

// Default Scenarios
const SCENARIOS = {
    softLanding: {
        g: 5.5,
        real: 1.8,
        inf: 2.3,
        erp: 4.0,
        roe: 18.0
    },
    recession: {
        g: 2.0,
        real: 0.5,
        inf: 1.5,
        erp: 6.0,
        roe: 12.0
    },
    reflation: {
        g: 6.5,
        real: 2.2,
        inf: 3.5,
        erp: 4.5,
        roe: 20.0
    }
};

/**
 * DOM ELEMENTS
 */
const elPrice = document.getElementById('in-price');
const elEps = document.getElementById('in-eps');
const elRoe = document.getElementById('in-roe'); // New
const elG = document.getElementById('in-g');
const elReal = document.getElementById('in-real');
const elInf = document.getElementById('in-inf');
const elErp = document.getElementById('in-erp');

// Display Spans
const dEps = document.getElementById('val-eps');
const dRoe = document.getElementById('val-roe'); // New
const dG = document.getElementById('val-g');
const dReal = document.getElementById('val-real');
const dInf = document.getElementById('val-inf');
const dErp = document.getElementById('val-erp');

// Outputs
const outFv = document.getElementById('out-fair-value');
const outFairPe = document.getElementById('out-fair-pe'); // New
const outR = document.getElementById('out-r');
const outMkt = document.getElementById('out-mkt-price');
const outUp = document.getElementById('out-upside');
const outMktPe = document.getElementById('out-mkt-pe'); // New
const outD1 = document.getElementById('out-d1');
const outImpliedPayout = document.getElementById('out-implied-payout'); // New

/**
 * CORE LOGIC
 * Gordon Growth Model: P = D1 / (r - g)
 * Derived Payout = 1 - (g / ROE)
 */
function calculateValuation() {
    // 1. Get Inputs
    const marketPrice = parseFloat(elPrice.value);
    const eps = parseFloat(elEps.value);
    const roe = parseFloat(elRoe.value) / 100;
    const g = parseFloat(elG.value) / 100;
    
    const realRate = parseFloat(elReal.value) / 100;
    const inflation = parseFloat(elInf.value) / 100;
    const erp = parseFloat(elErp.value) / 100;

    // 2. Derived Values
    const r = realRate + inflation + erp; // Cost of Equity
    
    // Calculate Implied Payout Ratio
    // g = ROE * Retention  => Retention = g / ROE
    // Payout = 1 - Retention
    let retention = 0;
    if (roe > 0) retention = g / roe;
    
    // Clamp retention for logical bounds (cannot grow faster than ROE infinitely without raising capital)
    // We allow g > ROE technically in math, but it implies negative payout which breaks DDM.
    let payout = 1 - retention;
    let payoutValid = true;
    
    if (payout < 0) {
        payout = 0;
        payoutValid = false;
    }

    const d0 = eps * payout;
    const d1 = d0 * (1 + g);

    // 3. Valuation
    let fairValue = 0;
    let isValid = true;

    // Singularity check: if g >= r, model breaks
    if (g >= r - 0.001 || !payoutValid) {
        isValid = false;
        fairValue = 99999; 
    } else {
        fairValue = d1 / (r - g);
    }

    return {
        marketPrice,
        eps,
        roe,
        payout,
        g,
        r,
        d1,
        fairValue,
        isValid,
        payoutValid
    };
}

function updateDashboard() {
    // Update Value Displays
    dEps.textContent = elEps.value;
    dRoe.textContent = elRoe.value + '%';
    dG.textContent = elG.value + '%';
    dReal.textContent = elReal.value + '%';
    dInf.textContent = elInf.value + '%';
    dErp.textContent = elErp.value + '%';

    // Calculate
    const res = calculateValuation();

    // Update Implied Payout Display
    if (res.payoutValid) {
        outImpliedPayout.textContent = (res.payout * 100).toFixed(1) + '%';
        outImpliedPayout.style.color = "#475569";
    } else {
        outImpliedPayout.textContent = "Invalid (g > ROE)";
        outImpliedPayout.style.color = "#ef4444";
    }

    // Update Main Output
    if (!res.isValid) {
        outFv.textContent = "Undefined";
        outFv.style.color = "#cbd5e1";
        outR.textContent = "Check inputs";
        outFairPe.textContent = "---";
    } else {
        outFv.textContent = res.fairValue.toLocaleString('en-US', { maximumFractionDigits: 0 });
        outFv.style.color = "var(--primary)";
        outR.textContent = (res.r * 100).toFixed(2) + '%';
        outFairPe.textContent = (res.fairValue / res.eps).toFixed(1) + 'x';
    }

    // Update Table
    outMkt.textContent = res.marketPrice.toLocaleString();
    
    // Market P/E
    if (res.eps > 0) {
        outMktPe.textContent = (res.marketPrice / res.eps).toFixed(1) + 'x';
    } else {
        outMktPe.textContent = "---";
    }
    
    if (res.isValid) {
        const diff = (res.fairValue - res.marketPrice) / res.marketPrice * 100;
        outUp.textContent = (diff > 0 ? '+' : '') + diff.toFixed(1) + '%';
        outUp.style.color = diff > 0 ? 'var(--positive)' : 'var(--negative)';
        
        outD1.textContent = '$' + res.d1.toFixed(2);
    } else {
        outUp.textContent = "-";
        outD1.textContent = "-";
    }

    updateChart(res);
}

/**
 * SCENARIOS
 */
function setScenario(key) {
    const s = SCENARIOS[key];
    if (!s) return;

    elG.value = s.g;
    elReal.value = s.real;
    elInf.value = s.inf;
    elErp.value = s.erp;
    if (s.roe) elRoe.value = s.roe;

    // Highlight active button
    document.querySelectorAll('.scenario-btn').forEach(btn => btn.classList.remove('active'));
    event.target.classList.add('active');

    updateDashboard();
}

/**
 * CHARTING
 */
function updateChart(data) {
    const ctx = document.getElementById('sensitivityChart').getContext('2d');
    
    const points = [];
    const labels = [];
    
    const step = 0.005; // 0.5% steps
    
    // Start from slightly above g to avoid infinity
    let startR = Math.max(data.g + 0.005, data.r - (step * 5));
    
    for (let i = 0; i < 15; i++) {
        let simR = startR + (i * step);
        let simP = data.d1 / (simR - data.g);
        
        if (simP > 20000) simP = 20000; // Visual Cap

        labels.push((simR * 100).toFixed(1) + '%');
        points.push(simP);
    }

    if (chartInstance) {
        chartInstance.data.labels = labels;
        chartInstance.data.datasets[0].data = points;
        chartInstance.update();
    } else {
        initChart(labels, points);
    }
}

function initChart(labels, data) {
    const ctx = document.getElementById('sensitivityChart').getContext('2d');
    
    chartInstance = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [{
                label: 'Fair Value',
                data: data,
                borderColor: '#6366f1',
                backgroundColor: 'rgba(99, 102, 241, 0.1)',
                borderWidth: 3,
                fill: true,
                tension: 0.4,
                pointRadius: 4,
                pointHoverRadius: 6
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                x: {
                    title: { display: true, text: 'Discount Rate (r)' },
                    grid: { display: false }
                },
                y: {
                    title: { display: true, text: 'SPX Level' },
                    grid: { color: '#f1f5f9' }
                }
            },
            plugins: {
                legend: { display: false },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            return 'Fair Value: ' + Math.round(context.parsed.y);
                        }
                    }
                }
            }
        }
    });
}

// Listeners
const inputs = [elPrice, elEps, elRoe, elG, elReal, elInf, elErp];
inputs.forEach(el => el.addEventListener('input', updateDashboard));

// Init
window.addEventListener('DOMContentLoaded', () => {
    updateDashboard();
});

</script>
</body>
</html>
