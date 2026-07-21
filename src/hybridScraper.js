const path = require('path');
const cheerio = require('cheerio');
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

const BROWSER_HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Accept-Language': 'de-DE,de;q=0.9,en-US;q=0.8,en;q=0.7'
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

// Extract Matchday Date Range from Soccerdonna / Transfermarkt
async function getMatchdayDateRange(league, matchday, targetYear) {
    const isSoccerdonna = league.source === 'soccerdonna';
    const baseUrl = isSoccerdonna ? (league.baseUrl || 'https://www.soccerdonna.de/de') : config.baseUrl;
    const compName = league.compName;
    const compCode = league.compCode;

    const urlsToTry = [];
    const yearInt = parseInt(targetYear) || 2026;

    if (isSoccerdonna) {
        urlsToTry.push(`${baseUrl}/${compName}/spieltagsuebersicht/wettbewerb_${compCode}_${yearInt}_${matchday}.html`);
        urlsToTry.push(`${baseUrl}/${compName}/spieltagsuebersicht/wettbewerb_${compCode}_${yearInt - 1}_${matchday}.html`);
        urlsToTry.push(`${baseUrl}/${compName}/spieltagsuebersicht/wettbewerb_${compCode}_${yearInt - 2}_${matchday}.html`);
    } else {
        const compType = league.compType || 'wettbewerb';
        urlsToTry.push(`${baseUrl}/${compName}/spieltag/${compType}/${compCode}/plus/?saison_id=${yearInt}&spieltag=${matchday}`);
        urlsToTry.push(`${baseUrl}/${compName}/spieltag/${compType}/${compCode}/plus/?saison_id=${yearInt - 1}&spieltag=${matchday}`);
        urlsToTry.push(`${baseUrl}/${compName}/spieltag/${compType}/${compCode}/plus/?saison_id=${yearInt - 2}&spieltag=${matchday}`);
    }

    for (const url of urlsToTry) {
        try {
            console.log(`[Hybrid Engine] Scanning Matchday ${matchday} Date Range from: ${url}`);
            const resp = await fetch(url, {
                redirect: 'follow',
                signal: AbortSignal.timeout(4000),
                headers: BROWSER_HEADERS
            });

            if (!resp.ok) continue;
            const html = await resp.text();
            const $ = cheerio.load(html);

            const dates = [];
            $('table.tabelle_grafik, tr.table-grosse-schrift, .box').each((i, el) => {
                const text = $(el).text().replace(/\s+/g, ' ');
                const m = text.match(/(\d{2}[\/\.]\d{2}[\/\.]\d{4})/);
                if (m) {
                    const cleanDateStr = m[1].replace(/\./g, '/');
                    const parts = cleanDateStr.split('/');
                    const yr = parseInt(parts[2]);
                    if (yr === yearInt) {
                        dates.push(cleanDateStr);
                    }
                }
            });

            if (dates.length > 0) {
                const parsedDates = dates.map(d => {
                    const [day, month, year] = d.split('/');
                    return new Date(`${year}-${month}-${day}T00:00:00Z`);
                }).filter(d => !isNaN(d.getTime()));

                if (parsedDates.length > 0) {
                    parsedDates.sort((a, b) => a - b);

                    // Subtract 1 day from start date to account for US timezone differences
                    const minDate = new Date(parsedDates[0].getTime() - (24 * 60 * 60 * 1000));
                    // Add 1 day to end date to catch overnight GMT matches
                    const maxDate = new Date(parsedDates[parsedDates.length - 1].getTime() + (24 * 60 * 60 * 1000));

                    const startStr = minDate.toISOString().slice(0, 10).replace(/-/g, '');
                    const endStr = maxDate.toISOString().slice(0, 10).replace(/-/g, '');

                    console.log(`[Hybrid Engine] Identified Date Range for Matchday ${matchday}: ${startStr} to ${endStr}`);
                    return { startStr, endStr };
                }
            }
        } catch (e) {
            console.warn(`[Hybrid Engine] Scan timeout for ${url}: ${e.message}`);
        }
    }

    return null;
}

// Fetch official matchday data from ESPN Scoreboard API matching date range
async function scrapeHybridMatchday(leagueKey, matchday, customYear) {
    const league = config.leagues[leagueKey];
    if (!league) throw new Error(`League ${leagueKey} not found.`);

    const targetYear = customYear || league.year || '2026';
    const slug = ESPN_SLUGS[leagueKey];

    // Step 1: Get exact Date Range for Matchday from Soccerdonna / Transfermarkt
    const dateRange = await getMatchdayDateRange(league, matchday, targetYear);

    if (dateRange && slug) {
        // Step 2: Fetch official match data from ESPN scoreboards for this exact date range
        const url = `https://site.api.espn.com/apis/site/v2/sports/soccer/${slug}/scoreboard?dates=${dateRange.startStr}-${dateRange.endStr}&limit=100`;
        console.log(`[Hybrid Engine] Querying ESPN Official Endpoint for ${leagueKey} Matchday ${matchday}: ${url}`);

        try {
            const resp = await fetch(url, {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
                },
                signal: AbortSignal.timeout(6000)
            });

            if (resp.ok) {
                const data = await resp.json();
                const events = data.events || [];

                if (events.length > 0) {
                    const matches = events.map(ev => {
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
                            matchday: `Jornada ${matchday}`,
                            day: caracasDT.toFormat('EEEE'),
                            date: caracasDT.toFormat('dd/MM/yyyy'),
                            time: caracasDT.toFormat('h:mm a'),
                            homeTeam,
                            awayTeam,
                            score: scoreStr
                        };
                    });

                    const cleanMatches = deduplicateMatchday(matches);
                    console.log(`[Hybrid Engine] ✅ Successfully retrieved ${cleanMatches.length} official matches for ${leagueKey} Matchday ${matchday}.`);
                    return cleanMatches;
                }
            }
        } catch (e) {
            console.warn(`[Hybrid Engine] ESPN API fetch failed: ${e.message}`);
        }
    }

    throw new Error(`No match data found for ${league.fileName || leagueKey} Matchday ${matchday} (Año ${targetYear}).`);
}

module.exports = { scrapeHybridMatchday };
