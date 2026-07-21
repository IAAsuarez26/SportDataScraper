const { chromium } = require('playwright');
const config = require('./config');

async function navigateWithSeasonFallback(page, isSoccerdonna, league, matchday, targetYear) {
    const baseUrl = isSoccerdonna ? (league.baseUrl || 'https://www.soccerdonna.de/de') : config.baseUrl;
    const compType = league.compType || 'wettbewerb';

    const urlsToTry = [];

    if (isSoccerdonna) {
        if (targetYear) {
            urlsToTry.push(`${baseUrl}/${league.compName}/spieltagsuebersicht/wettbewerb_${league.compCode}_${targetYear}_${matchday}.html`);
            const fallbackYear = (parseInt(targetYear) - 1).toString();
            urlsToTry.push(`${baseUrl}/${league.compName}/spieltagsuebersicht/wettbewerb_${league.compCode}_${fallbackYear}_${matchday}.html`);
        }
        urlsToTry.push(`${baseUrl}/${league.compName}/spieltagsuebersicht/wettbewerb_${league.compCode}_${matchday}.html`);
    } else {
        if (targetYear) {
            urlsToTry.push(`${baseUrl}/${league.compName}/spieltag/${compType}/${league.compCode}/plus/?saison_id=${targetYear}&spieltag=${matchday}`);
            const fallbackYear = (parseInt(targetYear) - 1).toString();
            urlsToTry.push(`${baseUrl}/${league.compName}/spieltag/${compType}/${league.compCode}/plus/?saison_id=${fallbackYear}&spieltag=${matchday}`);
        }
        urlsToTry.push(`${baseUrl}/${league.compName}/spieltag/${compType}/${league.compCode}/plus/?spieltag=${matchday}`);
    }

    for (let i = 0; i < urlsToTry.length; i++) {
        const url = urlsToTry[i];
        console.log(`Navigating to: ${url}`);
        try {
            await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });

            // Handle cookie consent
            try {
                const buttonText = isSoccerdonna ? 'button:has-text("Akzeptieren")' : 'button:has-text("Accept & continue")';
                const acceptButton = page.locator(buttonText);
                if (await acceptButton.isVisible({ timeout: 3000 })) {
                    await acceptButton.click();
                }
            } catch (e) { }

            await page.waitForTimeout(800);

            const hasContent = await page.evaluate((isSD) => {
                if (isSD) {
                    return document.querySelectorAll('table.tabelle_grafik').length > 0;
                } else {
                    return document.querySelectorAll('.box tr.table-grosse-schrift').length > 0;
                }
            }, isSoccerdonna);

            if (hasContent) {
                console.log(`Successfully loaded content from: ${url}`);
                return url;
            } else {
                console.warn(`No match content found at: ${url}. ${i < urlsToTry.length - 1 ? 'Trying season fallback...' : ''}`);
            }
        } catch (err) {
            console.warn(`Navigation error for ${url}: ${err.message}`);
        }
    }
}

