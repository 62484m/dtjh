import express from 'express';
import { createServer as createViteServer } from 'vite';
import yahooFinance from 'yahoo-finance2';
import path from 'path';

// Instantiate yahooFinance for v3
const yf = new yahooFinance();

// --- Memory Cache for QDII Funds ---
const qdiiCache = new Map();

function getBjDate(date = new Date()) {
    const utc = date.getTime() + (date.getTimezoneOffset() * 60000);
    return new Date(utc + (3600000 * 8));
}

function getBjDateStr(bjDate) {
    return `${bjDate.getFullYear()}-${String(bjDate.getMonth() + 1).padStart(2, '0')}-${String(bjDate.getDate()).padStart(2, '0')}`;
}

function shouldFetchQdii(code) {
    const cached = qdiiCache.get(code);
    if (!cached) return true;

    const bjNow = getBjDate();
    const dateStrNow = getBjDateStr(bjNow);
    const timeNumNow = bjNow.getHours() * 100 + bjNow.getMinutes();

    // If cache is from a previous day, and it's past 09:30 AM today, trigger fetch
    if (cached.dateStr !== dateStrNow && timeNumNow >= 930) {
        return true;
    }

    const cacheAgeMins = (Date.now() - cached.timestamp) / 60000;
    const isTradingHours = (timeNumNow >= 930 && timeNumNow <= 1130) || (timeNumNow >= 1300 && timeNumNow <= 1500);

    // 1. Every 10 mins during active trading hours
    if (isTradingHours && cacheAgeMins >= 10) return true;

    // 2. Afternoon close final fetch logic
    // If we are past 15:00 today, AND the cache belongs to today BUT was recorded before 15:00, we should fetch one last time to get the final settlement.
    if (timeNumNow >= 1500 && cached.dateStr === dateStrNow) {
        const cacheBj = getBjDate(new Date(cached.timestamp));
        const cacheTimeNum = cacheBj.getHours() * 100 + cacheBj.getMinutes();
        if (cacheTimeNum < 1500) {
            return true;
        }
    }

    return false; // Skip fetch during non-trading hours / outside interval
}

