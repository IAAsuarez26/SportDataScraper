const cheerio = require('cheerio');
const config = require('./config');

const BROWSER_HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
    'Accept-Language': 'en-GB,en-US;q=0.9,en;q=0.8,de;q=0.7',
    'Cache-Control': 'no-cache',
    'Pragma': 'no-cache',
    'Sec-Ch-Ua': '"Not_A Brand";v="8", "Chromium";v="120", "Google Chrome";v="120"',
    'Sec-Ch-Ua-Mobile': '?0',
    'Sec-Ch-Ua-Platform': '"Windows"'
};

function filterMatchesByYear(matches, targetYear) {
    if (!matches || matches.length === 0) return [];
    if (!targetYear) return matches;

    const reqYear = parseInt(targetYear);
    if (isNaN(reqYear)) return matches;

    return matches.filter(m => {
        if (!m.date) return true; // Keep matches without dates if future/unscheduled
        const parts = m.date.split('/');
        if (parts.length < 3) return true;
        const matchYear = parseInt(parts[2]);
        if (isNaN(matchYear)) return true;

        // Strict Year Filter: Match year MUST match requested targetYear
        return matchYear === reqYear;
    });
}

function deduplicateMatchday(matches) {
    if (!matches || matches.length <= 1) return matches;

    // Rule: In any official league matchday, a team CANNOT play twice.
    // If a portal includes mid-week catch-up/rescheduled games alongside main matchday fixtures,
    // filter out duplicate team appearances so each team plays at most once per matchday.
    const seenTeams = new Set();
    const cleanMatches = [];

    // Iterate backwards (from main round to earlier rescheduled games)
    for (let i = matches.length - 1; i >= 0; i--) {
        const m = matches[i];
        if (seenTeams.has(m.homeTeam) || seenTeams.has(m.awayTeam)) {
            console.log(`[Deduplicator] Skipping duplicate matchday fixture: ${m.homeTeam} vs ${m.awayTeam} (Date: ${m.date})`);
            continue;
        }
        seenTeams.add(m.homeTeam);
        seenTeams.add(m.awayTeam);
        cleanMatches.unshift(m);
    }

    return cleanMatches;
}

async function scrapeTransfermarktHTTP(league, matchday, targetYear) {
    const compName = league.compName;
    const compCode = league.compCode;
    const compType = league.compType || 'wettbewerb';
    const baseUrl = config.baseUrl;

    const urlsToTry = [];
    if (targetYear) {
        const yearInt = parseInt(targetYear) || 2026;
        urlsToTry.push(`${baseUrl}/${compName}/spieltag/${compType}/${compCode}/plus/?saison_id=${yearInt}&spieltag=${matchday}`);
        urlsToTry.push(`${baseUrl}/${compName}/spieltag/${compType}/${compCode}/plus/?saison_id=${yearInt - 1}&spieltag=${matchday}`);
        urlsToTry.push(`${baseUrl}/${compName}/spieltag/${compType}/${compCode}/plus/?saison_id=${yearInt - 2}&spieltag=${matchday}`);
        urlsToTry.push(`${baseUrl}/${compName}/spieltag/${compType}/${compCode}/plus/?saison_id=${yearInt + 1}&spieltag=${matchday}`);
    }
    urlsToTry.push(`${baseUrl}/${compName}/spieltag/${compType}/${compCode}/plus/?spieltag=${matchday}`);

    for (const url of urlsToTry) {
        try {
            console.log(`[HTTP Scraper] Navigating to: ${url}`);
            const resp = await fetch(url, {
                redirect: 'follow',
                signal: AbortSignal.timeout(8000),
                headers: BROWSER_HEADERS
            });

            if (!resp.ok) continue;
            const html = await resp.text();
            const $ = cheerio.load(html);

            const boxes = $('.box').toArray();
            const results = [];

            boxes.forEach(box => {
                const matchRow = $(box).find('tr.table-grosse-schrift');
                if (matchRow.length === 0) return;

                const homeTeamCell = matchRow.find('td.rechts.hauptlink.spieltagsansicht-vereinsname');
                const awayTeamCell = matchRow.find('td:not(.rechts).hauptlink.spieltagsansicht-vereinsname');
                const scoreCell = matchRow.find('td.zentriert.hauptlink.spieltagsansicht-ergebnis');

                if (homeTeamCell.length && awayTeamCell.length && scoreCell.length) {
                    const getTeamName = (cell) => {
                        const links = cell.find('a').toArray();
                        const teamLink = links.find(a => $(a).find('img').length === 0 && !$(a).attr('href').includes('/forum/'));
                        return teamLink ? $(teamLink).text().trim() : 'N/A';
                    };

                    const scoreLink = scoreCell.find('a');
                    const scoreText = scoreLink.length ? scoreLink.text().trim() : 'TBD';

                    const boxText = $(box).text().replace(/\s+/g, ' ');

                    const dateTimeMatch = boxText.match(/(?:Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday|Mon|Tue|Wed|Thu|Fri|Sat|Sun)?,?\s*(\d{2}[\/\.]\d{2}[\/\.]\d{2,4})\s*-\s*(\d{1,2}:\d{2}\s?(?:AM|PM|Uhr)?)/i)
                        || boxText.match(/(\d{2}[\/\.]\d{2}[\/\.]\d{2,4})/);

                    let matchDate = '';
                    let matchTime = '';
                    if (dateTimeMatch) {
                        matchDate = dateTimeMatch[1].replace(/\./g, '/');
                        if (dateTimeMatch[2]) matchTime = dateTimeMatch[2];
                    }

                    const dayMatch = boxText.match(/(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday)/i);
                    const dayName = dayMatch ? dayMatch[0] : '';

                    results.push({
                        matchday: `Jornada ${matchday}`,
                        day: dayName,
                        date: matchDate,
                        time: matchTime,
                        homeTeam: getTeamName(homeTeamCell),
                        awayTeam: getTeamName(awayTeamCell),
                        score: scoreText === '-:-' ? 'TBD' : scoreText
                    });
                }
            });

            if (results.length > 0) {
                const validResults = filterMatchesByYear(results, targetYear);
                if (validResults.length > 0) {
                    console.log(`[HTTP Scraper] Successfully extracted ${validResults.length} matches matching target year ${targetYear}.`);
                    return validResults;
                } else {
                    console.warn(`[HTTP Scraper] Discarded ${results.length} matches from ${url} because their dates do not match requested year ${targetYear}.`);
                }
            }
        } catch (err) {
            console.warn(`[HTTP Scraper] Error fetching ${url}: ${err.message}`);
        }
    }

    return [];
}

