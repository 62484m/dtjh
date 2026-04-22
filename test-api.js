async function test() {
  const res = await fetch('http://localhost:3000/api/market-data');
  const text = await res.text();
  console.log('Status: ', res.status);
  console.log('Response: ', text);
}
test();
