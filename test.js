import fetch from 'node-fetch';

async function test(symbol) {
    const headers = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Referer': 'http://quote.eastmoney.com/'
    };
    const stockUrl = `http://push2.eastmoney.com/api/qt/stock/get?secid=105.${symbol}&fields=f2,f43,f170`;
    const stockUrl106 = `http://push2.eastmoney.com/api/qt/stock/get?secid=106.${symbol}&fields=f2,f43,f170`;
    const stockUrl107 = `http://push2.eastmoney.com/api/qt/stock/get?secid=107.${symbol}&fields=f2,f43,f170`;
    
    for (const url of [stockUrl, stockUrl106, stockUrl107]) {
        try {
            const res = await fetch(url, {headers}).then(r => r.json());
            console.log(symbol, "secid prefix", url.split('secid=')[1].split('.')[0], "==>", res.data);
        } catch (e) {
            console.error(symbol, "failed");
        }
    }
}
test("TSLA");
test("QQQ");
test("SPY");
