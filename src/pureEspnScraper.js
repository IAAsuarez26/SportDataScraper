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

const ESPN_HOSTS = [
    'https://site.api.espn.com',
    'https://site.web.api.espn.com'
];

const USER_AGENTS = [
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:125.0) Gecko/20100101 Firefox/125.0',
    'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36 Edg/123.0.0.0'
];

function getBrowserHeaders(index = 0) {
    const ua = USER_AGENTS[index % USER_AGENTS.length];
    return {
        'User-Agent': ua,
        'Accept': 'application/json, text/plain, */*',
        'Accept-Language': 'es-ES,es;q=0.9,en-US;q=0.8,en;q=0.7',
        'Referer': 'https://www.espn.com/',
        'Origin': 'https://www.espn.com',
        'Sec-Ch-Ua': '"Chromium";v="124", "Google Chrome";v="124", "Not-A.Brand";v="99"',
        'Sec-Ch-Ua-Mobile': '?0',
        'Sec-Ch-Ua-Platform': '"Windows"',
        'Sec-Fetch-Dest': 'empty',
        'Sec-Fetch-Mode': 'cors',
        'Sec-Fetch-Site': 'same-site'
    };
}

async function fetchEspnWithFallback(endpointPath, retriesPerHost = 2, backoff = 800) {
    let lastError = null;

    for (let hostIdx = 0; hostIdx < ESPN_HOSTS.length; hostIdx++) {
        const host = ESPN_HOSTS[hostIdx];
        const url = `${host}${endpointPath}`;

        for (let attempt = 1; attempt <= retriesPerHost; attempt++) {
            try {
                const headers = getBrowserHeaders(hostIdx * 3 + attempt);
                const resp = await fetch(url, {
                    headers,
                    signal: AbortSignal.timeout(12000)
                });

                if (resp.ok) {
                    return await resp.json();
                }

                console.warn(`[ESPN Engine] Host ${host} returned HTTP ${resp.status} (attempt ${attempt}/${retriesPerHost}).`);
                lastError = new Error(`HTTP ${resp.status} fetching ${url}`);

                // If 403 or 429, don't repeat on the exact same blocked host immediately; try next host
                if (resp.status === 403 || resp.status === 429) {
                    break;
                }
            } catch (err) {
                console.warn(`[ESPN Engine] Host ${host} failed: ${err.message} (attempt ${attempt}/${retriesPerHost}).`);
                lastError = err;
            }
            await new Promise(r => setTimeout(r, backoff * attempt));
        }
    }

    throw lastError || new Error(`Failed to fetch from all ESPN endpoints: ${endpointPath}`);
}

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

function deduplicateDateRange(matches) {
    if (!matches || matches.length <= 1) return matches;
    const seen = new Set();
    const cleanMatches = [];

    for (const m of matches) {
        const key = `${m.date}_${m.time}_${m.homeTeam}_${m.awayTeam}`;
        if (!seen.has(key)) {
            seen.add(key);
            cleanMatches.push(m);
        }
    }
    return cleanMatches;
}

async function scrapePureEspnMatchday(leagueKey, matchdayNum, customYear) {
    const league = config.leagues[leagueKey];
    if (!league) throw new Error(`League ${leagueKey} not found.`);

    const targetYear = customYear || league.year || '2026';
    const slug = ESPN_SLUGS[leagueKey];
    if (!slug) throw new Error(`Unknown ESPN slug for ${leagueKey}`);

    const mapKey = `${leagueKey}_${targetYear}`;
    const dateMap = LEAGUE_DATE_MAPS[mapKey] ? LEAGUE_DATE_MAPS[mapKey][matchdayNum] : null;

    let endpoint = '';
    if (dateMap) {
        endpoint = `/apis/site/v2/sports/soccer/${slug}/scoreboard?dates=${dateMap.start}-${dateMap.end}&limit=100`;
        console.log(`[Pure Engine] Fetching ${leagueKey} Matchday ${matchdayNum} via Date Map (${dateMap.start}-${dateMap.end}): ${endpoint}`);
    } else {
        endpoint = `/apis/site/v2/sports/soccer/${slug}/scoreboard?dates=${targetYear}&limit=1000`;
        console.log(`[Pure Engine] Fetching ${leagueKey} full schedule for Year ${targetYear}: ${endpoint}`);
    }

    const data = await fetchEspnWithFallback(endpoint);
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

    if (!startDT.isValid || !endDT.isValid) {
        throw new Error(`Invalid date range format: ${startDateStr} to ${endDateStr}`);
    }

    // Query ESPN with a 1-day safety margin on both ends to account for UTC timezone offsets
    const searchStart = startDT.minus({ days: 1 }).toFormat('yyyyMMdd');
    const searchEnd = endDT.plus({ days: 1 }).toFormat('yyyyMMdd');

    const endpoint = `/apis/site/v2/sports/soccer/${slug}/scoreboard?dates=${searchStart}-${searchEnd}&limit=1000`;
    console.log(`[Pure Engine] Fetching ${leagueKey} Date Range query (${searchStart} - ${searchEnd}): ${endpoint}`);

    let events = [];

    try {
        const data = await fetchEspnWithFallback(endpoint);
        events = data.events || [];
    } catch (rangeErr) {
        console.warn(`[Pure Engine] Multi-day range query failed (${rangeErr.message}). Falling back to day-by-day queries...`);
        // Fallback: Query day-by-day
        const dayEvents = [];
        let curr = startDT.minus({ days: 1 });
        const last = endDT.plus({ days: 1 });

        while (curr <= last) {
            const dayStr = curr.toFormat('yyyyMMdd');
            const dayEndpoint = `/apis/site/v2/sports/soccer/${slug}/scoreboard?dates=${dayStr}&limit=100`;
            try {
                const dayData = await fetchEspnWithFallback(dayEndpoint, 1, 400);
                if (dayData && dayData.events && dayData.events.length > 0) {
                    dayEvents.push(...dayData.events);
                }
            } catch (dayErr) {
                console.warn(`[Pure Engine] Day query failed for ${dayStr}: ${dayErr.message}`);
            }
            curr = curr.plus({ days: 1 });
        }
        events = dayEvents;
    }

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

    const clean = deduplicateDateRange(matches);
    console.log(`[Pure Engine] ✅ Successfully retrieved ${clean.length} official matches for ${leagueKey} strictly in Caracas date range (${startISO} to ${endISO}).`);
    return clean;
}

module.exports = { scrapePureEspnMatchday, scrapeEspnDateRange, fetchEspnWithFallback, getBrowserHeaders };
