/**
 * API Client for UCL Squad Analyzer
 * Handles all communication with the backend API
 */

const API_BASE_URL = 'http://localhost:8000';

class APIClient {
    constructor() {
        this.baseUrl = API_BASE_URL;
        this.cache = new Map();
        this.cacheTimeout = 5 * 60 * 1000; // 5 minutes
    }

    /**
     * Make an HTTP request to the API
     */
    async request(endpoint, options = {}) {
        const url = `${this.baseUrl}${endpoint}`;

        // Check cache for GET requests
        if (!options.method || options.method === 'GET') {
            const cached = this.getFromCache(endpoint);
            if (cached) return cached;
        }

        try {
            const response = await fetch(url, {
                headers: {
                    'Content-Type': 'application/json',
                    ...options.headers
                },
                ...options
            });

            if (!response.ok) {
                throw new Error(`API Error: ${response.status} ${response.statusText}`);
            }

            const data = await response.json();

            // Cache successful GET responses
            if (!options.method || options.method === 'GET') {
                this.setCache(endpoint, data);
            }

            return data;
        } catch (error) {
            console.error('API Request failed:', error);
            throw error;
        }
    }

    getFromCache(key) {
        const cached = this.cache.get(key);
        if (cached && Date.now() - cached.timestamp < this.cacheTimeout) {
            return cached.data;
        }
        return null;
    }

    setCache(key, data) {
        this.cache.set(key, { data, timestamp: Date.now() });
    }

    clearCache() {
        this.cache.clear();
    }

    // ==========================================================================
    // API Methods
    // ==========================================================================

    /**
     * Get all teams with basic info
     */
    async getTeams() {
        return this.request('/api/teams');
    }

    /**
     * Get detailed analysis for a specific team
     */
    async getTeamDetail(teamId) {
        return this.request(`/api/teams/${teamId}`);
    }

    /**
     * Get team rankings
     */
    async getRankings(sortBy = 'overall') {
        return this.request(`/api/rankings?sort_by=${sortBy}`);
    }

    /**
     * Get standings
     */
    async getStandings() {
        return this.request('/api/standings');
    }

    /**
     * Get upcoming fixtures with predictions
     */
    async getFixtures() {
        return this.request('/api/fixtures');
    }

    /**
     * Compare multiple teams
     */
    async compareTeams(teamIds) {
        return this.request('/api/compare', {
            method: 'POST',
            body: JSON.stringify({ team_ids: teamIds })
        });
    }

    /**
     * Predict match outcome
     */
    async predictMatch(homeTeamId, awayTeamId) {
        return this.request('/api/predict', {
            method: 'POST',
            body: JSON.stringify({
                home_team_id: homeTeamId,
                away_team_id: awayTeamId
            })
        });
    }

    /**
     * Refresh all data from sources
     */
    async refreshData() {
        this.clearCache();
        return this.request('/api/refresh', { method: 'POST' });
    }

    /**
     * Health check
     */
    async healthCheck() {
        return this.request('/health');
    }
}

// Create singleton instance
const api = new APIClient();

// =============================================================================
// Mock Data (fallback when API is not available)
// =============================================================================

