async function fetchEastMoneyNav(symbol) {
  try {
    const match = symbol.match(/^(\d{6})/);
    if (!match) return null;
    const code = match[1];
    
    // Some endpoints may require headers or just work directly.
    const url = `http://fundgz.1234567.com.cn/js/${code}.js?rt=${new Date().getTime()}`;
    const res = await fetch(url);
    const text = await res.text();
    const jsonStr = text.match(/jsonpgz\((.*)\);/);
    if (jsonStr && jsonStr[1]) {
      const data = JSON.parse(jsonStr[1]);
      return parseFloat(data.gsz || data.dwjz);
    }
  } catch (e) {
    console.error('EastMoney fetch error for', symbol, e.message);
  }
  return null;
}

fetchEastMoneyNav('159501.SZ').then(nav => console.log('Parsed NAV:', nav));
