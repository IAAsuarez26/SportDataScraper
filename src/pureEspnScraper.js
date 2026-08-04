const path = require('path');
const { DateTime } = require(path.join(process.cwd(), 'node_modules/luxon'));
const config = require('./config');
const LEAGUE_DATE_MAPS = require('./dateMaps');

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

async function fetchWithRetry(url, options = {}, retries = 3, backoff = 1000) {
    for (let attempt = 1; attempt <= retries; attempt++) {
        try {
            const resp = await fetch(url, {
                ...options,
                signal: AbortSignal.timeout(options.timeout || 15000)
            });
            if (resp.ok) return resp;
            if (attempt === retries) {
                throw new Error(`HTTP ${resp.status} fetching ${url}`);
            }
            console.warn(`[Pure Engine] Attempt ${attempt}/${retries} returned HTTP ${resp.status} for ${url}. Retrying in ${backoff * attempt}ms...`);
        } catch (err) {
            if (attempt === retries) throw err;
            console.warn(`[Pure Engine] Attempt ${attempt}/${retries} failed for ${url} (${err.message}). Retrying in ${backoff * attempt}ms...`);
        }
        await new Promise(r => setTimeout(r, backoff * attempt));
    }
}

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

    const resp = await fetchWithRetry(url, {
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
        timeout: 15000
    }, 3, 1000);

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
            if (lastDate && (evDate - lastDate) > (3.5 * 24 * 60 * 60 * 1000)) {
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

async function scrapeEspnDateRange(leagueKey, startDateStr, endDateStr) {
    const league = config.leagues[leagueKey];
    if (!league) throw new Error(`League ${leagueKey} not found.`);

    const slug = ESPN_SLUGS[leagueKey];
    if (!slug) throw new Error(`Unknown ESPN slug for ${leagueKey}`);

    // Parse clean dates (YYYY-MM-DD or YYYYMMDD)
    const parseCleanDate = (s) => {
        const clean = s.replace(/-/g, '').trim();
        const y = parseInt(clean.slice(0, 4));
        const m = parseInt(clean.slice(4, 6));
        const d = parseInt(clean.slice(6, 8));
        return DateTime.fromObject({ year: y, month: m, day: d }, { zone: 'America/Caracas' });
    };

    const startDT = parseCleanDate(startDateStr);
    const endDT = parseCleanDate(endDateStr);

    // Query ESPN with a 1-day safety margin on both ends to account for UTC timezone offsets
    const searchStart = startDT.minus({ days: 1 }).toFormat('yyyyMMdd');
    const searchEnd = endDT.plus({ days: 1 }).toFormat('yyyyMMdd');

    const url = `https://site.api.espn.com/apis/site/v2/sports/soccer/${slug}/scoreboard?dates=${searchStart}-${searchEnd}&limit=1000`;
    console.log(`[Pure Engine] Fetching ${leagueKey} Date Range query (${searchStart} - ${searchEnd}): ${url}`);

    const resp = await fetchWithRetry(url, {
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
        timeout: 15000
    }, 3, 1000);

    const data = await resp.json();
    const events = data.events || [];

    if (events.length === 0) {
        console.warn(`[Pure Engine] No events found for ${leagueKey} in Date Range (${startDateStr} to ${endDateStr}).`);
        return [];
    }

    // Format display range
    const startDisplay = startDT.toFormat('dd/MM/yyyy');
    const endDisplay = endDT.toFormat('dd/MM/yyyy');
    const matchdayLabel = startDisplay === endDisplay ? `Fecha ${startDisplay}` : `Fechas ${startDisplay} - ${endDisplay}`;

    // Filter events strictly by Caracas local date
    const startISO = startDT.toFormat('yyyy-MM-dd');
    const endISO = endDT.toFormat('yyyy-MM-dd');

    const matches = [];

    events.forEach(ev => {
        const comp = ev.competitions[0];
        const homeTeam = comp.competitors.find(c => c.homeAway === 'home')?.team?.displayName || 'N/A';
        const awayTeam = comp.competitors.find(c => c.homeAway === 'away')?.team?.displayName || 'N/A';

        const homeScore = comp.competitors.find(c => c.homeAway === 'home')?.score;
        const awayScore = comp.competitors.find(c => c.homeAway === 'away')?.score;

        const isCompleted = comp.status?.type?.completed;
        const scoreStr = isCompleted && homeScore !== undefined && awayScore !== undefined ? `${homeScore}:${awayScore}` : '';

        const utcDT = DateTime.fromISO(ev.date, { zone: 'utc' });
        const caracasDT = utcDT.setZone('America/Caracas');
        const matchCaracasISO = caracasDT.toFormat('yyyy-MM-dd');

        // Include match strictly if its Caracas date falls within requested [startISO, endISO]
        if (matchCaracasISO >= startISO && matchCaracasISO <= endISO) {
            matches.push({
                matchday: matchdayLabel,
                day: caracasDT.toFormat('EEEE'),
                date: caracasDT.toFormat('dd/MM/yyyy'),
                time: caracasDT.toFormat('h:mm a'),
                homeTeam,
                awayTeam,
                score: scoreStr,
                _rawDate: ev.date
            });
        }
    });

    // Sort chronologically
    matches.sort((a, b) => new Date(a._rawDate) - new Date(b._rawDate));
    matches.forEach(m => delete m._rawDate);

    const clean = deduplicateMatchday(matches);
    console.log(`[Pure Engine] ✅ Successfully retrieved ${clean.length} official matches for ${leagueKey} strictly in Caracas date range (${startISO} to ${endISO}).`);
    return clean;
}


module.exports = { scrapePureEspnMatchday, scrapeEspnDateRange };

