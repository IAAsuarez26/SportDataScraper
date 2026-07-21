/**
 * Main Application for UCL Squad Analyzer
 * Handles navigation, data loading, and UI updates
 */

// =============================================================================
// State Management
// =============================================================================
const state = {
    teams: [],
    currentView: 'dashboard',
    selectedTeam: null,
    isLoading: false
};

// =============================================================================
// DOM Elements
// =============================================================================
const elements = {
    // Views
    dashboardView: document.getElementById('dashboard-view'),
    rankingsView: document.getElementById('rankings-view'),
    compareView: document.getElementById('compare-view'),
    fixturesView: document.getElementById('fixtures-view'),

    // Navigation
    navLinks: document.querySelectorAll('.nav-link'),

    // Dashboard
    topTeamsGrid: document.getElementById('topTeamsGrid'),
    avgPhysical: document.getElementById('avgPhysical'),
    avgTechnical: document.getElementById('avgTechnical'),
    avgTactical: document.getElementById('avgTactical'),
    teamsLoaded: document.getElementById('teamsLoaded'),

    // Rankings
    rankingsSort: document.getElementById('rankingsSort'),
    rankingsBody: document.getElementById('rankingsBody'),

    // Compare
    team1Select: document.getElementById('team1Select'),
    team2Select: document.getElementById('team2Select'),
    compareBtn: document.getElementById('compareBtn'),
    comparisonResult: document.getElementById('comparisonResult'),

    // Fixtures
    fixturesList: document.getElementById('fixturesList'),

    // Modal
    teamModal: document.getElementById('teamModal'),
    modalBody: document.getElementById('modalBody'),
    modalClose: document.getElementById('modalClose'),

    // Actions
    refreshBtn: document.getElementById('refreshBtn')
};

// =============================================================================
// Initialization
// =============================================================================
document.addEventListener('DOMContentLoaded', () => {
    initNavigation();
    initEventListeners();
    loadInitialData();
});

function initNavigation() {
    elements.navLinks.forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            const view = link.dataset.view;
            navigateTo(view);
        });
    });

    // Handle view-all links
    document.querySelectorAll('.view-all-link').forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            const view = link.dataset.view;
            navigateTo(view);
        });
    });
}

function initEventListeners() {
    // Rankings sort
    elements.rankingsSort.addEventListener('change', () => {
        loadRankings(elements.rankingsSort.value);
    });

    // Compare
    elements.compareBtn.addEventListener('click', handleCompare);

    // Modal close
    elements.modalClose.addEventListener('click', closeModal);
    elements.teamModal.addEventListener('click', (e) => {
        if (e.target === elements.teamModal) closeModal();
    });

    // Refresh
    elements.refreshBtn.addEventListener('click', handleRefresh);

    // Keyboard shortcuts
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') closeModal();
    });
}

// =============================================================================
// Navigation
// =============================================================================
function navigateTo(view) {
    // Update nav links
    elements.navLinks.forEach(link => {
        link.classList.toggle('active', link.dataset.view === view);
    });

    // Update views
    document.querySelectorAll('.view').forEach(v => {
        v.classList.remove('active');
    });

    const viewElement = document.getElementById(`${view}-view`);
    if (viewElement) {
        viewElement.classList.add('active');
    }

    state.currentView = view;

    // Load view-specific data
    switch (view) {
        case 'rankings':
            loadRankings();
            break;
        case 'compare':
            populateTeamSelects();
            break;
        case 'fixtures':
            loadFixtures();
            break;
    }
}

// =============================================================================
// Data Loading
// =============================================================================
async function loadInitialData() {
    showLoading(elements.topTeamsGrid);

    try {
        // Try API first, fall back to mock data
        let data;
        try {
            data = await api.getRankings('overall');
            state.teams = data.rankings || [];
        } catch (error) {
            console.warn('Using mock data');
            state.teams = mockTeams;
        }

        // Update UI
        renderTopTeams(state.teams.slice(0, 10));
        updateStats(state.teams);
        renderCharts(state.teams);

    } catch (error) {
        console.error('Failed to load data:', error);
        state.teams = mockTeams;
        renderTopTeams(state.teams.slice(0, 10));
        updateStats(state.teams);
        renderCharts(state.teams);
    }
}

