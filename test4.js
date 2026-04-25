import fetch from 'node-fetch';
async function test() {
    const res = await fetch('https://searchapi.eastmoney.com/api/suggest/get?cb=jQuery1124021312384976779434_1713000000&input=SPY&type=14&token=D43BF722C8E33BDC906FB84D85E326E8&count=5').then(r => r.text());
    console.log(res);
}
test();
