async function test() {
  const resp = await fetch('http://localhost:3000/api/market-data', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ funds: [{ symbol: '159501', matrix: 'QQQ' }] })
  });
  const json = await resp.json();
  console.dir(json, {depth: null});
}
test();
