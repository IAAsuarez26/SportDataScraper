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

function deduplicateMatchday(matches) {
    if (!matches || matches.length <= 1) return matches;
    const seenTeams = new Set();
    const cleanMatches = [];

    for (let i = matches.length - 1; i >= 0; i--) {
        const m = matches[i];
        if (seenTeams.has(m.homeTeam) || seenTeams.has(m.awayTeam)) {
            continue;
        }
        seenTeams.add(m.homeTeam);
        seenTeams.add(m.awayTeam);
        cleanMatches.unshift(m);
    }
    return cleanMatches;
}

// Pre-calculated official Matchday Calendar Date Maps for major leagues (2026)
const LEAGUE_DATE_MAPS = {
    nwsl_2026: {
        1: { start: '20260313', end: '20260316' },
        2: { start: '20260320', end: '20260323' },
        3: { start: '20260327', end: '20260330' },
        4: { start: '20260417', end: '20260420' },
        5: { start: '20260424', end: '20260427' },
        6: { start: '20260501', end: '20260504' },
        7: { start: '20260508', end: '20260511' },
        8: { start: '20260515', end: '20260518' },
        9: { start: '20260522', end: '20260525' },
        10: { start: '20260605', end: '20260608' },
        11: { start: '20260612', end: '20260615' },
        12: { start: '20260619', end: '20260622' },
        13: { start: '20260626', end: '20260629' },
        14: { start: '20260724', end: '20260728' },
        15: { start: '20260731', end: '20260804' },
        16: { start: '20260821', end: '20260824' },
        17: { start: '20260828', end: '20260831' },
        18: { start: '20260904', end: '20260907' },
        19: { start: '20260911', end: '20260914' },
        20: { start: '20260918', end: '20260921' },
        21: { start: '20260925', end: '20260928' },
        22: { start: '20261002', end: '20261005' },
        23: { start: '20261009', end: '20261012' },
        24: { start: '20261016', end: '20261019' },
        25: { start: '20261023', end: '20261026' },
        26: { start: '20261101', end: '20261104' }
    }
};

const espnCache = {};

async function scrapePureEspnMatchday(leagueKey, matchdayNum, customYear) {
    const league = config.leagues[leagueKey];
    if (!league) throw new Error(`League ${leagueKey} not found.`);

    const targetYear = customYear || league.year || '2026';
    const slug = ESPN_SLUGS[leagueKey];
    if (!slug) throw new Error(`Unknown ESPN slug for ${leagueKey}`);

    const mapKey = `${leagueKey}_${targetYear}`;
    const dateMap = LEAGUE_DATE_MAPS[mapKey] ? LEAGUE_DATE_MAPS[mapKey][matchdayNum] : null;

    let url = '';
    if (dateMap) {
        url = `https://site.api.espn.com/apis/site/v2/sports/soccer/${slug}/scoreboard?dates=${dateMap.start}-${dateMap.end}&limit=100`;
        console.log(`[Pure Engine] Fetching ${leagueKey} Matchday ${matchdayNum} via Date Map (${dateMap.start}-${dateMap.end}): ${url}`);
    } else {
        url = `https://site.api.espn.com/apis/site/v2/sports/soccer/${slug}/scoreboard?dates=${targetYear}&limit=1000`;
        console.log(`[Pure Engine] Fetching ${leagueKey} full schedule for Year ${targetYear}: ${url}`);
    }

    const resp = await fetch(url, {
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
        signal: AbortSignal.timeout(6000)
    });

    if (!resp.ok) throw new Error(`HTTP ${resp.status} fetching ${url}`);
    const data = await resp.json();
    const events = data.events || [];

    if (events.length === 0) throw new Error(`No events found for ${leagueKey} Matchday ${matchdayNum} (${targetYear})`);

    let matchEvents = events;

    if (!dateMap) {
        // Sort chronologically and group into weekend rounds
        events.sort((a, b) => new Date(a.date) - new Date(b.date));
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

        const rIdx = parseInt(matchdayNum) - 1;
        if (rIdx >= 0 && rIdx < rounds.length) {
            matchEvents = rounds[rIdx];
        } else {
            throw new Error(`Matchday ${matchdayNum} out of range (found ${rounds.length} rounds).`);
        }
    }

    const matches = matchEvents.map(ev => {
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

    const clean = deduplicateMatchday(matches);
    console.log(`[Pure Engine] ✅ Successfully retrieved ${clean.length} official matches for ${leagueKey} Matchday ${matchdayNum}.`);
    return clean;
}

module.exports = { scrapePureEspnMatchday };