async function scrapeMatchday(leagueKey, matchday, customYear) {
    const league = config.leagues[leagueKey];
    if (!league) throw new Error(`League ${leagueKey} not found in configuration.`);

    const targetYear = customYear || league.year || '2025';

    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36',
        viewport: { width: 1280, height: 720 },
        timezoneId: 'America/Caracas',
        locale: 'en-GB'
    });
    const page = await context.newPage();
    const isSoccerdonna = league.source === 'soccerdonna';

    try {
        await navigateWithSeasonFallback(page, isSoccerdonna, league, matchday, targetYear);

        if (isSoccerdonna) {
            const data = await page.evaluate((matchdayLabel) => {
                const results = [];
                const tables = Array.from(document.querySelectorAll('table.tabelle_grafik'));
                const reportLinks = Array.from(document.querySelectorAll('a[href*="/spielbericht_"]'))
                    .map(a => a.href);

                tables.forEach((table, idx) => {
                    const headerRow = table.querySelector('tr');
                    if (!headerRow) return;

                    const text = table.innerText.replace(/\s+/g, ' ');
                    const teamLinks = Array.from(table.querySelectorAll('a'))
                        .filter(a => a.href.includes('/verein/'));

                    let homeTeam = 'N/A';
                    let awayTeam = 'N/A';

                    if (teamLinks.length >= 2) {
                        homeTeam = teamLinks[0].innerText.trim();
                        awayTeam = teamLinks[1].innerText.trim();
                    } else {
                        const headerText = headerRow.innerText.trim();
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

                    const reportUrl = reportLinks[idx] || null;

                    results.push({
                        matchday: `Jornada ${matchdayLabel}`,
                        day: '',
                        date: matchDate,
                        time: matchTime,
                        homeTeam,
                        awayTeam,
                        score: scoreText,
                        reportUrl
                    });
                });
                return results;
            }, matchday);

            // Fetch report pages for completed matches missing date/time
            for (const item of data) {
                if ((!item.date || !item.time) && item.reportUrl) {
                    const reportPage = await context.newPage();
                    try {
                        await reportPage.goto(item.reportUrl, { waitUntil: 'domcontentloaded', timeout: 15000 });
                        await reportPage.waitForTimeout(400);

                        const details = await reportPage.evaluate(() => {
                            const bodyText = document.body.innerText.replace(/\s+/g, ' ');
                            const dateTimeMatch = bodyText.match(/(?:Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday|Montag|Dienstag|Mittwoch|Donnerstag|Freitag|Samstag|Sonntag)?\s*,?\s*(\d{2}\.\d{2}\.\d{4})\s*-\s*(\d{1,2}:\d{2})\s*(?:Uhr)?/i)
                                || bodyText.match(/(\d{2}\.\d{2}\.\d{4})/);
                            
                            const dayMatch = bodyText.match(/(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday|Montag|Dienstag|Mittwoch|Donnerstag|Freitag|Samstag|Sonntag)/i);

                            return {
                                date: dateTimeMatch ? dateTimeMatch[1].replace(/\./g, '/') : '',
                                time: dateTimeMatch && dateTimeMatch[2] ? dateTimeMatch[2] : '',
                                day: dayMatch ? dayMatch[1] : ''
                            };
                        });

                        if (details.date) item.date = details.date;
                        if (details.time) item.time = details.time;
                        if (details.day) item.day = details.day;
                    } catch (e) {
                        console.warn(`Could not fetch report for ${item.homeTeam} vs ${item.awayTeam}: ${e.message}`);
                    } finally {
                        await reportPage.close();
                    }
                }
            }

            console.log(`Scraped ${data.length} matches.`);
            return data.map(({ reportUrl, ...rest }) => rest);
        }

        const data = await page.evaluate((matchdayLabel) => {
            const results = [];
            // TM matchday overview has one match per box
            const boxes = Array.from(document.querySelectorAll('.box'));

            boxes.forEach(box => {
                const matchRow = box.querySelector('tr.table-grosse-schrift');
                if (!matchRow) return;

                const homeTeamCell = matchRow.querySelector('td.rechts.hauptlink.spieltagsansicht-vereinsname');
                const awayTeamCell = matchRow.querySelector('td:not(.rechts).hauptlink.spieltagsansicht-vereinsname');
                const scoreCell = matchRow.querySelector('td.zentriert.hauptlink.spieltagsansicht-ergebnis');

                if (homeTeamCell && awayTeamCell && scoreCell) {
                    const getTeamName = (cell) => {
                        const links = Array.from(cell.querySelectorAll('a'));
                        const teamLink = links.find(a => !a.querySelector('img') && !a.href.includes('/forum/'));
                        return teamLink ? teamLink.innerText.trim() : 'N/A';
                    };

                    const scoreLink = scoreCell.querySelector('a');
                    const scoreText = scoreLink ? scoreLink.innerText.trim() : 'TBD';

                    let matchDate = '';
                    let matchTime = '';
                    let dayName = '';

                    const boxText = box.innerText.replace(/\s+/g, ' ');

                    // Flexible Regex for Date & Time e.g. "Saturday, 28/02/2026 - 7:30 PM" or "28/02/2026 - 7:30 PM"
                    const dateTimeMatch = boxText.match(/(?:Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday|Mon|Tue|Wed|Thu|Fri|Sat|Sun)?,?\s*(\d{2}[\/\.]\d{2}[\/\.]\d{2,4})\s*-\s*(\d{1,2}:\d{2}\s?(?:AM|PM|Uhr)?)/i)
                        || boxText.match(/(\d{2}[\/\.]\d{2}[\/\.]\d{2,4})/);

                    if (dateTimeMatch) {
                        matchDate = dateTimeMatch[1].replace(/\./g, '/');
                        if (dateTimeMatch[2]) matchTime = dateTimeMatch[2];
                    }

                    const dayMatch = boxText.match(/(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday)/i);
                    dayName = dayMatch ? dayMatch[0] : '';

                    results.push({
                        matchday: `Jornada ${matchdayLabel}`,
                        day: dayName,
                        date: matchDate,
                        time: matchTime,
                        homeTeam: getTeamName(homeTeamCell),
                        awayTeam: getTeamName(awayTeamCell),
                        score: scoreText === '-:-' ? 'TBD' : scoreText
                    });
                }
            });
            return results;
        }, matchday);

        console.log(`Scraped ${data.length} matches.`);
        return data;
    } catch (error) {
        console.error(`Error scraping ${leagueKey} matchday ${matchday}:`, error.message);
        throw error;
    } finally {
        await browser.close();
    }
}

module.exports = { scrapeMatchday };
