import fetch from 'node-fetch';
const headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Referer': 'http://quote.eastmoney.com/'
};
async function test() {
    console.log(await fetch("http://push2.eastmoney.com/api/qt/stock/get?secid=105.QQQ&fields=f2,f43,f170", {headers}).then(r => r.text()));
    console.log(await fetch("http://push2.eastmoney.com/api/qt/stock/get?secid=106.QQQ&fields=f2,f43,f170", {headers}).then(r => r.text()));
    console.log(await fetch("http://push2.eastmoney.com/api/qt/stock/get?secid=107.QQQ&fields=f2,f43,f170", {headers}).then(r => r.text()));
}
test();