async function loadRankings(sortBy = 'overall') {
    showLoading(elements.rankingsBody, 'table');

    try {
        let data;
        try {
            data = await api.getRankings(sortBy);
            state.teams = data.rankings || [];
        } catch (error) {
            // Sort mock data
            state.teams = [...mockTeams].sort((a, b) => {
                const key = sortBy === 'overall' ? 'overall_score' : `${sortBy}_score`;
                return (b[key] || 0) - (a[key] || 0);
            });
        }

        renderRankingsTable(state.teams);

    } catch (error) {
        console.error('Failed to load rankings:', error);
        renderRankingsTable(mockTeams);
    }
}

async function loadFixtures() {
    showLoading(elements.fixturesList);

    try {
        let fixtures;
        try {
            const data = await api.getFixtures();
            fixtures = data.fixtures || [];
        } catch (error) {
            fixtures = mockFixtures;
        }

        renderFixtures(fixtures);

    } catch (error) {
        console.error('Failed to load fixtures:', error);
        renderFixtures(mockFixtures);
    }
}

// =============================================================================
// Rendering Functions
// =============================================================================
function renderTopTeams(teams) {
    if (!teams.length) {
        elements.topTeamsGrid.innerHTML = '<div class="empty-state"><span class="empty-icon">🔍</span><p>No teams found</p></div>';
        return;
    }

    elements.topTeamsGrid.innerHTML = teams.map((team, index) => {
        const score = team.overall_score || team.analysis?.overall_score || 70;
        const physical = team.physical_score || team.physical?.physical_score || team.analysis?.physical?.physical_score || 70;
        const technical = team.technical_score || team.technical?.technical_score || team.analysis?.technical?.technical_score || 70;
        const tactical = team.tactical_score || team.tactical?.tactical_score || team.analysis?.tactical?.tactical_score || 70;

        const rankClass = index === 0 ? 'gold' : index === 1 ? 'silver' : index === 2 ? 'bronze' : 'default';

        return `
            <div class="team-card" data-team-id="${team.id || team.team_id}">
                <div class="team-card-header">
                    <div class="team-rank ${rankClass}">${index + 1}</div>
                    <div class="team-info">
                        <div class="team-name">${team.name || team.team_name}</div>
                        <div class="team-country">${team.country || ''}</div>
                    </div>
                    <div class="team-score-badge">${score.toFixed(1)}</div>
                </div>
                <div class="team-card-stats">
                    <div class="mini-stat">
                        <span class="mini-stat-value physical">${physical.toFixed(0)}</span>
                        <span class="mini-stat-label">Físico</span>
                    </div>
                    <div class="mini-stat">
                        <span class="mini-stat-value technical">${technical.toFixed(0)}</span>
                        <span class="mini-stat-label">Técnico</span>
                    </div>
                    <div class="mini-stat">
                        <span class="mini-stat-value tactical">${tactical.toFixed(0)}</span>
                        <span class="mini-stat-label">Táctico</span>
                    </div>
                </div>
            </div>
        `;
    }).join('');

    // Add click handlers
    document.querySelectorAll('.team-card').forEach(card => {
        card.addEventListener('click', () => {
            const teamId = card.dataset.teamId;
            openTeamModal(teamId);
        });
    });
}

function updateStats(teams) {
    if (!teams.length) return;

    const getAvg = (key) => {
        const values = teams.map(t => {
            // Handle nested structure
            if (key === 'physical') return t.physical_score || t.physical?.physical_score || t.analysis?.physical?.physical_score || 70;
            if (key === 'technical') return t.technical_score || t.technical?.technical_score || t.analysis?.technical?.technical_score || 70;
            if (key === 'tactical') return t.tactical_score || t.tactical?.tactical_score || t.analysis?.tactical?.tactical_score || 70;
            return 70;
        });
        return (values.reduce((a, b) => a + b, 0) / values.length).toFixed(1);
    };

    elements.avgPhysical.textContent = getAvg('physical');
    elements.avgTechnical.textContent = getAvg('technical');
    elements.avgTactical.textContent = getAvg('tactical');
    elements.teamsLoaded.textContent = teams.length;
}

function renderCharts(teams) {
    const scoresCtx = document.getElementById('scoresChart');
    const countriesCtx = document.getElementById('countriesChart');

    if (scoresCtx) createScoresChart(scoresCtx, teams);
    if (countriesCtx) createCountriesChart(countriesCtx, teams);
}