async function startServer() {
  const app = express();
  const PORT = process.env.PORT || 3000;

  app.use(express.json());

  app.post('/api/market-data', async (req, res) => {
    try {
      const fundsList = req.body.funds || [
        { symbol: 'QQQ', etfSymbol: 'QQQM' },
        { symbol: 'SPY', etfSymbol: 'VOO' }
      ];

      const [vix, qqqQuote, spyQuote] = await Promise.all([
        yf.quote('^VIX').catch(() => ({ regularMarketPrice: 15.0 })),
        yf.quote('QQQ').catch(() => null),
        yf.quote('SPY').catch(() => null)
      ]);
      
      const globalPe = {
         NDX: (qqqQuote?.trailingPE || qqqQuote?.forwardPE || 35.1) * 1.0577,
         SPX: (spyQuote?.trailingPE || spyQuote?.forwardPE || 28.1) * 1.0506
      };

      const results = {};

      const getPremium = (price, nav) => {
        if (!price || !nav) return null;
        return ((price - nav) / nav) * 100;
      };

      const fetchEastMoneyInfo = async (symbol) => {
        try {
          const match = symbol.match(/^(\d{6})/);
          if (!match) return null;
          const code = match[1];

          // ----- Caching Layer -----
          if (!shouldFetchQdii(code)) {
            // console.log(`[Cache Hit] Using cached data for ${code}`);
            return qdiiCache.get(code).data;
          }
          // console.log(`[Cache Miss] Fetching fresh data for ${code}`);
          // -------------------------

          let isSZ = '0'; // Default to SZ
          if (symbol.endsWith('.SS') || code.startsWith('5')) {
             isSZ = '1';
          }
          
          let result = { nav: null, name: null, price: null, change: null };

          const headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Referer': 'http://fund.eastmoney.com/'
          };

          // 1. Fetch Official Name and NAV
          const navUrl = `http://fundgz.1234567.com.cn/js/${code}.js?rt=${new Date().getTime()}`;
          const navRes = await fetch(navUrl, { headers }).catch(() => null);
          if (navRes) {
            const text = await navRes.text();
            const jsonStr = text.match(/jsonpgz\((.*)\);/);
            if (jsonStr && jsonStr[1]) {
              const data = JSON.parse(jsonStr[1]);
              result.nav = parseFloat(data.gsz) || parseFloat(data.dwjz);
              result.name = data.name;
            }
          }

          // 2. Fetch Spot Price & IOPV (Real-time NAV from Tencent)
          const marketPrefix = code.startsWith('5') ? 'sh' : 'sz';
          const tencentUrl = `http://qt.gtimg.cn/q=${marketPrefix}${code}`;
          const tencentRes = await fetch(tencentUrl, { headers }).catch(() => null);
          if (tencentRes) {
             const tencentText = await tencentRes.text();
             if (tencentText && tencentText.includes('~')) {
                 const arr = tencentText.split('~');
                 if (arr.length > 80) {
                     const tPrice = parseFloat(arr[3]);
                     const tPrev = parseFloat(arr[4]);
                     result.price = (!isNaN(tPrice) && tPrice > 0) ? tPrice : (!isNaN(tPrev) && tPrev > 0 ? tPrev : result.price);
                     
                     const tChange = parseFloat(arr[32]);
                     if (!isNaN(tChange)) {
                         result.change = tChange;
                     }
                     
                     // Index 78 is IOPV (实时参考净值). If missing or 0, fallback to what we already have or dwjz (Index 81)
                     const tIOPV = parseFloat(arr[78]);
                     if (!isNaN(tIOPV) && tIOPV > 0) {
                         result.nav = tIOPV;
                     } else {
                         const tDWJZ = parseFloat(arr[81]);
                         if (!isNaN(tDWJZ) && tDWJZ > 0 && !result.nav) {
                             result.nav = tDWJZ; 
                         }
                     }
                 }
             }
          }
          
          // 3. Fallback to Eastmoney if Tencent failed
          if (result.price == null) {
            const stockUrl = `http://push2.eastmoney.com/api/qt/stock/get?secid=${isSZ}.${code}&fields=f2,f43,f170`;
            const stockRes = await fetch(stockUrl, { headers }).catch(() => null);
            if (stockRes) {
              const stockJson = await stockRes.json();
              if (stockJson && stockJson.data) {
                 const f2 = parseFloat(stockJson.data.f2);
                 const f43 = parseFloat(stockJson.data.f43);
                 result.price = (!isNaN(f2) && f2 > 0) ? (f2 / 1000) : (!isNaN(f43) && f43 > 0 ? (f43 / 1000) : null);
                 const f170 = parseFloat(stockJson.data.f170);
                 if (!isNaN(f170)) {
                     result.change = f170 / 100;
                 }
              }
            }
          }
          
          // Only cache valid results that have actual data
          if (result.price != null || result.nav != null) {
              qdiiCache.set(code, {
                  data: result,
                  timestamp: Date.now(),
                  dateStr: getBjDateStr(getBjDate())
              });
          }

          return result;
        } catch (e) {
          console.error('EastMoney fetch error for', symbol, e.message);
        }
        return null;
      };

      const fetchYahooRaw = async (sym) => {
        try {
          const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(sym)}?interval=1d&range=1d`;
          const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
          const data = await res.json();
          const meta = data.chart?.result?.[0]?.meta;
          if (meta) {
              return {
                  regularMarketPrice: meta.regularMarketPrice,
                  regularMarketChangePercent: (meta.regularMarketPrice - meta.chartPreviousClose) / meta.chartPreviousClose * 100
              };
          }
        } catch (e) {
          console.error('Raw Yahoo fetch failed for:', sym, e.message);
        }
        return null;
      };

      await Promise.all(fundsList.map(async (fund) => {
        if (!fund.symbol) return;
        try {
          const etfTarget = fund.etfSymbol || fund.symbol;
          const isChineseFund = /^\d{6}(?:\.SZ|\.SS)?$/i.test(etfTarget) || /^\d{6}/.test(etfTarget);
          
          let anchorSymbol = fund.symbol;
          if (anchorSymbol === 'NDX') anchorSymbol = '^NDX';
          if (anchorSymbol === 'SPX') anchorSymbol = '^SPX';
          if (fund.matrix === 'NDX' && isChineseFund) anchorSymbol = 'QQQ';
          if (fund.matrix === 'SPX' && isChineseFund) anchorSymbol = 'SPY';
          
          let etfFetchSymbol = fund.etfSymbol || anchorSymbol;
          if (etfFetchSymbol === 'NDX') etfFetchSymbol = '^NDX';
          if (etfFetchSymbol === 'SPX') etfFetchSymbol = '^SPX';

          const [quote, etfQuote, etfSummary, emFundData] = await Promise.all([
            yf.quote(anchorSymbol).catch(() => fetchYahooRaw(anchorSymbol)),
            yf.quote(etfFetchSymbol).catch(() => fetchYahooRaw(etfFetchSymbol)),
            !isChineseFund ? yf.quoteSummary(etfFetchSymbol, { modules: ['summaryDetail', 'price'] }).catch(() => null) : null,
            isChineseFund ? fetchEastMoneyInfo(etfTarget) : null
          ]);

          if (quote || etfQuote || emFundData) {
            
            let navPrice = etfSummary?.summaryDetail?.navPrice || etfSummary?.summaryDetail?.previousClose;
            if (typeof navPrice === 'object' && navPrice !== null) { // Handle Yahoo Finance SDK returns which sometimes are objects with { raw, fmt }
               navPrice = navPrice.raw;
            }
            let displayPrice = etfQuote?.regularMarketPrice || quote?.regularMarketPrice || 0;
            let displayChange = etfQuote?.regularMarketChangePercent || quote?.regularMarketChangePercent || 0;
            let displayName = fund.etfSymbol || fund.symbol;
            
            // For Chinese ETFs, anchor quote might be QQQ or SPY, 
            // but we must use the ETF's actual quote for change and price if we use Yahoo
            if (isChineseFund && etfQuote) {
               displayPrice = etfQuote.regularMarketPrice || displayPrice;
               displayChange = etfQuote.regularMarketChangePercent || displayChange;
            }

            if (isChineseFund && emFundData) {
              navPrice = emFundData.nav;
              // Add real-time price processing if possible, or fallback to closing nav if spot price isn't available
              // Many times Yahoo also lacks the spot price for Chinese ETFs on weekend, so we use eastmoney's real price/NAV.
              displayPrice = emFundData.price != null ? emFundData.price : displayPrice;
              displayName = emFundData.name || displayName;
              
              // Note: If we had fetched Eastmoney's real-time change percent, we'd use it here. 
              // Without it, if Yahoo lacked etfQuote, displayChange might incorrectly be the Index's change.
              if (emFundData.change != null) {
                  displayChange = emFundData.change;
              } else if (!etfQuote) {
                 displayChange = 0; // Better to show 0 than QQQ's change for the ETF itself
              }
            }

          let fundPe = quote?.trailingPE || quote?.forwardPE || (anchorSymbol === 'QQQ' ? 35.1 : 28.1);
          if (fund.matrix === 'NDX') fundPe *= 1.0577; // calibrates QQQ ~34.17 to NDX ~36.14
          if (fund.matrix === 'SPX') fundPe *= 1.0506; // calibrates SPY ~28.09 to SPX ~29.52 (Wind data)

            results[fund.symbol] = {
              price: displayPrice,
              change: displayChange,
              pe: fundPe,
              etf: {
                name: displayName,
                price: displayPrice,
                nav: navPrice,
                premium: getPremium(displayPrice, navPrice)
              }
            };
          }
        } catch (e) {
          console.error(`Error processing ${fund.symbol}:`, e);
        }
      }));

      res.json({
        vix: { price: vix.regularMarketPrice || 15.0 },
        globalPe,
        data: results
      });
    } catch (error) {
      console.error('Error fetching market data from Yahoo, using fallback data:', error);
      res.json({
        vix: { price: 15.2 },
        globalPe: { NDX: 36.14, SPX: 28.1 * 1.0506 },
        data: {
          'QQQ': { price: 435.12, change: 0.5, pe: 34.2, etf: { name: 'QQQM', price: 180, nav: 179, premium: 0.5 } },
          'SPY': { price: 512.45, change: 0.3, pe: 26.5, etf: { name: 'VOO', price: 450, nav: 449, premium: 0.2 } },
        }
      });
    }
  });

  const historyCache = {};

  async function fetchHistoryForSymbol(symbol) {
      const match = symbol.match(/^(\d{6})/);
      if (!match) return [];
      const code = match[1];
      let isSZ = '0';
      if (symbol.endsWith('.SS') || code.startsWith('5')) isSZ = '1';

      // 1. Fetch ~750 trading days (3 yrs) price
      const headers = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Referer': 'http://fund.eastmoney.com/'
      };
      
      const klineUrl = `http://push2his.eastmoney.com/api/qt/stock/kline/get?secid=${isSZ}.${code}&fields1=f1&fields2=f51,f53&klt=101&fqt=1&end=20500101&lmt=750`;
      const klineRes = await fetch(klineUrl, { headers }).catch(e => {
          console.error("kline fetch failed:", e);
          return null;
      });
      if (!klineRes) {
          console.error("klineRes is null for", code);
          return [];
      }
      if (!klineRes.ok) {
          console.error("klineRes not ok:", klineRes.status, klineRes.statusText);
      }
      const klineData = await klineRes.json();
      
      // 2. Fetch full NAV history from pingzhongdata JS
      const navJsUrl = `http://fund.eastmoney.com/pingzhongdata/${code}.js`;
      const navJsRes = await fetch(navJsUrl, { headers }).catch(e => {
          console.error("navJs fetch failed:", e);
          return null;
      });
      if (!navJsRes) {
          console.error("navJsRes is null for", code);
          return [];
      }
      if (!navJsRes.ok) {
          console.error("navJsRes not ok:", navJsRes.status, navJsRes.statusText);
      }
      const navJsText = await navJsRes.text();
      
      const navMatch = navJsText.match(/Data_netWorthTrend\s*=\s*(\[.*?\])\s*;/);
      if (!navMatch) {
          console.error("Could not find Data_netWorthTrend in response for", code, navJsText.substring(0, 100));
          return [];
      }
      const navList = JSON.parse(navMatch[1]);

      if (!klineData.data || !navList.length) {
         return [];
      }

      const prices = {};
      klineData.data.klines.forEach(k => {
        const parts = k.split(',');
        prices[parts[0]] = parseFloat(parts[1]);
      });

      const history = [];
      navList.forEach(item => {
        // item.x is ms timestamp. Convert to YYYY-MM-DD in UTC+8
        const dateObj = new Date(item.x + 8 * 3600000);
        const dateStr = dateObj.toISOString().split('T')[0];
        
        const nav = parseFloat(item.y);
        const price = prices[dateStr];
        
        if (nav && price) {
          history.push({
            date: dateStr,
            premium: ((price - nav) / nav) * 100
          });
        }
      });

      history.sort((a,b) => new Date(a.date) - new Date(b.date));
      return history;
  }

  app.get('/api/fund-history/:symbol', async (req, res) => {
    try {
      const symbol = req.params.symbol;
      
      const cacheEntry = historyCache[symbol];
      const now = Date.now();
      
      // Serve from cache if it was updated in the last 3 minutes (180,000 ms)
      if (cacheEntry && (now - cacheEntry.timestamp < 180000)) {
         return res.json({ history: cacheEntry.data });
      }

      // Otherwise fetch, update cache, and serve
      const history = await fetchHistoryForSymbol(symbol);
      
      if (history.length > 0) {
          historyCache[symbol] = {
              timestamp: now,
              data: history
          };
      }
      
      res.json({ history });
    } catch (error) {
      console.error('History error:', error);
      res.json({ history: [] });
    }
  });

  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
