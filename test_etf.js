async function test(code, ex) {
   const secid = ex === 'SZ' ? `0.${code}` : `1.${code}`;
   const res = await fetch(`http://push2.eastmoney.com/api/qt/stock/get?secid=${secid}&fields=f2,f14,f43`);
   const json = await res.json();
   console.log('Stock API:', json.data);

   const navRes = await fetch(`http://fundgz.1234567.com.cn/js/${code}.js`);
   const navText = await navRes.text();
   console.log('Fund API:', navText);
}
test('159501', 'SZ');
