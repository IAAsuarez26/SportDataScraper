const path = require('path');
const fs = require('fs-extra');
const os = require('os');

function getDataDir() {
  const rootDataDir = path.join(__dirname, '..', 'data');
  try {
    fs.ensureDirSync(rootDataDir);
    const testFile = path.join(rootDataDir, '.write_test');
    fs.writeFileSync(testFile, 'test');
    fs.unlinkSync(testFile);
    return rootDataDir;
  } catch (e) {
    // Read-only filesystem (e.g. Vercel Serverless /var/task) -> use OS tmpdir (/tmp)
    const tmpDataDir = path.join(os.tmpdir(), 'sports_data_scraper');
    fs.ensureDirSync(tmpDataDir);
    return tmpDataDir;
  }
}

module.exports = {
  baseUrl: 'https://www.transfermarkt.co.uk',
  getDataDir,
  leagues: {
    bundesliga: { compName: 'bundesliga', compCode: 'L1', fileName: 'Bundesliga', year: '2025' },
    premier: { compName: 'premier-league', compCode: 'GB1', fileName: 'Premier', year: '2025' },
    calcio: { compName: 'serie-a', compCode: 'IT1', fileName: 'Calcio', year: '2025' },
    la_liga: { compName: 'la-liga', compCode: 'ES1', fileName: 'La Liga', year: '2025' },
    france: { compName: 'ligue-1', compCode: 'FR1', fileName: 'France', year: '2025' },
    champions: { compName: 'uefa-champions-league', compCode: 'CL', fileName: 'ChampionsM', year: '2025', compType: 'pokalwettbewerb' },
    mls: { compName: 'major-league-soccer', compCode: 'MLS1', fileName: 'MLS', year: '2025' },
    nwsl: { compName: 'nwsl', compCode: 'NWSL', fileName: 'NWSL', year: '2025', source: 'soccerdonna', baseUrl: 'https://www.soccerdonna.de/de' }
  }
};
