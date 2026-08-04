const { scrapePureEspnMatchday, scrapeEspnDateRange } = require('./pureEspnScraper');
const { scrapeHybridMatchday } = require('./hybridScraper');

async function scrapeMatchday(leagueKey, matchday, customYear) {
    try {
        return await scrapePureEspnMatchday(leagueKey, matchday, customYear);
    } catch (pureErr) {
        console.warn(`[Scraper] Pure ESPN Engine failed for ${leagueKey} M${matchday}: ${pureErr.message}. Trying Hybrid Engine...`);
        try {
            return await scrapeHybridMatchday(leagueKey, matchday, customYear);
        } catch (hybridErr) {
            throw new Error(`Pure Engine: ${pureErr.message} | Hybrid Engine: ${hybridErr.message}`);
        }
    }
}

async function scrapeDateRange(leagueKey, startDateStr, endDateStr) {
    return await scrapeEspnDateRange(leagueKey, startDateStr, endDateStr);
}

module.exports = { scrapeMatchday, scrapeDateRange };