async function scrapeSoccerdonnaHTTP(league, matchday, targetYear) {
    const compName = league.compName;
    const compCode = league.compCode;
    const baseUrl = league.baseUrl || 'https://www.soccerdonna.de/de';

    const urlsToTry = [];
    if (targetYear) {
        const yearInt = parseInt(targetYear) || 2026;
        urlsToTry.push(`${baseUrl}/${compName}/spieltagsuebersicht/wettbewerb_${compCode}_${yearInt}_${matchday}.html`);
        urlsToTry.push(`${baseUrl}/${compName}/spieltagsuebersicht/wettbewerb_${compCode}_${yearInt - 1}_${matchday}.html`);
        urlsToTry.push(`${baseUrl}/${compName}/spieltagsuebersicht/wettbewerb_${compCode}_${yearInt - 2}_${matchday}.html`);
        urlsToTry.push(`${baseUrl}/${compName}/spieltagsuebersicht/wettbewerb_${compCode}_${yearInt + 1}_${matchday}.html`);
    }
    urlsToTry.push(`${baseUrl}/${compName}/spieltagsuebersicht/wettbewerb_${compCode}_${matchday}.html`);

    for (const url of urlsToTry) {
        try {
            console.log(`[HTTP Scraper] Navigating to: ${url}`);
            const resp = await fetch(url, {
                redirect: 'follow',
                signal: AbortSignal.timeout(8000),
                headers: BROWSER_HEADERS
            });

            if (!resp.ok) continue;
            const html = await resp.text();
            const $ = cheerio.load(html);

            const tables = $('table.tabelle_grafik').toArray();
            if (tables.length === 0) continue;

            const reportLinks = $('a[href*="/spielbericht_"]').toArray().map(a => $(a).attr('href'));
            const results = [];
            const reportPromises = [];

            for (let idx = 0; idx < tables.length; idx++) {
                const table = tables[idx];
                const headerRow = $(table).find('tr').first();
                if (headerRow.length === 0) continue;

                const text = $(table).text().replace(/\s+/g, ' ');
                const teamLinks = $(table).find('a').toArray().filter(a => $(a).attr('href').includes('/verein/'));

                let homeTeam = 'N/A';
                let awayTeam = 'N/A';

                if (teamLinks.length >= 2) {
                    homeTeam = $(teamLinks[0]).text().trim();
                    awayTeam = $(teamLinks[1]).text().trim();
                } else {
                    const headerText = headerRow.text().trim();
                    if (headerText.includes(' - ')) {
                        const parts = headerText.split(' - ');
                        homeTeam = parts[0].trim();
                        awayTeam = parts[1].trim();
                    }
                }

                const scoreMatch = text.match(/(\d+:\d+|-:-)/);
                const scoreText = scoreMatch ? (scoreMatch[1] === '-:-' ? 'TBD' : scoreMatch[1]) : 'TBD';

                let matchDate = '';
                let matchTime = '';

                const dateTimeMatch = text.match(/(?:Anstoss:\s*)?(\d{1,2}:\d{2})\s*-\s*(\d{2}\.\d{2}\.\d{4})/i)
                    || text.match(/(\d{2}\.\d{2}\.\d{4})/);

                if (dateTimeMatch) {
                    if (dateTimeMatch[2]) {
                        matchTime = dateTimeMatch[1];
                        matchDate = dateTimeMatch[2].replace(/\./g, '/');
                    } else if (dateTimeMatch[1]) {
                        matchDate = dateTimeMatch[1].replace(/\./g, '/');
                    }
                }

                let reportUrl = reportLinks[idx] || null;
                if (reportUrl && !reportUrl.startsWith('http')) {
                    reportUrl = `https://www.soccerdonna.de${reportUrl}`;
                }

                const item = {
                    matchday: `Jornada ${matchday}`,
                    day: '',
                    date: matchDate,
                    time: matchTime,
                    homeTeam,
                    awayTeam,
                    score: scoreText
                };

                // Fast parallel report page fetch with 5s timeout if date is completely missing
                if (!matchDate && reportUrl) {
                    reportPromises.push((async () => {
                        try {
                            const repResp = await fetch(reportUrl, {
                                redirect: 'follow',
                                signal: AbortSignal.timeout(5000),
                                headers: {
                                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                                    'Accept-Language': 'de-DE,de;q=0.9'
                                }
                            });
                            if (repResp.ok) {
                                const repHtml = await repResp.text();
                                const repText = cheerio.load(repHtml)('body').text().replace(/\s+/g, ' ');
                                const repDateMatch = repText.match(/(\d{2}\.\d{2}\.\d{4})\s*-\s*(\d{1,2}:\d{2})\s*(?:Uhr)?/i)
                                    || repText.match(/(\d{2}\.\d{2}\.\d{4})/);
                                if (repDateMatch) {
                                    item.date = repDateMatch[1].replace(/\./g, '/');
                                    if (repDateMatch[2]) item.time = repDateMatch[2];
                                }
                            }
                        } catch (e) {}
                    })());
                }

                results.push(item);
            }

            if (reportPromises.length > 0) {
                await Promise.allSettled(reportPromises);
            }

            if (results.length > 0) {
                const validResults = filterMatchesByYear(results, targetYear);
                if (validResults.length > 0) {
                    console.log(`[HTTP Scraper] Successfully extracted ${validResults.length} matches matching target year ${targetYear}.`);
                    return validResults;
                } else {
                    console.warn(`[HTTP Scraper] Discarded ${results.length} matches from ${url} because their dates do not match requested year ${targetYear}.`);
                }
            }
        } catch (err) {
            console.warn(`[HTTP Scraper] Error fetching ${url}: ${err.message}`);
        }
    }

    return [];
}

async function scrapeMatchday(leagueKey, matchday, customYear) {
    const league = config.leagues[leagueKey];
    if (!league) throw new Error(`League ${leagueKey} not found in configuration.`);

    const targetYear = customYear || league.year || '2026';
    const isSoccerdonna = league.source === 'soccerdonna';

    const rawResults = isSoccerdonna
        ? await scrapeSoccerdonnaHTTP(league, matchday, targetYear)
        : await scrapeTransfermarktHTTP(league, matchday, targetYear);

    if (rawResults && rawResults.length > 0) {
        // Enforce strict matchday deduplication rule: a team cannot play twice in the same matchday
        const cleanResults = deduplicateMatchday(rawResults);
        return cleanResults;
    }

    throw new Error(`No match data found for ${league.fileName || leagueKey} Matchday ${matchday} (Año ${targetYear}).`);
}

module.exports = { scrapeMatchday };
