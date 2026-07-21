const { scrapePureEspnMatchday } = require('./pureEspnScraper');

async function scrapeMatchday(leagueKey, matchday, customYear) {
    return await scrapePureEspnMatchday(leagueKey, matchday, customYear);
}

module.exports = { scrapeMatchday };
