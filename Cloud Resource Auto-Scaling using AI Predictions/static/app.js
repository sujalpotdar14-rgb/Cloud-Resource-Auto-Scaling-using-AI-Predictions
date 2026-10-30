/* Frontend Dashboard Application JavaScript Controller */

let telemetryChart = null;
let currentStrategy = "ai_predictive";
let currentWorkload = "normal";

document.addEventListener("DOMContentLoaded", () => {
    initChart();
    fetchStatus();
    fetchEvents();

    // Poll status every 2 seconds for live telemetry & graphs
    setInterval(fetchStatus, 2000);
    setInterval(fetchEvents, 3000);
});

// Initialize Chart.js Line Chart
function initChart() {
    const ctx = document.getElementById('telemetryChart').getContext('2d');
    
    telemetryChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: [],
            datasets: [
                {
                    label: 'Actual CPU (%)',
                    data: [],
                    borderColor: '#00f2fe',
                    backgroundColor: 'rgba(0, 242, 254, 0.08)',
                    borderWidth: 2,
                    tension: 0.3,
                    fill: true,
                    pointRadius: 3,
                    pointHoverRadius: 6
                },
                {
                    label: 'AI Predicted Peak (%)',
                    data: [],
                    borderColor: '#f59e0b',
                    borderDash: [5, 5],
                    borderWidth: 2,
                    tension: 0.3,
                    fill: false,
                    pointRadius: 2
                },
                {
                    label: 'Target CPU (65%)',
                    data: [],
                    borderColor: 'rgba(244, 63, 94, 0.5)',
                    borderWidth: 1.5,
                    borderDash: [2, 2],
                    pointRadius: 0,
                    fill: false
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            animation: { duration: 300 },
            scales: {
                x: {
                    grid: { color: 'rgba(255, 255, 255, 0.05)' },
                    ticks: { color: '#9ca3af', font: { family: 'Outfit', size: 11 } }
                },
                y: {
                    min: 0,
                    max: 100,
                    grid: { color: 'rgba(255, 255, 255, 0.05)' },
                    ticks: { color: '#9ca3af', font: { family: 'Outfit', size: 11 } }
                }
            },
            plugins: {
                legend: { display: false },
                tooltip: {
                    mode: 'index',
                    intersect: false,
                    backgroundColor: '#0f172a',
                    borderColor: 'rgba(255,255,255,0.1)',
                    borderWidth: 1,
                    titleFont: { family: 'Outfit', size: 13 },
                    bodyFont: { family: 'Outfit', size: 12 }
                }
            }
        }
    });
}

// Fetch live telemetry & system status
async function fetchStatus() {
    try {
        const response = await fetch('/api/status');
        const data = await response.json();
        
        updateKPIs(data);
        updateFleetVisualizer(data.fleet.instances);
        updateChartData(data);
        updateBadges(data);
    } catch (err) {
        console.error("Failed to fetch system status:", err);
    }
}

// Update KPI Display Cards
function updateKPIs(data) {
    document.getElementById('kpiInstances').textContent = data.active_instances;
    document.getElementById('kpiTarget').textContent = `Target: ${data.recommended_instances} instances`;
    
    document.getElementById('kpiCpu').textContent = data.current_cpu.toFixed(1);
    document.getElementById('cpuProgressFill').style.width = `${Math.min(100, data.current_cpu)}%`;
    
    const predCpu = data.ai_forecast.max_predicted_cpu;
    document.getElementById('kpiPredCpu').textContent = predCpu.toFixed(1);

    const spikeEl = document.getElementById('kpiSpikeStatus');
    if (data.ai_forecast.is_spike_predicted) {
        spikeEl.innerHTML = `<i class="fa-solid fa-triangle-exclamation text-amber"></i> AI Predicted Load Spike (>75%)`;
    } else {
        spikeEl.innerHTML = `<i class="fa-solid fa-circle-check text-emerald"></i> Nominal Workload Forecasted`;
    }
}

