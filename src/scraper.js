const cheerio = require('cheerio');
const config = require('./config');

async function scrapeTransfermarktHTTP(league, matchday, targetYear) {
    const compName = league.compName;
    const compCode = league.compCode;
    const compType = league.compType || 'wettbewerb';
    const baseUrl = config.baseUrl;

    const urlsToTry = [];
    if (targetYear) {
        urlsToTry.push(`${baseUrl}/${compName}/spieltag/${compType}/${compCode}/plus/?saison_id=${targetYear}&spieltag=${matchday}`);
        const fallbackYear = (parseInt(targetYear) - 1).toString();
        urlsToTry.push(`${baseUrl}/${compName}/spieltag/${compType}/${compCode}/plus/?saison_id=${fallbackYear}&spieltag=${matchday}`);
    }
    urlsToTry.push(`${baseUrl}/${compName}/spieltag/${compType}/${compCode}/plus/?spieltag=${matchday}`);

    for (const url of urlsToTry) {
        try {
            console.log(`[HTTP Scraper] Navigating to: ${url}`);
            const resp = await fetch(url, {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36',
                    'Accept-Language': 'en-GB,en;q=0.9'
                }
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
                console.log(`[HTTP Scraper] Successfully extracted ${results.length} matches.`);
                return results;
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
        urlsToTry.push(`${baseUrl}/${compName}/spieltagsuebersicht/wettbewerb_${compCode}_${targetYear}_${matchday}.html`);
        const fallbackYear = (parseInt(targetYear) - 1).toString();
        urlsToTry.push(`${baseUrl}/${compName}/spieltagsuebersicht/wettbewerb_${compCode}_${fallbackYear}_${matchday}.html`);
    }
    urlsToTry.push(`${baseUrl}/${compName}/spieltagsuebersicht/wettbewerb_${compCode}_${matchday}.html`);

    for (const url of urlsToTry) {
        try {
            console.log(`[HTTP Scraper] Navigating to: ${url}`);
            const resp = await fetch(url, {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36',
                    'Accept-Language': 'de-DE,de;q=0.9,en-US;q=0.8,en;q=0.7'
                }
            });

            if (!resp.ok) continue;
            const html = await resp.text();
            const $ = cheerio.load(html);

            const tables = $('table.tabelle_grafik').toArray();
            const reportLinks = $('a[href*="/spielbericht_"]').toArray().map(a => $(a).attr('href'));

            const results = [];

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

                // If date/time is missing for completed match, fetch report via HTTP safely
                if ((!matchDate || !matchTime) && reportUrl) {
                    try {
                        const repResp = await fetch(reportUrl, {
                            signal: AbortSignal.timeout(4000),
                            headers: {
                                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36',
                                'Accept-Language': 'de-DE,de;q=0.9,en-US;q=0.8,en;q=0.7'
                            }
                        });
                        if (repResp.ok) {
                            const repHtml = await repResp.text();
                            const repText = cheerio.load(repHtml)('body').text().replace(/\s+/g, ' ');
                            const repDateMatch = repText.match(/(?:Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday|Montag|Dienstag|Mittwoch|Donnerstag|Freitag|Samstag|Sonntag)?\s*,?\s*(\d{2}\.\d{2}\.\d{4})\s*-\s*(\d{1,2}:\d{2})\s*(?:Uhr)?/i)
                                || repText.match(/(\d{2}\.\d{2}\.\d{4})/);
                            
                            if (repDateMatch) {
                                matchDate = repDateMatch[1].replace(/\./g, '/');
                                if (repDateMatch[2]) matchTime = repDateMatch[2];
                            }
                        }
                    } catch (e) {}
                }

                results.push({
                    matchday: `Jornada ${matchday}`,
                    day: '',
                    date: matchDate,
                    time: matchTime,
                    homeTeam,
                    awayTeam,
                    score: scoreText
                });
            }

            if (results.length > 0) {
                console.log(`[HTTP Scraper] Successfully extracted ${results.length} matches.`);
                return results;
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

    const targetYear = customYear || league.year || '2025';
    const isSoccerdonna = league.source === 'soccerdonna';

    // Standalone, ultra-fast HTTP Cheerio scraper (100% cloud & Vercel compatible)
    const results = isSoccerdonna
        ? await scrapeSoccerdonnaHTTP(league, matchday, targetYear)
        : await scrapeTransfermarktHTTP(league, matchday, targetYear);

    if (results && results.length > 0) {
        return results;
    }

    throw new Error(`No match data found for ${league.fileName || leagueKey} Matchday ${matchday} (Año ${targetYear}).`);
}

module.exports = { scrapeMatchday };
