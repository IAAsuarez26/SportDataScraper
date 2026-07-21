const { scrapeMatchday } = require('./scraper');
const config = require('./config');
const fs = require('fs-extra');
const path = require('path');
const ExcelJS = require('exceljs');
const { DateTime } = require('luxon');

async function exportToExcel(data, matchday, filePath) {
    const workbook = new ExcelJS.Workbook();
    const sheetName = `Jornada ${matchday}`;

    // Try to load existing workbook if it exists
    if (await fs.pathExists(filePath)) {
        try {
            await workbook.xlsx.readFile(filePath);
            // Remove existing sheet for this matchday if it exists to overwrite it
            const existingSheet = workbook.getWorksheet(sheetName);
            if (existingSheet) {
                workbook.removeWorksheet(existingSheet.id);
            }
        } catch (error) {
            console.warn(`Could not read existing Excel file: ${error.message}. Creating a new one.`);
        }
    }

    const worksheet = workbook.addWorksheet(sheetName);

    worksheet.columns = [
        { header: 'Matchday', key: 'matchday', width: 25 },
        { header: 'Day', key: 'day', width: 15 },
        { header: 'Date', key: 'date', width: 20 },
        { header: 'Time (Caracas)', key: 'time', width: 15 },
        { header: 'Home Team', key: 'homeTeam', width: 25 },
        { header: 'Away Team', key: 'awayTeam', width: 25 },
        { header: 'Score', key: 'score', width: 15 }
    ];

    // Style the header
    worksheet.getRow(1).font = { bold: true };
    worksheet.getRow(1).fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFD3D3D3' }
    };

    data.forEach(item => {
        let displayScore = '';
        if (item.score && item.score !== 'TBD' && item.score !== '-:-') {
            // Filter out 24h kick-off times (e.g. 02:00, 20:00) that Soccerdonna puts in score cell for upcoming matches
            if (!/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(item.score)) {
                displayScore = item.score;
            }
        }
        worksheet.addRow({
            ...item,
            score: displayScore
        });
    });

    await workbook.xlsx.writeFile(filePath);
}

async function main() {
    const args = process.argv.slice(2);
    const leagueKey = args[0]?.toLowerCase() || 'bundesliga';
    const league = config.leagues[leagueKey];

    if (!league) {
        console.error(`Error: League "${leagueKey}" is not supported.`);
        console.log('Supported leagues:', Object.keys(config.leagues).join(', '));
        process.exit(1);
    }

    const startMatchday = parseInt(args[1]) || 19;
    const endMatchday = parseInt(args[2]) || 34;
    const customYear = args[3] || league.year || '2025';

    const dataDir = config.getDataDir();
    await fs.ensureDir(dataDir);

    console.log(`Starting bulk scraper for League: ${leagueKey} (${league.fileName}), Year: ${customYear}, Matchdays: ${startMatchday} to ${endMatchday}...`);

    for (let matchday = startMatchday; matchday <= endMatchday; matchday++) {
        console.log(`\n--- Processing Matchday ${matchday} (Año ${customYear}) ---`);
        try {
            const matches = await scrapeMatchday(leagueKey, matchday.toString(), customYear);

            if (!matches || matches.length === 0) {
                console.log(`No matches found for Matchday ${matchday}. Skipping...`);
                continue;
            }

            // Localize times for JSON output
            const localizedMatches = matches.map(match => {
                let localizedTime = match.time;
                let localizedDate = match.date;
                let localizedDay = match.day;

                if (match.date) {
                    try {
                        const cleanDate = match.date.replace(/\./g, '/');
                        if (match.time) {
                            let dt = DateTime.fromFormat(`${cleanDate} ${match.time}`, 'dd/MM/yyyy h:mm a', { zone: 'UTC' });
                            if (!dt.isValid) {
                                dt = DateTime.fromFormat(`${cleanDate} ${match.time}`, 'dd/MM/yyyy H:mm', { zone: 'UTC' });
                            }
                            if (dt.isValid) {
                                const caracasDT = dt.setZone('America/Caracas');
                                localizedTime = caracasDT.toFormat('h:mm a');
                                localizedDate = caracasDT.toFormat('dd/MM/yyyy');
                                localizedDay = caracasDT.toFormat('EEEE');
                            }
                        } else {
                            let dt = DateTime.fromFormat(cleanDate, 'dd/MM/yyyy', { zone: 'UTC' });
                            if (dt.isValid) {
                                localizedDate = dt.toFormat('dd/MM/yyyy');
                                localizedDay = dt.toFormat('EEEE');
                            }
                        }
                    } catch (e) {
                        console.warn(`Time localization failed for "${match.date} ${match.time}": ${e.message}`);
                    }
                }
                return { ...match, day: localizedDay, date: localizedDate, time: localizedTime };
            });

            const excelPath = path.join(dataDir, `${league.fileName}.xlsx`);

            // Export localized data to Excel
            await exportToExcel(localizedMatches, matchday.toString(), excelPath);

            console.log(`Successfully scraped ${matches.length} matches for ${leagueKey} Matchday ${matchday}.`);
        } catch (error) {
            console.error(`Failed to scrape ${leagueKey} Matchday ${matchday}:`, error.message);
            // Continue with the next matchday even if one fails
            continue;
        }
    }

    console.log(`\nBulk scraping task for ${leagueKey} completed.`);
}

main();