const mockTeams = [
    { id: "real-madrid", name: "Real Madrid", short_name: "RMA", country: "Spain", overall_score: 87.5, physical_score: 82, technical_score: 92, tactical_score: 86 },
    { id: "man-city", name: "Manchester City", short_name: "MCI", country: "England", overall_score: 86.2, physical_score: 85, technical_score: 90, tactical_score: 83 },
    { id: "bayern-munich", name: "Bayern Munich", short_name: "BAY", country: "Germany", overall_score: 85.8, physical_score: 88, technical_score: 86, tactical_score: 84 },
    { id: "arsenal", name: "Arsenal", short_name: "ARS", country: "England", overall_score: 84.5, physical_score: 86, technical_score: 85, tactical_score: 82 },
    { id: "liverpool", name: "Liverpool", short_name: "LIV", country: "England", overall_score: 84.0, physical_score: 78, technical_score: 88, tactical_score: 85 },
    { id: "barcelona", name: "Barcelona", short_name: "BAR", country: "Spain", overall_score: 83.5, physical_score: 75, technical_score: 89, tactical_score: 84 },
    { id: "psg", name: "Paris Saint-Germain", short_name: "PSG", country: "France", overall_score: 82.8, physical_score: 80, technical_score: 87, tactical_score: 80 },
    { id: "inter-milan", name: "Inter Milan", short_name: "INT", country: "Italy", overall_score: 81.5, physical_score: 83, technical_score: 82, tactical_score: 80 },
    { id: "dortmund", name: "Borussia Dortmund", short_name: "BVB", country: "Germany", overall_score: 80.2, physical_score: 81, technical_score: 80, tactical_score: 79 },
    { id: "atletico-madrid", name: "Atlético Madrid", short_name: "ATM", country: "Spain", overall_score: 79.8, physical_score: 84, technical_score: 76, tactical_score: 80 },
    { id: "juventus", name: "Juventus", short_name: "JUV", country: "Italy", overall_score: 78.5, physical_score: 80, technical_score: 78, tactical_score: 78 },
    { id: "chelsea", name: "Chelsea", short_name: "CHE", country: "England", overall_score: 77.8, physical_score: 72, technical_score: 80, tactical_score: 79 },
    { id: "tottenham", name: "Tottenham Hotspur", short_name: "TOT", country: "England", overall_score: 76.5, physical_score: 79, technical_score: 77, tactical_score: 74 },
    { id: "napoli", name: "Napoli", short_name: "NAP", country: "Italy", overall_score: 76.0, physical_score: 78, technical_score: 76, tactical_score: 74 },
    { id: "leverkusen", name: "Bayer Leverkusen", short_name: "B04", country: "Germany", overall_score: 78.2, physical_score: 82, technical_score: 78, tactical_score: 75 },
    { id: "atalanta", name: "Atalanta", short_name: "ATA", country: "Italy", overall_score: 75.5, physical_score: 80, technical_score: 74, tactical_score: 73 },
    { id: "benfica", name: "Benfica", short_name: "SLB", country: "Portugal", overall_score: 74.8, physical_score: 77, technical_score: 74, tactical_score: 73 },
    { id: "sporting-cp", name: "Sporting CP", short_name: "SCP", country: "Portugal", overall_score: 73.5, physical_score: 76, technical_score: 72, tactical_score: 73 },
    { id: "newcastle", name: "Newcastle United", short_name: "NEW", country: "England", overall_score: 73.0, physical_score: 78, technical_score: 71, tactical_score: 71 },
    { id: "ajax", name: "Ajax Amsterdam", short_name: "AJA", country: "Netherlands", overall_score: 72.5, physical_score: 74, technical_score: 73, tactical_score: 70 },
    { id: "psv", name: "PSV Eindhoven", short_name: "PSV", country: "Netherlands", overall_score: 71.8, physical_score: 75, technical_score: 70, tactical_score: 71 },
    { id: "monaco", name: "AS Monaco", short_name: "MON", country: "France", overall_score: 71.0, physical_score: 73, technical_score: 71, tactical_score: 69 },
    { id: "marseille", name: "Marseille", short_name: "OM", country: "France", overall_score: 70.5, physical_score: 72, technical_score: 70, tactical_score: 69 },
    { id: "club-brugge", name: "Club Brugge", short_name: "BRU", country: "Belgium", overall_score: 69.8, physical_score: 73, technical_score: 68, tactical_score: 68 },
    { id: "celtic", name: "Celtic", short_name: "CEL", country: "Scotland", overall_score: 69.0, physical_score: 72, technical_score: 67, tactical_score: 68 },
    { id: "feyenoord", name: "Feyenoord", short_name: "FEY", country: "Netherlands", overall_score: 68.5, physical_score: 71, technical_score: 67, tactical_score: 68 },
    { id: "frankfurt", name: "Eintracht Frankfurt", short_name: "SGE", country: "Germany", overall_score: 68.0, physical_score: 70, technical_score: 67, tactical_score: 67 },
    { id: "galatasaray", name: "Galatasaray", short_name: "GAL", country: "Turkey", overall_score: 67.5, physical_score: 69, technical_score: 67, tactical_score: 66 },
    { id: "copenhagen", name: "FC Copenhagen", short_name: "FCK", country: "Denmark", overall_score: 66.0, physical_score: 68, technical_score: 64, tactical_score: 66 },
    { id: "olympiacos", name: "Olympiacos", short_name: "OLY", country: "Greece", overall_score: 65.5, physical_score: 67, technical_score: 64, tactical_score: 66 },
    { id: "slavia-prague", name: "Slavia Prague", short_name: "SLP", country: "Czech Republic", overall_score: 64.0, physical_score: 66, technical_score: 62, tactical_score: 64 },
    { id: "athletic-club", name: "Athletic Club", short_name: "ATH", country: "Spain", overall_score: 70.0, physical_score: 76, technical_score: 68, tactical_score: 67 },
    { id: "bodo-glimt", name: "Bodø/Glimt", short_name: "BOD", country: "Norway", overall_score: 63.5, physical_score: 68, technical_score: 60, tactical_score: 63 },
    { id: "union-sg", name: "Union St.-Gilloise", short_name: "USG", country: "Belgium", overall_score: 62.0, physical_score: 65, technical_score: 60, tactical_score: 61 },
    { id: "qarabag", name: "FK Qarabag", short_name: "QAR", country: "Azerbaijan", overall_score: 60.5, physical_score: 63, technical_score: 58, tactical_score: 61 },
    { id: "pafos", name: "Pafos", short_name: "PAF", country: "Cyprus", overall_score: 58.0, physical_score: 60, technical_score: 56, tactical_score: 58 },
];

const mockFixtures = [
    { home_team: "Real Madrid", away_team: "Liverpool", favorite: "Real Madrid", confidence: "Moderate", home_win: 42, draw: 28, away_win: 30 },
    { home_team: "Barcelona", away_team: "Bayern Munich", favorite: "Even Match", confidence: "Low", home_win: 35, draw: 30, away_win: 35 },
    { home_team: "Arsenal", away_team: "PSG", favorite: "Arsenal", confidence: "Moderate", home_win: 45, draw: 27, away_win: 28 },
    { home_team: "Manchester City", away_team: "Inter Milan", favorite: "Manchester City", confidence: "High", home_win: 55, draw: 25, away_win: 20 },
    { home_team: "Juventus", away_team: "Atlético Madrid", favorite: "Even Match", confidence: "Low", home_win: 38, draw: 30, away_win: 32 },
    { home_team: "Chelsea", away_team: "Dortmund", favorite: "Dortmund", confidence: "Moderate", home_win: 32, draw: 28, away_win: 40 },
];

/**
 * Get mock or real data based on API availability
 */
async function fetchData(apiFn, mockData) {
    try {
        const result = await apiFn();
        return result;
    } catch (error) {
        console.warn('API unavailable, using mock data:', error.message);
        return mockData;
    }
}

// Export for use in other scripts
window.api = api;
window.mockTeams = mockTeams;
window.mockFixtures = mockFixtures;
window.fetchData = fetchData;