function renderRankingsTable(teams) {
    elements.rankingsBody.innerHTML = teams.map((team, index) => {
        const score = team.overall_score || team.analysis?.overall_score || 70;
        const physical = team.physical_score || team.physical?.physical_score || team.analysis?.physical?.physical_score || 70;
        const technical = team.technical_score || team.technical?.technical_score || team.analysis?.technical?.technical_score || 70;
        const tactical = team.tactical_score || team.tactical?.tactical_score || team.analysis?.tactical?.tactical_score || 70;

        const status = score >= 80 ? 'excellent' : score >= 70 ? 'good' : score >= 60 ? 'moderate' : 'poor';
        const statusText = score >= 80 ? 'En Forma' : score >= 70 ? 'Bien' : score >= 60 ? 'Regular' : 'Bajo';

        return `
            <tr data-team-id="${team.id || team.team_id}">
                <td>${index + 1}</td>
                <td>
                    <div class="table-team-cell">
                        <span class="table-short-name">${team.short_name || ''}</span>
                        <span class="table-team-name">${team.name || team.team_name}</span>
                    </div>
                </td>
                <td>${team.country || '-'}</td>
                <td><span class="score-pill physical">${physical.toFixed(0)}</span></td>
                <td><span class="score-pill technical">${technical.toFixed(0)}</span></td>
                <td><span class="score-pill tactical">${tactical.toFixed(0)}</span></td>
                <td><span class="score-pill overall">${score.toFixed(1)}</span></td>
                <td><span class="status-badge ${status}">${statusText}</span></td>
            </tr>
        `;
    }).join('');

    // Add click handlers
    elements.rankingsBody.querySelectorAll('tr').forEach(row => {
        row.addEventListener('click', () => {
            const teamId = row.dataset.teamId;
            openTeamModal(teamId);
        });
    });
}

function renderFixtures(fixtures) {
    if (!fixtures.length) {
        elements.fixturesList.innerHTML = '<div class="empty-state"><span class="empty-icon">📅</span><p>No hay partidos próximos</p></div>';
        return;
    }

    elements.fixturesList.innerHTML = fixtures.map(fixture => {
        const homeWin = fixture.home_win || fixture.probabilities?.home_win || 33;
        const draw = fixture.draw || fixture.probabilities?.draw || 33;
        const awayWin = fixture.away_win || fixture.probabilities?.away_win || 33;
        const favorite = fixture.favorite || 'Even Match';
        const confidence = (fixture.confidence || 'low').toLowerCase();

        return `
            <div class="fixture-card">
                <div class="fixture-team home">
                    <div>
                        <div class="fixture-team-name">${fixture.home_team}</div>
                        <div class="fixture-team-form">
                            ${renderFormDots(fixture.home_form || 'WDWLW')}
                        </div>
                    </div>
                </div>
                <div class="fixture-vs">
                    <span class="fixture-vs-text">VS</span>
                </div>
                <div class="fixture-team away">
                    <div>
                        <div class="fixture-team-name">${fixture.away_team}</div>
                        <div class="fixture-team-form">
                            ${renderFormDots(fixture.away_form || 'DWWDL')}
                        </div>
                    </div>
                </div>
                <div class="fixture-prediction">
                    <span class="prediction-label">Favorito</span>
                    <span class="prediction-value">${favorite}</span>
                    <span class="prediction-confidence ${confidence}">${confidence.charAt(0).toUpperCase() + confidence.slice(1)} Confianza</span>
                </div>
            </div>
        `;
    }).join('');
}

function renderFormDots(formString) {
    return formString.split('').map(r => `<span class="form-dot ${r}"></span>`).join('');
}

// =============================================================================
// Compare Feature
// =============================================================================
function populateTeamSelects() {
    const options = state.teams.map(team =>
        `<option value="${team.id || team.team_id}">${team.name || team.team_name}</option>`
    ).join('');

    const defaultOption = '<option value="">Seleccionar equipo...</option>';

    elements.team1Select.innerHTML = defaultOption + options;
    elements.team2Select.innerHTML = defaultOption + options;
}

async function handleCompare() {
    const team1Id = elements.team1Select.value;
    const team2Id = elements.team2Select.value;

    if (!team1Id || !team2Id) {
        alert('Por favor selecciona dos equipos para comparar');
        return;
    }

    if (team1Id === team2Id) {
        alert('Por favor selecciona equipos diferentes');
        return;
    }

    // Find teams in state
    const team1 = state.teams.find(t => (t.id || t.team_id) === team1Id);
    const team2 = state.teams.find(t => (t.id || t.team_id) === team2Id);

    if (!team1 || !team2) {
        alert('Equipos no encontrados');
        return;
    }

    renderComparison(team1, team2);
}

