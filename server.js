const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs-extra');
const config = require('./src/config');
const { scrapeMatchday } = require('./src/scraper');
const ExcelJS = require('exceljs');
const { DateTime } = require('luxon');

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Metadata for leagues presentation
const LEAGUE_METADATA = {
    bundesliga: { name: 'Bundesliga', country: 'Germany', flag: '🇩🇪', accent: '#D0021B', defaultStart: 19, defaultEnd: 34, maxMatchdays: 34 },
    premier: { name: 'Premier League', country: 'England', flag: '🏴󠁧󠁢󠁥󠁮󠁧󠁿', accent: '#38003C', defaultStart: 19, defaultEnd: 38, maxMatchdays: 38 },
    calcio: { name: 'Serie A (Calcio)', country: 'Italy', flag: '🇮🇹', accent: '#008FD7', defaultStart: 19, defaultEnd: 38, maxMatchdays: 38 },
    la_liga: { name: 'La Liga', country: 'Spain', flag: '🇪🇸', accent: '#EE8700', defaultStart: 19, defaultEnd: 38, maxMatchdays: 38 },
    france: { name: 'Ligue 1', country: 'France', flag: '🇫🇷', accent: '#DAE025', defaultStart: 19, defaultEnd: 34, maxMatchdays: 34 },
    champions: { name: 'UEFA Champions League', country: 'Europe', flag: '🇪🇺', accent: '#001489', defaultStart: 1, defaultEnd: 8, maxMatchdays: 10 },
    mls: { name: 'Major League Soccer (MLS)', country: 'USA', flag: '🇺🇸', accent: '#002B49', defaultStart: 1, defaultEnd: 34, maxMatchdays: 34 },
    nwsl: { name: 'National Women\'s Soccer League (NWSL)', country: 'USA (Women)', flag: '🇺🇸', accent: '#E30613', defaultStart: 1, defaultEnd: 26, maxMatchdays: 26 }
};

// Global Job State
let activeJob = {
    isRunning: false,
    cancelRequested: false,
    leagueKey: null,
    startMatchday: 1,
    endMatchday: 1,
    currentMatchday: 0,
    progress: 0,
    logs: [],
    startTime: null,
    completedAt: null,
    error: null
};

function addLog(message, type = 'info') {
    const time = new Date().toLocaleTimeString('es-VE');
    const logEntry = { time, message, type };
    activeJob.logs.push(logEntry);
    if (activeJob.logs.length > 500) activeJob.logs.shift(); // Keep last 500 lines
    console.log(`[${type.toUpperCase()}] ${message}`);
}

async function exportToExcel(data, matchday, filePath) {
    const workbook = new ExcelJS.Workbook();
    const sheetName = `Jornada ${matchday}`;

    if (await fs.pathExists(filePath)) {
        try {
            await workbook.xlsx.readFile(filePath);
            const existingSheet = workbook.getWorksheet(sheetName);
            if (existingSheet) {
                workbook.removeWorksheet(existingSheet.id);
            }
        } catch (error) {
            addLog(`Could not read existing Excel file: ${error.message}. Creating new workbook.`, 'warn');
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

async function runExtractionTask(leagueKey, startMatchday, endMatchday, customYear) {
    const league = config.leagues[leagueKey];
    if (!league) throw new Error(`League "${leagueKey}" is not supported.`);

    const targetYear = customYear || league.year || '2025';

    activeJob.isRunning = true;
    activeJob.cancelRequested = false;
    activeJob.leagueKey = leagueKey;
    activeJob.year = targetYear;
    activeJob.startMatchday = startMatchday;
    activeJob.endMatchday = endMatchday;
    activeJob.currentMatchday = startMatchday;
    activeJob.progress = 0;
    activeJob.logs = [];
    activeJob.startTime = new Date();
    activeJob.completedAt = null;
    activeJob.error = null;

    const meta = LEAGUE_METADATA[leagueKey] || { name: league.fileName };
    addLog(`🚀 Starting extraction for ${meta.flag || ''} ${meta.name} (Año ${targetYear}, Jornadas ${startMatchday} - ${endMatchday})...`);

    const dataDir = path.join(__dirname, 'data');
    await fs.ensureDir(dataDir);
    const excelPath = path.join(dataDir, `${league.fileName}.xlsx`);

    const totalMatchdays = (endMatchday - startMatchday) + 1;

    try {
        for (let m = startMatchday; m <= endMatchday; m++) {
            if (activeJob.cancelRequested) {
                addLog(`⚠️ Extraction cancelled by user at Matchday ${m}.`, 'warn');
                break;
            }

            activeJob.currentMatchday = m;
            const completedCount = (m - startMatchday);
            activeJob.progress = Math.round((completedCount / totalMatchdays) * 100);

            addLog(`🔍 Scraping Matchday ${m} / ${endMatchday} (Año ${targetYear})...`);

            const matches = await scrapeMatchday(leagueKey, m.toString(), targetYear);

            if (!matches || matches.length === 0) {
                addLog(`⚠️ No matches found for Matchday ${m}. Skipping...`, 'warn');
                continue;
            }

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
                        addLog(`Date parse note: ${e.message}`, 'warn');
                    }
                }
                return { ...match, day: localizedDay, date: localizedDate, time: localizedTime };
            });

            await exportToExcel(localizedMatches, m.toString(), excelPath);
            addLog(`✅ Successfully saved ${matches.length} matches for Matchday ${m} into ${league.fileName}.xlsx`);
        }

        activeJob.progress = 100;
        activeJob.completedAt = new Date();
        addLog(`🎉 Extraction completed successfully for ${meta.name}!`, 'success');
    } catch (err) {
        activeJob.error = err.message;
        addLog(`❌ Extraction error: ${err.message}`, 'error');
    } finally {
        activeJob.isRunning = false;
    }
}

