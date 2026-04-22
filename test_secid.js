async function checkStock() {
  const url = `http://push2.eastmoney.com/api/qt/stock/get?secid=0.159501&fields=f1,f2,f14,f43,f169,f170,f111`;
  const res = await fetch(url);
  const json = await res.json();
  console.log(json.data);
}
checkStock();
