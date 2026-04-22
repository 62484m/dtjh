import fetch from 'node-fetch';
async function test() {
  const stockUrl = `http://push2.eastmoney.com/api/qt/stock/get?secid=0.159501&fields=f2,f43,f170,f53,f55,f60,f62,f192,f191`;
  const stockRes = await fetch(stockUrl);
  const json = await stockRes.json();
  console.log(json.data);
}
test();