// API Routes

// GET /api/leagues - List available leagues with metadata
app.get('/api/leagues', (req, res) => {
    const list = Object.keys(config.leagues).map(key => {
        const league = config.leagues[key];
        const meta = LEAGUE_METADATA[key] || {};
        return {
            key,
            compName: league.compName,
            fileName: league.fileName,
            year: league.year,
            source: league.source || 'transfermarkt',
            name: meta.name || league.fileName,
            country: meta.country || '',
            flag: meta.flag || '⚽',
            accent: meta.accent || '#10B981',
            defaultStart: meta.defaultStart || 1,
            defaultEnd: meta.defaultEnd || 34,
            maxMatchdays: meta.maxMatchdays || 38
        };
    });
    res.json(list);
});

// GET /api/status - Get current job status and logs
app.get('/api/status', (req, res) => {
    res.json(activeJob);
});

// POST /api/scrape - Start extraction task
app.post('/api/scrape', (req, res) => {
    if (activeJob.isRunning) {
        return res.status(400).json({ error: 'An extraction task is already running.' });
    }

    const { leagueKey, startMatchday, endMatchday, year } = req.body;
    if (!leagueKey || !config.leagues[leagueKey]) {
        return res.status(400).json({ error: `Invalid or missing leagueKey: "${leagueKey}"` });
    }

    const start = parseInt(startMatchday) || 1;
    const end = parseInt(endMatchday) || start;

    // Trigger async job with custom year
    runExtractionTask(leagueKey, start, end, year);

    res.json({ message: 'Extraction started', leagueKey, startMatchday: start, endMatchday: end, year });
});

// POST /api/stop - Cancel running job
app.post('/api/stop', (req, res) => {
    if (!activeJob.isRunning) {
        return res.status(400).json({ error: 'No extraction task is currently running.' });
    }

    activeJob.cancelRequested = true;
    addLog('⏹️ Stop request received...', 'warn');
    res.json({ message: 'Cancellation requested.' });
});

// GET /api/files - List Excel files in data directory
app.get('/api/files', async (req, res) => {
    try {
        const dataDir = path.join(__dirname, 'data');
        await fs.ensureDir(dataDir);

        const files = await fs.readdir(dataDir);
        const excelFiles = files.filter(f => f.endsWith('.xlsx'));

        const fileDetails = await Promise.all(excelFiles.map(async filename => {
            const filePath = path.join(dataDir, filename);
            const stats = await fs.stat(filePath);
            
            // Inspect sheet names using ExcelJS
            let sheets = [];
            try {
                const workbook = new ExcelJS.Workbook();
                await workbook.xlsx.readFile(filePath);
                sheets = workbook.worksheets.map(s => s.name);
            } catch(e) {}

            return {
                filename,
                sizeBytes: stats.size,
                sizeFormatted: (stats.size / 1024).toFixed(1) + ' KB',
                modifiedAt: stats.mtime,
                sheetsCount: sheets.length,
                sheets
            };
        }));

        // Sort most recently modified first
        fileDetails.sort((a, b) => b.modifiedAt - a.modifiedAt);

        res.json(fileDetails);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// GET /api/files/download/:filename - Download specific Excel file
app.get('/api/files/download/:filename', async (req, res) => {
    try {
        const filename = req.params.filename;
        // Security check
        if (filename.includes('..') || filename.includes('/') || filename.includes('\\')) {
            return res.status(400).send('Invalid filename');
        }

        const filePath = path.join(__dirname, 'data', filename);
        if (!await fs.pathExists(filePath)) {
            return res.status(404).send('File not found');
        }

        const encodedFilename = encodeURIComponent(filename);
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"; filename*=UTF-8''${encodedFilename}`);
        res.sendFile(filePath);
    } catch (error) {
        res.status(500).send(error.message);
    }
});

app.listen(PORT, () => {
    console.log(`\n==================================================`);
    console.log(`⚽ Sports Data Scraper Web App running at:`);
    console.log(`👉 http://localhost:${PORT}`);
    console.log(`==================================================\n`);
});