function renderComparison(team1, team2) {
    const getScore = (team, key) => {
        if (key === 'overall') return team.overall_score || team.analysis?.overall_score || 70;
        const keyMap = { physical: 'physical_score', technical: 'technical_score', tactical: 'tactical_score' };
        return team[keyMap[key]] || team[key]?.[keyMap[key]] || team.analysis?.[key]?.[keyMap[key]] || 70;
    };

    const team1Score = getScore(team1, 'overall');
    const team2Score = getScore(team2, 'overall');
    const scoreDiff = Math.abs(team1Score - team2Score);

    let prediction = '';
    if (scoreDiff > 10) {
        prediction = team1Score > team2Score ? `${team1.name || team1.team_name} es favorito` : `${team2.name || team2.team_name} es favorito`;
    } else if (scoreDiff > 5) {
        prediction = team1Score > team2Score ? `${team1.name || team1.team_name} tiene ligera ventaja` : `${team2.name || team2.team_name} tiene ligera ventaja`;
    } else {
        prediction = 'Partido muy igualado';
    }

    // Calculate probabilities
    const total = team1Score + team2Score;
    const team1Prob = Math.round((team1Score / total) * 75);
    const team2Prob = Math.round((team2Score / total) * 75);
    const drawProb = 100 - team1Prob - team2Prob;

    elements.comparisonResult.innerHTML = `
        <div class="comparison-grid">
            <div class="comparison-team-card">
                <div class="comparison-team-header">
                    <div class="comparison-team-name">${team1.name || team1.team_name}</div>
                    <div class="comparison-team-score">${team1Score.toFixed(1)}</div>
                </div>
                <div class="comparison-stats">
                    <div class="comparison-stat-row">
                        <span class="comparison-stat-label">Físico</span>
                        <span class="comparison-stat-value">${getScore(team1, 'physical').toFixed(0)}</span>
                    </div>
                    <div class="comparison-stat-row">
                        <span class="comparison-stat-label">Técnico</span>
                        <span class="comparison-stat-value">${getScore(team1, 'technical').toFixed(0)}</span>
                    </div>
                    <div class="comparison-stat-row">
                        <span class="comparison-stat-label">Táctico</span>
                        <span class="comparison-stat-value">${getScore(team1, 'tactical').toFixed(0)}</span>
                    </div>
                </div>
            </div>
            
            <div class="comparison-verdict">
                <div class="verdict-title">Análisis</div>
                <div class="verdict-text">${prediction}</div>
                <div class="probability-bars">
                    <div class="prob-bar">
                        <span class="prob-label">${(team1.name || team1.team_name).substring(0, 10)}</span>
                        <div class="prob-track">
                            <div class="prob-fill home" style="width: ${team1Prob}%"></div>
                        </div>
                        <span class="prob-value">${team1Prob}%</span>
                    </div>
                    <div class="prob-bar">
                        <span class="prob-label">Empate</span>
                        <div class="prob-track">
                            <div class="prob-fill draw" style="width: ${drawProb}%"></div>
                        </div>
                        <span class="prob-value">${drawProb}%</span>
                    </div>
                    <div class="prob-bar">
                        <span class="prob-label">${(team2.name || team2.team_name).substring(0, 10)}</span>
                        <div class="prob-track">
                            <div class="prob-fill away" style="width: ${team2Prob}%"></div>
                        </div>
                        <span class="prob-value">${team2Prob}%</span>
                    </div>
                </div>
            </div>
            
            <div class="comparison-team-card">
                <div class="comparison-team-header">
                    <div class="comparison-team-name">${team2.name || team2.team_name}</div>
                    <div class="comparison-team-score">${team2Score.toFixed(1)}</div>
                </div>
                <div class="comparison-stats">
                    <div class="comparison-stat-row">
                        <span class="comparison-stat-label">Físico</span>
                        <span class="comparison-stat-value">${getScore(team2, 'physical').toFixed(0)}</span>
                    </div>
                    <div class="comparison-stat-row">
                        <span class="comparison-stat-label">Técnico</span>
                        <span class="comparison-stat-value">${getScore(team2, 'technical').toFixed(0)}</span>
                    </div>
                    <div class="comparison-stat-row">
                        <span class="comparison-stat-label">Táctico</span>
                        <span class="comparison-stat-value">${getScore(team2, 'tactical').toFixed(0)}</span>
                    </div>
                </div>
            </div>
        </div>
        
        <div class="chart-card" style="margin-top: 2rem;">
            <h3>Comparación de Métricas</h3>
            <canvas id="comparisonRadar"></canvas>
        </div>
    `;

    // Create radar chart
    setTimeout(() => {
        const radarCtx = document.getElementById('comparisonRadar');
        if (radarCtx) {
            createComparisonRadar(radarCtx, team1, team2);
        }
    }, 100);
}