// Update Chart Dataset with rolling telemetry
function updateChartData(data) {
    if (!telemetryChart) return;

    const timeLabel = new Date(data.timestamp * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    
    telemetryChart.data.labels.push(timeLabel);
    telemetryChart.data.datasets[0].data.push(data.current_cpu);
    telemetryChart.data.datasets[1].data.push(data.ai_forecast.max_predicted_cpu);
    telemetryChart.data.datasets[2].data.push(65.0);

    // Keep last 25 points on chart view
    if (telemetryChart.data.labels.length > 25) {
        telemetryChart.data.labels.shift();
        telemetryChart.data.datasets[0].data.shift();
        telemetryChart.data.datasets[1].data.shift();
        telemetryChart.data.datasets[2].data.shift();
    }

    telemetryChart.update('none');
}

// Update Active Fleet Instance Node Visualizer
function updateFleetVisualizer(instances) {
    const container = document.getElementById('fleetNodesContainer');
    container.innerHTML = '';

    instances.forEach((inst, idx) => {
        const node = document.createElement('div');
        node.className = `node-card ${inst.State === 'running' ? 'healthy' : ''}`;
        
        node.innerHTML = `
            <div class="node-header">
                <span class="node-id">${inst.InstanceId}</span>
                <span class="node-status-dot"></span>
            </div>
            <div class="node-type">${inst.InstanceType}</div>
            <div style="font-size: 10px; color: #9ca3af; margin-top: 4px;">AZ: ${inst.AvailabilityZone}</div>
        `;
        container.appendChild(node);
    });
}

// Update Top Header Environment & Cost Badges
function updateBadges(data) {
    const modeText = document.getElementById('modeText');
    if (data.fleet.mode === "LIVE_AWS_FREE_TIER") {
        modeText.textContent = `AWS Account (${data.fleet.region})`;
        modeText.style.color = '#10b981';
    } else {
        modeText.textContent = "Local AWS Emulator (₹0 Cost)";
        modeText.style.color = '#00f2fe';
    }
}

// Switch Auto-Scaling Mode
async function setScalingMode(mode) {
    currentStrategy = mode;
    document.getElementById('btnPredictive').classList.toggle('active', mode === 'ai_predictive');
    document.getElementById('btnReactive').classList.toggle('active', mode === 'reactive');
    
    document.getElementById('strategyBadge').textContent = mode === 'ai_predictive' ? 'AI Predictive (Proactive)' : 'Reactive (Lagging)';

    await fetch('/api/autoscale/toggle-mode', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode })
    });
    fetchStatus();
}

// Switch Traffic Simulation Pattern
async function setWorkloadPattern(pattern) {
    currentWorkload = pattern;
    document.querySelectorAll('.sim-btn').forEach(btn => btn.classList.remove('active'));
    document.getElementById(`sim_${pattern}`).classList.add('active');

    await fetch('/api/simulate-workload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pattern })
    });
    fetchStatus();
}

// Fetch & render event audit feed
async function fetchEvents() {
    try {
        const response = await fetch('/api/events');
        const data = await response.json();
        
        const terminal = document.getElementById('eventTerminal');
        terminal.innerHTML = '';
        
        data.events.forEach(evt => {
            const line = document.createElement('div');
            line.className = 'terminal-line';
            line.innerHTML = `
                <span class="term-time">[${evt.timestamp}]</span>
                <span class="term-tag tag-${evt.type}">${evt.type}</span>
                <span class="term-msg"><strong>${evt.title}</strong>: ${evt.description}</span>
            `;
            terminal.appendChild(line);
        });
    } catch (err) {
        console.error("Failed to fetch event logs:", err);
    }
}

// Modal handling for AWS Credentials
function openAWSModal() {
    document.getElementById('awsModal').classList.add('open');
}

function closeAWSModal() {
    document.getElementById('awsModal').classList.remove('open');
}

async function submitAWSConfig(event) {
    event.preventDefault();
    const accessKey = document.getElementById('awsAccessKey').value.trim();
    const secretKey = document.getElementById('awsSecretKey').value.trim();
    const region = document.getElementById('awsRegion').value;

    const response = await fetch('/api/aws/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ access_key: accessKey, secret_key: secretKey, region: region })
    });
    const res = await response.json();
    
    alert(res.message);
    closeAWSModal();
    fetchStatus();
}

function useSimulatorMode() {
    document.getElementById('awsAccessKey').value = '';
    document.getElementById('awsSecretKey').value = '';
    submitAWSConfig(new Event('submit'));
}
