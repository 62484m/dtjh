import fetch from 'node-fetch';
async function test() {
    const symbol = 'QQQ';
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?interval=1d&range=1d`;
    console.log(await fetch(url).then(r => r.json()).catch(e => e.message));
}
test();