// =============================================================================
// Team Modal
// =============================================================================
async function openTeamModal(teamId) {
    const team = state.teams.find(t => (t.id || t.team_id) === teamId);

    if (!team) {
        console.error('Team not found:', teamId);
        return;
    }

    const getScore = (key) => {
        if (key === 'overall') return team.overall_score || team.analysis?.overall_score || 70;
        const keyMap = { physical: 'physical_score', technical: 'technical_score', tactical: 'tactical_score' };
        return team[keyMap[key]] || team[key]?.[keyMap[key]] || team.analysis?.[key]?.[keyMap[key]] || 70;
    };

    const overallScore = getScore('overall');
    const physicalScore = getScore('physical');
    const technicalScore = getScore('technical');
    const tacticalScore = getScore('tactical');

    const status = overallScore >= 80 ? 'En Forma Óptima' : overallScore >= 70 ? 'Buen Estado' : overallScore >= 60 ? 'Estado Regular' : 'Necesita Mejorar';

    // Get injuries if available
    const injuries = team.injuries || team.physical?.injuries_list || [];
    const form = team.form?.form_string || team.tactical?.form_string || 'WDWDW';

    elements.modalBody.innerHTML = `
        <div class="team-detail-header">
            <div class="team-detail-name">${team.name || team.team_name}</div>
            <div class="team-detail-country">${team.country || ''}</div>
            <div class="team-detail-overall">
                <div class="overall-score-display">${overallScore.toFixed(1)}</div>
                <div class="overall-status-display">${status}</div>
            </div>
        </div>
        
        <div class="score-gauges">
            <div class="gauge">
                <div class="gauge-circle">
                    ${createGaugeSVG(physicalScore, 'physical')}
                    <span class="gauge-value">${physicalScore.toFixed(0)}</span>
                </div>
                <div class="gauge-label">Forma Física</div>
            </div>
            <div class="gauge">
                <div class="gauge-circle">
                    ${createGaugeSVG(technicalScore, 'technical')}
                    <span class="gauge-value">${technicalScore.toFixed(0)}</span>
                </div>
                <div class="gauge-label">Forma Técnica</div>
            </div>
            <div class="gauge">
                <div class="gauge-circle">
                    ${createGaugeSVG(tacticalScore, 'tactical')}
                    <span class="gauge-value">${tacticalScore.toFixed(0)}</span>
                </div>
                <div class="gauge-label">Forma Táctica</div>
            </div>
        </div>
        
        <div class="team-detail-section">
            <h4>Forma Reciente</h4>
            <div class="form-display">
                ${form.split('').map(r => `<div class="form-result ${r}">${r}</div>`).join('')}
            </div>
        </div>
        
        ${injuries.length > 0 ? `
        <div class="team-detail-section">
            <h4>Lesionados</h4>
            <div class="injuries-list">
                ${injuries.slice(0, 5).map(inj => `
                    <div class="injury-item">
                        <span class="injury-player">${inj.player_name || inj}</span>
                        <span class="injury-status">${inj.status || 'Lesionado'}</span>
                    </div>
                `).join('')}
            </div>
        </div>
        ` : ''}
    `;

    elements.teamModal.classList.add('active');
    document.body.style.overflow = 'hidden';
}

function closeModal() {
    elements.teamModal.classList.remove('active');
    document.body.style.overflow = '';
}

// =============================================================================
// Refresh
// =============================================================================
async function handleRefresh() {
    elements.refreshBtn.disabled = true;
    elements.refreshBtn.querySelector('.refresh-icon').style.animation = 'spin 1s linear infinite';

    try {
        await api.refreshData();
        await loadInitialData();

        // Reload current view
        navigateTo(state.currentView);
    } catch (error) {
        console.error('Refresh failed:', error);
        alert('Error al actualizar datos. Usando datos en caché.');
    } finally {
        elements.refreshBtn.disabled = false;
        elements.refreshBtn.querySelector('.refresh-icon').style.animation = '';
    }
}

// =============================================================================
// Utilities
// =============================================================================
function showLoading(container, type = 'default') {
    if (type === 'table') {
        container.innerHTML = `
            <tr>
                <td colspan="8" style="text-align: center; padding: 3rem;">
                    <div class="spinner"></div>
                    <p style="color: var(--text-muted); margin-top: 1rem;">Cargando datos...</p>
                </td>
            </tr>
        `;
    } else {
        container.innerHTML = `
            <div class="loading-placeholder">
                <div class="spinner"></div>
                <p>Cargando datos...</p>
            </div>
        `;
    }
}
