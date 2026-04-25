import fetch from 'node-fetch';

async function fetchYahooRaw(symbol) {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?interval=1d&range=1d`;
    try {
        const res = await fetch(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0'
            }
        });
        const data = await res.json();
        const meta = data.chart.result[0].meta;
        return {
            regularMarketPrice: meta.regularMarketPrice,
            regularMarketChangePercent: (meta.regularMarketPrice - meta.chartPreviousClose) / meta.chartPreviousClose * 100,
            trailingPE: null
        };
    } catch(e) {
        return null;
    }
}

async function test() {
    console.log(await fetchYahooRaw('QQQ'));
    console.log(await fetchYahooRaw('SPY'));
    console.log(await fetchYahooRaw('TSLA'));
}
test();
