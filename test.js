import YahooFinance from 'yahoo-finance2';

const yf = new YahooFinance();

async function test() {
  try {
      const qqqm = await yf.quoteSummary('QQQM', { modules: ['summaryDetail', 'price', 'fundProfile'] });
      console.log('QQQM summaryDetail:', qqqm.summaryDetail);
  } catch (e) {
      console.error(e);
  }
}

test();
