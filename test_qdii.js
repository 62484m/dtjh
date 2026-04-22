import YahooFinance from 'yahoo-finance2';
const yf = new YahooFinance();

async function test() {
  const quote = await yf.quote('159501.SZ').catch((e) => console.log(e));
  const summary = await yf.quoteSummary('159501.SZ', { modules: ['summaryDetail'] }).catch((e) => console.log(e));
  
  console.log('Quote:', quote?.regularMarketPrice);
  console.log('Summary NAV:', summary?.summaryDetail?.navPrice);
}

test();
