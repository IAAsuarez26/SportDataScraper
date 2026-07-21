const path = require('path');
const { DateTime } = require(path.join(process.cwd(), 'node_modules/luxon'));
const config = require('./config');

const ESPN_SLUGS = {
    mls: 'usa.1',
    nwsl: 'usa.nwsl',
    bundesliga: 'ger.1',
    premier: 'eng.1',
    calcio: 'ita.1',
    la_liga: 'esp.1',
    france: 'fra.1',
    champions: 'uefa.champions'
};

const espnCache = {};

async function fetchEspnMatchday(leagueKey, matchdayNum, targetYear) {
    const slug = ESPN_SLUGS[leagueKey];
    if (!slug) return null;

    const cacheKey = `${leagueKey}_${targetYear}`;
    let matchdayRounds = espnCache[cacheKey];

    if (!matchdayRounds) {
        const url = `https://site.api.espn.com/apis/site/v2/sports/soccer/${slug}/scoreboard?dates=${targetYear}&limit=1000`;
        console.log(`[ESPN Engine] Fetching full schedule for ${leagueKey} (${slug}) Year ${targetYear}...`);

        try {
            const resp = await fetch(url, {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
                },
                signal: AbortSignal.timeout(8000)
            });

            if (!resp.ok) return null;
            const data = await resp.json();
            const events = data.events || [];

            if (events.length === 0) return null;

            // Sort events chronologically
            events.sort((a, b) => new Date(a.date) - new Date(b.date));

            // Group events into matchday rounds based on date clusters (> 4 days gap starts a new round)
            const rounds = [];
            let currentRound = [];
            let lastDate = null;

            events.forEach(ev => {
                const evDate = new Date(ev.date);
                if (lastDate && (evDate - lastDate) > (4 * 24 * 60 * 60 * 1000)) {
                    if (currentRound.length > 0) {
                        rounds.push(currentRound);
                        currentRound = [];
                    }
                }
                currentRound.push(ev);
                lastDate = evDate;
            });
            if (currentRound.length > 0) rounds.push(currentRound);

            espnCache[cacheKey] = rounds;
            matchdayRounds = rounds;
        } catch (e) {
            console.warn(`[ESPN Engine] Fetch failed for ${leagueKey}: ${e.message}`);
            return null;
        }
    }

    const roundIndex = parseInt(matchdayNum) - 1;
    if (!matchdayRounds || roundIndex < 0 || roundIndex >= matchdayRounds.length) {
        console.warn(`[ESPN Engine] Matchday ${matchdayNum} out of bounds (Total rounds: ${matchdayRounds ? matchdayRounds.length : 0})`);
        return null;
    }

    const rawEvents = matchdayRounds[roundIndex];
    const results = rawEvents.map(ev => {
        const comp = ev.competitions[0];
        const homeTeam = comp.competitors.find(c => c.homeAway === 'home')?.team?.displayName || 'N/A';
        const awayTeam = comp.competitors.find(c => c.homeAway === 'away')?.team?.displayName || 'N/A';

        const homeScore = comp.competitors.find(c => c.homeAway === 'home')?.score;
        const awayScore = comp.competitors.find(c => c.homeAway === 'away')?.score;

        const isCompleted = comp.status?.type?.completed;
        const scoreStr = isCompleted && homeScore !== undefined && awayScore !== undefined ? `${homeScore}:${awayScore}` : '';

        const utcDT = DateTime.fromISO(ev.date, { zone: 'utc' });
        const caracasDT = utcDT.setZone('America/Caracas');

        return {
            matchday: `Jornada ${matchdayNum}`,
            day: caracasDT.toFormat('EEEE'),
            date: caracasDT.toFormat('dd/MM/yyyy'),
            time: caracasDT.toFormat('h:mm a'),
            homeTeam,
            awayTeam,
            score: scoreStr
        };
    });

    console.log(`[ESPN Engine] Successfully retrieved ${results.length} matches for ${leagueKey} Matchday ${matchdayNum}.`);
    return results;
}

module.exports = { fetchEspnMatchday };
