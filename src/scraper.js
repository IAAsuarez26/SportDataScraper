const { scrapeHybridMatchday } = require('./hybridScraper');

async function scrapeMatchday(leagueKey, matchday, customYear) {
    return await scrapeHybridMatchday(leagueKey, matchday, customYear);
}

module.exports = { scrapeMatchday };
