// Client JavaScript for Sports Data Scraper Web App

let leaguesData = [];
let pollInterval = null;

document.addEventListener('DOMContentLoaded', () => {
    initApp();
});

async function initApp() {
    await fetchLeagues();
    await fetchFiles();
    startStatusPolling();
    setupEventListeners();
}

function setupEventListeners() {
    document.getElementById('btn-batch-usa').addEventListener('click', runBatchUSA);
    document.getElementById('btn-refresh-all').addEventListener('click', () => {
        fetchLeagues();
        fetchFiles();
        checkStatus();
    });
    document.getElementById('btn-refresh-files').addEventListener('click', fetchFiles);
    document.getElementById('btn-stop-extraction').addEventListener('click', stopExtraction);
    document.getElementById('btn-clear-logs').addEventListener('click', clearLogs);
}

// Fetch available leagues from API
async function fetchLeagues() {
    try {
        const response = await fetch('/api/leagues');
        leaguesData = await response.json();
        renderLeaguesGrid(leaguesData);
        document.getElementById('leagues-count').innerText = `${leaguesData.length} ligas configuradas`;
    } catch (error) {
        console.error('Error fetching leagues:', error);
        document.getElementById('leagues-grid').innerHTML = `
            <div class="error-state">❌ Error al cargar las ligas del servidor.</div>
        `;
    }
}

// Render League Cards Grid
function renderLeaguesGrid(leagues) {
    const grid = document.getElementById('leagues-grid');
    grid.innerHTML = '';

    leagues.forEach(league => {
        const card = document.createElement('div');
        card.className = 'league-card';
        card.style.setProperty('--card-accent', league.accent);

        card.innerHTML = `
            <div class="card-top">
                <span class="card-flag">${league.flag}</span>
                <span class="card-source ${league.source}">${league.source}</span>
            </div>
            
            <div>
                <h4 class="card-title">${league.name}</h4>
                <p class="card-country">${league.country}</p>
            </div>

            <div class="card-inputs">
                <div class="input-group">
                    <label>Año / Temporada</label>
                    <input type="number" id="year-${league.key}" value="${league.year || 2025}" min="2000" max="2030">
                </div>
                <div class="input-group">
                    <label>Desde Jornada</label>
                    <input type="number" id="start-${league.key}" value="${league.defaultStart}" min="1" max="${league.maxMatchdays}">
                </div>
                <div class="input-group">
                    <label>Hasta Jornada</label>
                    <input type="number" id="end-${league.key}" value="${league.defaultEnd}" min="1" max="${league.maxMatchdays}">
                </div>
            </div>

            <button class="card-btn" id="btn-extract-${league.key}" onclick="triggerExtraction('${league.key}')">
                <i class="fa-solid fa-play"></i> Extraer Jornadas
            </button>
        `;

        grid.appendChild(card);
    });
}

// Trigger extraction for a single league
async function triggerExtraction(leagueKey) {
    const yearInput = document.getElementById(`year-${leagueKey}`);
    const startInput = document.getElementById(`start-${leagueKey}`);
    const endInput = document.getElementById(`end-${leagueKey}`);

    const year = yearInput ? yearInput.value.trim() : '2025';
    const startMatchday = parseInt(startInput.value) || 1;
    const endMatchday = parseInt(endInput.value) || startMatchday;

    try {
        const response = await fetch('/api/scrape', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ leagueKey, startMatchday, endMatchday, year })
        });

        const result = await response.json();
        if (!response.ok) {
            alert(result.error || 'Error al iniciar la extracción.');
            return;
        }

        // Scroll terminal into view
        document.getElementById('terminal-section').scrollIntoView({ behavior: 'smooth' });
        checkStatus();
    } catch (error) {
        alert(`Error al conectar con el servidor: ${error.message}`);
    }
}

// Trigger batch extraction for USA (MLS + NWSL)
async function runBatchUSA() {
    const mlsYear = document.getElementById('year-mls')?.value || '2025';
    const mlsStart = document.getElementById('start-mls')?.value || 1;
    const mlsEnd = document.getElementById('end-mls')?.value || 2;
    
    try {
        await fetch('/api/scrape', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ leagueKey: 'mls', startMatchday: parseInt(mlsStart), endMatchday: parseInt(mlsEnd), year: mlsYear })
        });
        document.getElementById('terminal-section').scrollIntoView({ behavior: 'smooth' });
        checkStatus();
    } catch (error) {
        alert(`Error: ${error.message}`);
    }
}

// Stop currently running extraction
async function stopExtraction() {
    try {
        const response = await fetch('/api/stop', { method: 'POST' });
        const result = await response.json();
        if (!response.ok) {
            alert(result.error || 'No fue posible detener la extracción.');
        }
    } catch (error) {
        console.error('Error stopping extraction:', error);
    }
}

