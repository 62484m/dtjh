import fetch from 'node-fetch';

async function test() {
  const stockUrl = "http://hq.sinajs.cn/list=sz159501";
  const stockRes = await fetch(stockUrl, { headers: { "Referer": "http://finance.sina.com.cn" } });
  const text = await stockRes.text();
  console.log(text);
}

test();
