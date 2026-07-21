const { chromium } = require('playwright');

async function testTimezone() {
    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({
        timezoneId: 'America/Caracas',
        locale: 'en-GB'
    });
    const page = await context.newPage();

    // Bundesliga Matchday 1 (all finished)
    const url = 'https://www.transfermarkt.co.uk/bundesliga/spieltag/wettbewerb/L1/plus/?stichtag=&spieltag=1';
    console.log(`Navigating to ${url}`);
    await page.goto(url, { waitUntil: 'domcontentloaded' });

    // Wait for content
    await page.waitForTimeout(2000);

    const matches = await page.evaluate(() => {
        const boxes = Array.from(document.querySelectorAll('.box'));
        return boxes.map(box => {
            const boxText = box.innerText.replace(/\s+/g, ' ');
            const dateTimeMatch = boxText.match(/(?:Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday),\s+(\d{2}\/\d{2}\/\d{2,4}).*?(\d{1,2}:\d{2}\s?(?:AM|PM))/i);
            return dateTimeMatch ? dateTimeMatch[0] : 'No match found';
        }).filter(m => m !== 'No match found');
    });

    console.log('Detected Date/Times on page:');
    console.log(matches);

    await browser.close();
}

testTimezone();