// Poll Job Status & Logs
function startStatusPolling() {
    checkStatus();
    pollInterval = setInterval(checkStatus, 1000);
}

async function checkStatus() {
    try {
        const response = await fetch('/api/status');
        const job = await response.json();

        updateUIStatus(job);
    } catch (error) {
        console.error('Status check error:', error);
    }
}

let wasRunning = false;

function updateUIStatus(job) {
    const statusPill = document.getElementById('system-status-pill');
    const statusText = document.getElementById('status-text');
    const stopBtn = document.getElementById('btn-stop-extraction');
    const progressBar = document.getElementById('progress-bar');
    const progressPercentage = document.getElementById('progress-percentage');

    if (job.isRunning) {
        wasRunning = true;
        statusPill.className = 'status-pill running';
        const leagueName = leaguesData.find(l => l.key === job.leagueKey)?.name || job.leagueKey;
        statusText.innerText = `Extrayendo ${leagueName} (Jornada ${job.currentMatchday})...`;
        stopBtn.disabled = false;

        // Disable extract buttons
        document.querySelectorAll('.card-btn').forEach(btn => btn.disabled = true);
    } else {
        if (wasRunning) {
            wasRunning = false;
            fetchFiles();
        }
        statusPill.className = 'status-pill';
        statusText.innerText = job.completedAt ? 'Extracción finalizada' : 'Listo para extraer';
        stopBtn.disabled = true;

        // Enable extract buttons
        document.querySelectorAll('.card-btn').forEach(btn => btn.disabled = false);
    }

    progressBar.style.width = `${job.progress || 0}%`;
    progressPercentage.innerText = `${job.progress || 0}%`;

    // Render Logs
    if (job.logs && job.logs.length > 0) {
        renderLogs(job.logs);
    }
}

function renderLogs(logs) {
    const terminal = document.getElementById('terminal-window');
    
    // Build HTML for logs
    const html = logs.map(log => `
        <div class="log-line ${log.type}">
            <span class="log-time">[${log.time}]</span>
            <span class="log-msg">${escapeHtml(log.message)}</span>
        </div>
    `).join('');

    terminal.innerHTML = html;
    terminal.scrollTop = terminal.scrollHeight; // Auto scroll
}

function clearLogs() {
    document.getElementById('terminal-window').innerHTML = `
        <div class="log-line info">
            <span class="log-time">[SISTEMA]</span>
            <span class="log-msg">Consola limpiada. Listo para la siguiente extracción.</span>
        </div>
    `;
}

// Fetch Generated Files list
async function fetchFiles() {
    try {
        const response = await fetch('/api/files');
        const files = await response.json();
        renderFilesTable(files);
    } catch (error) {
        console.error('Error fetching files:', error);
        document.getElementById('files-list-body').innerHTML = `
            <tr><td colspan="5" class="text-center text-muted">Error al obtener archivos Excel.</td></tr>
        `;
    }
}

function renderFilesTable(files) {
    const tbody = document.getElementById('files-list-body');
    if (!files || files.length === 0) {
        tbody.innerHTML = `
            <tr><td colspan="5" class="text-center text-muted">No hay archivos Excel en la carpeta data/ aún.</td></tr>
        `;
        return;
    }

    tbody.innerHTML = files.map(f => {
        const dateStr = new Date(f.modifiedAt).toLocaleString('es-VE');
        const sheetBadge = f.sheetsCount > 0 
            ? `<span class="sheets-badge">${f.sheetsCount} Jornada(s)</span>` 
            : '<span class="text-muted">Sin datos</span>';

        return `
            <tr>
                <td>
                    <div class="file-name-cell">
                        <i class="fa-solid fa-file-excel"></i>
                        <span>${escapeHtml(f.filename)}</span>
                    </div>
                </td>
                <td>${sheetBadge}</td>
                <td>${f.sizeFormatted}</td>
                <td>${dateStr}</td>
                <td class="text-center">
                    <button class="btn-sm btn-emerald" onclick="downloadExcel('${escapeHtml(f.filename)}')">
                        <i class="fa-solid fa-download"></i> Descargar
                    </button>
                </td>
            </tr>
        `;
    }).join('');
}

async function downloadExcel(filename) {
    try {
        const response = await fetch(`/api/files/download/${encodeURIComponent(filename)}`);
        if (!response.ok) throw new Error('No se pudo descargar el archivo');
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.style.display = 'none';
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
    } catch (err) {
        alert(`Error al descargar: ${err.message}`);
    }
}

function escapeHtml(str) {
    return str.replace(/&/g, "&amp;")
              .replace(/</g, "&lt;")
              .replace(/>/g, "&gt;")
              .replace(/"/g, "&quot;");
}
