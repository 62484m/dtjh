import React, { useEffect, useState, useRef } from 'react';
import { format } from 'date-fns';
import { cn } from './lib/utils';
import { ArrowUpRight, ArrowDownRight, ChevronLeft, ChevronRight, ChevronDown, Info, Flame, Settings, Plus, X, Trash2, Copy, Check } from 'lucide-react';
import { supabase } from './supabase';
import { LineChart, Line, XAxis, YAxis, ReferenceLine, ResponsiveContainer } from 'recharts';

interface MarketData {
  price: number;
  change: number;
  pe: number;
  etf?: {
    name: string;
    price: number;
    nav?: number;
    premium?: number | null;
  } | null;
}

interface FundConfig {
  id: string;
  name: string;
  symbol: string;
  etfSymbol?: string;
  matrix?: 'NDX' | 'SPX';
}

const defaultFunds: FundConfig[] = [
  { id: 'spy', name: '标普500', symbol: 'SPX', etfSymbol: 'VOO', matrix: 'SPX' },
  { id: 'qqq', name: '纳指100', symbol: 'NDX', etfSymbol: 'QQQM', matrix: 'NDX' },
];

interface AppData {
  data: Record<string, MarketData>;
  vix: { price: number } | null;
  globalPe?: { NDX: number; SPX: number };
}

const ndxMatrixData = [
  { peLabel: '>37', peRange: [37, Infinity], bgSolid: 'bg-[#841a18]', cells: ['暂停', '暂停', '观望', '0.3倍'] },
  { peLabel: '35-37', peRange: [35, 37], bgSolid: 'bg-[#c52828]', cells: ['暂停', '0.2倍', '0.4倍', '0.6倍'] },
  { peLabel: '32-35', peRange: [32, 35], bgSolid: 'bg-[#e26715]', cells: ['0.3倍', '0.5倍', '0.8倍', '1.2倍'] },
  { peLabel: '28-32', peRange: [28, 32], bgSolid: 'bg-[#f49c14]', cells: ['0.6倍', '0.8倍', '1.2倍', '2.0倍'] },
  { peLabel: '24-28', peRange: [24, 28], bgSolid: 'bg-[#f0c30f]', cells: ['1.0倍', '1.5倍', '2.5倍', '4.0倍'] },
  { peLabel: '20-24', peRange: [20, 24], bgSolid: 'bg-[#21b25b]', cells: ['2.0倍', '3.5倍', '6.0倍', '9.0倍'] },
  { peLabel: '16-20', peRange: [16, 20], bgSolid: 'bg-[#1e8b4c]', cells: ['4.0倍', '7.0倍', '12.0倍', '顶格'] },
  { peLabel: '<16', peRange: [-Infinity, 16], bgSolid: 'bg-[#8e44ad]', cells: ['顶格', '顶格', '顶格', '顶格'] },
];

const ndxVixCols = [
  { label: '<18', range: [-Infinity, 18] },
  { label: '18-24', range: [18, 24] },
  { label: '24-31', range: [24, 31] },
  { label: '>31', range: [31, Infinity] },
];

const spxMatrixData = [
  { peLabel: '>32', peRange: [32, Infinity], bgSolid: 'bg-[#841a18]', cells: ['暂停', '暂停', '观望', '0.3倍'] },
  { peLabel: '29-32', peRange: [29, 32], bgSolid: 'bg-[#c52828]', cells: ['暂停', '0.3倍', '0.5倍', '0.8倍'] },
  { peLabel: '26-29', peRange: [26, 29], bgSolid: 'bg-[#e26715]', cells: ['0.3倍', '0.5倍', '0.8倍', '1.2倍'] },
  { peLabel: '23-26', peRange: [23, 26], bgSolid: 'bg-[#f49c14]', cells: ['0.6倍', '0.8倍', '1.5倍', '2.0倍'] },
  { peLabel: '20-23', peRange: [20, 23], bgSolid: 'bg-[#f0c30f]', cells: ['1.2倍', '2.0倍', '3.0倍', '4.5倍'] },
  { peLabel: '17-20', peRange: [17, 20], bgSolid: 'bg-[#21b25b]', cells: ['2.5倍', '4.0倍', '7.0倍', '10.0倍'] },
  { peLabel: '14-17', peRange: [14, 17], bgSolid: 'bg-[#1e8b4c]', cells: ['5.0倍', '8.0倍', '14.0倍', '顶格'] },
  { peLabel: '<14', peRange: [-Infinity, 14], bgSolid: 'bg-[#8e44ad]', cells: ['顶格', '顶格', '顶格', '顶格'] },
];

const spxVixCols = [
  { label: '<18', range: [-Infinity, 18] },
  { label: '18-25', range: [18, 25] },
  { label: '25-35', range: [25, 35] },
  { label: '>35', range: [35, Infinity] },
];

function getQqqRowIndex(pe: number) {
  if (pe > 37) return 0;
  if (pe > 35) return 1;
  if (pe > 32) return 2;
  if (pe > 28) return 3;
  if (pe > 24) return 4;
  if (pe > 20) return 5;
  if (pe > 16) return 6;
  return 7;
}

function getQqqColIndex(vix: number) {
  if (vix < 18) return 0;
  if (vix < 24) return 1;
  if (vix < 31) return 2;
  return 3;
}

function getSpyRowIndex(pe: number) {
  if (pe > 32) return 0;
  if (pe > 29) return 1;
  if (pe > 26) return 2;
  if (pe > 23) return 3;
  if (pe > 20) return 4;
  if (pe > 17) return 5;
  if (pe > 14) return 6;
  return 7;
}

function getSpyColIndex(vix: number) {
  if (vix < 18) return 0;
  if (vix < 25) return 1;
  if (vix < 35) return 2;
  return 3;
}

function getValuationLevel(row: number) {
  if (row <= 1) return { label: '估值极高区间', color: 'text-[#841a18]', bg: 'bg-[#841a18]/10' };
  if (row <= 3) return { label: '估值偏高区间', color: 'text-[#e26715]', bg: 'bg-[#e26715]/10' };
  if (row === 4) return { label: '正常估值区间', color: 'text-[#d4a806]', bg: 'bg-[#d4a806]/10' };
  if (row <= 6) return { label: '估值偏低区间', color: 'text-[#1e8b4c]', bg: 'bg-[#1e8b4c]/10' };
  return { label: '极度低估区间', color: 'text-[#8e44ad]', bg: 'bg-[#8e44ad]/10' };
}

function getPePercentile(ticker: 'NDX' | 'SPX' | string, pe: number): string {
  if (ticker === 'NDX') {
    const range = { min: 15.86, max: 42.45 };
    let pct = ((pe - range.min) / (range.max - range.min)) * 100;
    if (pct > 99.9) pct = 99.9;
    if (pct < 0.1) pct = 0.1;
    return pct.toFixed(1);
  } else if (ticker === 'SPX') {
    const range = { min: 13.80, max: 37.15 };
    let pct = ((pe - range.min) / (range.max - range.min)) * 100;
    if (pct > 99.9) pct = 99.9;
    if (pct < 0.1) pct = 0.1;
    return pct.toFixed(1);
  }
  return '-';
}

function PremiumChart({ symbol, currentPremium }: { symbol: string, currentPremium: number | null | undefined }) {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const [timeRange, setTimeRange] = useState('3y'); // Default to 3 years
  const [showDropdown, setShowDropdown] = useState(false);

  useEffect(() => {
    if (!symbol.match(/^\d{6}/)) {
      setLoading(false);
      return;
    }
    fetch(`/api/fund-history/${symbol}`)
      .then(r => r.json())
      .then(d => {
        if (d.history && d.history.length > 0) {
          setData(d.history);
        }
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [symbol]);

  if (!symbol.match(/^\d{6}/)) return null; // Only for Chinese funds
  if (loading) return <div className="animate-pulse h-32 bg-gray-100 rounded-xl mt-4"></div>;
  if (!data.length) return null;

  // Time range filtering
  const getCutoffDate = (range: string) => {
    const now = new Date();
    switch (range) {
      case 'ytd': return new Date(now.getFullYear(), 0, 1);
      case '1m': now.setMonth(now.getMonth() - 1); return now;
      case '3m': now.setMonth(now.getMonth() - 3); return now;
      case '6m': now.setMonth(now.getMonth() - 6); return now;
      case '1y': now.setFullYear(now.getFullYear() - 1); return now;
      case '3y': now.setFullYear(now.getFullYear() - 3); return now;
      default: return new Date(0);
    }
  };

  const cutoff = getCutoffDate(timeRange);
  const filteredData = data.filter(d => new Date(d.date) >= cutoff);
  // Fallback to all data if filtered is empty for some reason
  const chartData = filteredData.length > 0 ? filteredData : data;

  // Analysis logic
  const premiums = chartData.map(d => d.premium).filter(p => !isNaN(p));
  const max = Math.max(...premiums, currentPremium || -Infinity);
  const min = Math.min(...premiums, currentPremium || Infinity);
  
  // Percentiles
  const sorted = [...premiums].sort((a,b) => a-b);
  const p70 = sorted[Math.floor(sorted.length * 0.7)] || 0;
  const p30 = sorted[Math.floor(sorted.length * 0.3)] || 0;
  const avg = premiums.reduce((a,b) => a+b, 0) / (premiums.length || 1);

  let currentPct = 50;
  if (currentPremium !== null && currentPremium !== undefined && sorted.length > 0) {
     const countBelow = sorted.filter(p => p < currentPremium).length;
     currentPct = Math.round((countBelow / sorted.length) * 100);
  }

  const cp = currentPremium ?? (chartData[chartData.length-1]?.premium || 0);

  const ranges = [
    { value: 'ytd', label: '今年以来' },
    { value: '1m', label: '近1月' },
    { value: '3m', label: '近3月' },
    { value: '6m', label: '近6月' },
    { value: '1y', label: '近1年' },
    { value: '3y', label: '近3年' }
  ];
  const activeRangeLabel = ranges.find(r => r.value === timeRange)?.label || '近3年';

  return (
    <div className="bg-[#f8fafc] rounded-xl p-4 border border-gray-100 shadow-[0_2px_10px_rgba(0,0,0,0.02)] mt-5">
      <div className="flex items-center justify-between mb-3 relative">
        <div className="flex items-center gap-1.5">
          <h3 className="text-[14px] font-bold text-[#333]">溢折率分析</h3>
          <Info size={14} className="text-gray-400" />
        </div>
        <div className="relative">
          <button 
            onClick={() => setShowDropdown(!showDropdown)}
            className="flex items-center gap-1 text-[13px] font-medium text-[#475569] hover:text-[#1e293b] transition-colors"
          >
            {activeRangeLabel}
            <ChevronDown size={14} />
          </button>
          
          {showDropdown && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setShowDropdown(false)}></div>
              <div className="absolute right-0 top-full mt-1 w-24 bg-white rounded-lg shadow-lg border border-gray-100 py-1 z-20">
                {ranges.map(range => (
                  <button
                    key={range.value}
                    onClick={() => {
                      setTimeRange(range.value);
                      setShowDropdown(false);
                    }}
                    className={cn(
                      "w-full text-center px-4 py-2 text-[13px] transition-colors",
                      timeRange === range.value ? "text-[#ef4444] font-medium" : "text-[#64748b] hover:bg-gray-50"
                    )}
                  >
                    {range.label}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
      
      <div className="flex flex-col gap-1 mb-4">
         <div className="flex justify-between items-end">
           <span className="text-[#64748b] text-[12px]">当前溢折率 <span className={cn("font-bold text-[13px]", cp > 0 ? "text-[#ef4444]" : "text-[#22c55e]")}>{cp > 0 ? '+' : ''}{cp.toFixed(2)}%</span></span>
           <span className="text-[#64748b] text-[11px]">(最大溢折率+{max.toFixed(2)}%)</span>
         </div>
         <div className="text-[#64748b] text-[12px]">同指数ETF平均溢折率 <span className={cp > avg ? "text-[#ef4444]" : "text-[#22c55e]"}>{avg > 0 ? '+' : ''}{avg.toFixed(2)}%</span></div>
      </div>

      <div className="h-[120px] w-full relative">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartData} margin={{ top: 5, right: 0, left: -20, bottom: 0 }}>
            <XAxis dataKey="date" hide />
            <YAxis domain={['auto', 'auto']} hide />
            <ReferenceLine y={p70} stroke="#ef4444" strokeDasharray="3 3" />
            <ReferenceLine y={p30} stroke="#22c55e" strokeDasharray="3 3" />
            <Line type="stepAfter" dataKey="premium" stroke="#f59e0b" strokeWidth={1.5} dot={false} isAnimationActive={false} />
          </LineChart>
        </ResponsiveContainer>
        {/* Labels overlay */}
        <div className="absolute top-0 left-0 h-full w-full pointer-events-none opacity-50 text-[9px] text-[#64748b]">
           <div className="absolute left-0" style={{ top: '20%' }}>70分位 {p70.toFixed(2)}%</div>
           <div className="absolute left-0" style={{ top: '60%' }}>30分位 {p30.toFixed(2)}%</div>
        </div>
      </div>

      <div className="flex justify-between text-[10px] text-[#94a3b8] mt-1 border-b border-gray-200/50 pb-2">
         <span>{chartData[0]?.date}</span>
         <span>{chartData[chartData.length-1]?.date}</span>
      </div>

      <div className="flex justify-between items-center text-[11px] mt-3 mb-3 px-2">
         <span className="flex items-center gap-1 text-[#ef4444]"><span className="w-2 h-[2px] bg-[#ef4444] inline-block"></span> 70分位值 <b>{p70.toFixed(2)}%</b></span>
         <span className="flex items-center gap-1 text-[#22c55e]"><span className="w-2 h-[2px] bg-[#22c55e] inline-block"></span> 30分位值 <b>{p30.toFixed(2)}%</b></span>
         <span className="flex items-center gap-1 text-[#f59e0b]"><span className="w-2 h-[2px] bg-[#f59e0b] inline-block"></span> 溢折率</span>
      </div>

      <div className="bg-gray-100/50 rounded p-2.5 text-[12px] text-[#475569] leading-relaxed">
        <span className="text-[#ef4444] font-bold">解读：</span> 当前ETF溢折率{cp.toFixed(2)}%，超过历史 <span className="font-bold text-[#eab308]">{currentPct}%</span> 的时间，处于 
        {currentPct > 80 ? '高风险区，偏离净值幅度较大，存在回落风险。' : currentPct > 60 ? '中风险区，建议密切关注溢价率走势及市场变化。' : currentPct > 30 ? '正常波动区间，属于合理范围。' : '折价低估区，具备一定的安全垫。'}
      </div>
    </div>
  );
}

export default function App() {
  const [fundsConfig, setFundsConfig] = useState<FundConfig[]>(defaultFunds);
  const [isConfigLoaded, setIsConfigLoaded] = useState(false);

  const [marketData, setMarketData] = useState<AppData | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedView, setSelectedView] = useState<string>('dashboard');
  const [thermometerMatrix, setThermometerMatrix] = useState<'NDX' | 'SPX' | null>(null);

  const defaultDate = new Date();
  defaultDate.setDate(defaultDate.getDate() - 58);
  const defaultDateStr = defaultDate.toISOString().split('T')[0];

  const [startDate, setStartDate] = useState<string>(defaultDateStr);

  const [uid, setUid] = useState<string>('');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    // 1. Initialize UID
    const params = new URLSearchParams(window.location.search);
    const urlUid = params.get('uid');
    let currentUid = localStorage.getItem('hadwin_uid');

    if (urlUid) {
      // If opened via share link, use that UID
      currentUid = urlUid;
      localStorage.setItem('hadwin_uid', currentUid);
      // Clean up URL visually (optional, depending on environment, but safe enough here)
      window.history.replaceState({}, document.title, window.location.pathname);
    } else if (!currentUid) {
      // Generate a new unique ID for this browser
      currentUid = `user_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
      localStorage.setItem('hadwin_uid', currentUid);
    }
    
    setUid(currentUid);
  }, []);

  // Load config from Supabase
  useEffect(() => {
    if (!uid) return;
    
    async function loadConfig() {
      try {
        const { data, error } = await supabase
          .from('hadwin_config')
          .select('start_date, funds')
          .eq('id', uid)
          .single();
        
        if (data && !error) {
          if (data.start_date) setStartDate(data.start_date);
          if (data.funds && Array.isArray(data.funds)) setFundsConfig(data.funds);
        } else if (error && error.code === 'PGRST116') {
          // No row found, we can silently ignore and it will use defaultFunds
        }
      } catch (err) {
        console.error('Error fetching Supabase config:', err);
      } finally {
        setIsConfigLoaded(true);
      }
    }
    loadConfig();
  }, [uid]);

  const handleDateChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    if (val && uid) {
      setStartDate(val);
      await supabase.from('hadwin_config').upsert({ id: uid, start_date: val, funds: fundsConfig }, { onConflict: 'id' });
    }
  };

  const today = new Date();
  const start = new Date(startDate);
  const diffTime = today.getTime() - start.getTime();
  const diffDays = Math.max(0, Math.floor(diffTime / (1000 * 60 * 60 * 24)));

  const dateInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!isConfigLoaded) return;
    
    fetch('/api/market-data', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ funds: fundsConfig })
    })
      .then(async res => {
          if (!res.ok) {
            throw new Error('Network response was not ok');
          }
          return res.json();
      })
      .then(d => {
        setMarketData(d);
        setLoading(false);
      })
      .catch(err => {
        console.error('Fetch error:', err);
        setLoading(false);
      });
  }, [fundsConfig, isConfigLoaded]);

  const saveFunds = async (newFunds: FundConfig[]) => {
    setFundsConfig(newFunds);
    if (uid) {
      await supabase.from('hadwin_config').upsert({ id: uid, funds: newFunds, start_date: startDate }, { onConflict: 'id' });
    }
  };

  const copySyncLink = () => {
    const url = new URL(window.location.href);
    url.searchParams.set('uid', uid);
    navigator.clipboard.writeText(url.toString());
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const renderProfile = () => {
    return (
      <div className="min-h-screen bg-black text-white relative flex flex-col">
        <div className="sticky top-0 z-50 bg-black/80 backdrop-blur-xl border-b border-white/10 px-4 py-4 flex items-center">
          <button 
            onClick={() => setSelectedView('dashboard')}
            className="text-[#0a84ff] flex items-center gap-1 hover:opacity-80 transition-opacity absolute left-4"
          >
            <ChevronLeft size={24} className="-ml-2" />
            <span className="text-[17px] font-medium">返回</span>
          </button>
          
          <div className="w-full text-center pointer-events-none">
            <h1 className="text-[17px] font-semibold tracking-tight">配置主页</h1>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-5 pb-20 max-w-md mx-auto w-full">
          <div className="mb-8">
            <h2 className="text-[13px] font-medium text-[#86868b] uppercase tracking-wider mb-2 px-2">基础设置</h2>
            <div className="bg-[#1c1c1e] rounded-[16px] p-4 flex flex-col gap-4 border border-white/5">
              <div className="flex items-center justify-between">
                <span className="text-[15px] font-medium">初始定投起点</span>
                <input 
                  type="date"
                  onChange={handleDateChange}
                  value={startDate}
                  className="bg-transparent text-white text-[15px] outline-none text-right font-medium"
                />
              </div>
              <div className="border-t border-white/5"></div>
              <div className="flex items-center justify-between">
                <div className="flex flex-col gap-0.5">
                   <span className="text-[15px] font-medium">多设备同步</span>
                   <span className="text-[11px] text-[#86868b]">复制链接，在手机或其他设备打开</span>
                </div>
                <button 
                  onClick={copySyncLink}
                  className="bg-white/10 hover:bg-white/20 text-white rounded-lg px-3 py-1.5 flex items-center gap-1.5 text-[13px] font-medium transition-colors"
                >
                  {copied ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}
                  {copied ? '已复制' : '复制链接'}
                </button>
              </div>
            </div>
          </div>

          <div className="mb-8">
            <h2 className="text-[13px] font-medium text-[#86868b] uppercase tracking-wider mb-2 px-2 flex justify-between items-center">
              <span>我关注的基金/指数</span>
              <button 
                onClick={() => {
                  const newFund: FundConfig = { id: Date.now().toString(), name: '', symbol: '', matrix: 'NDX' };
                  saveFunds([...fundsConfig, newFund]);
                }}
                className="text-[#0a84ff] flex items-center gap-0.5 text-[13px] font-medium hover:opacity-80"
              >
                <Plus size={14} /> 添加
              </button>
            </h2>
            
            <div className="space-y-3">
              {fundsConfig.map((fund, index) => (
                <div key={fund.id} className="bg-[#1c1c1e] rounded-[16px] p-4 border border-white/5">
                  <div className="flex justify-between items-start mb-3">
                    <input 
                      type="text" 
                      value={fund.name} 
                      onChange={e => {
                        const next = [...fundsConfig];
                        next[index].name = e.target.value;
                        saveFunds(next);
                      }}
                      className="bg-transparent text-[17px] font-semibold text-white outline-none w-1/2 border-b border-transparent focus:border-white/20 transition-colors pb-0.5"
                      placeholder={marketData?.data[fund.symbol]?.etf?.name || "自定义名称 (留空自动获取)"}
                    />
                    <button 
                      onClick={() => {
                        const next = fundsConfig.filter(f => f.id !== fund.id);
                        saveFunds(next);
                      }}
                      className="text-red-500/80 hover:text-red-500 p-1"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                  
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <span className="text-[#86868b] text-[13px] w-20">资产代码</span>
                      <input 
                        type="text" 
                        value={fund.symbol} 
                        onChange={e => {
                          const next = [...fundsConfig];
                          next[index].symbol = e.target.value.toUpperCase();
                          saveFunds(next);
                        }}
                        className="flex-1 bg-black/50 border border-white/10 rounded-lg px-2.5 py-1.5 text-[13px] text-white outline-none focus:border-[#0a84ff]/50"
                        placeholder="如: 159501, NDX"
                      />
                    </div>
                    
                    <div className="flex items-center gap-2">
                      <span className="text-[#86868b] text-[13px] w-20">高级绑定</span>
                      <input 
                        type="text" 
                        value={fund.etfSymbol || ''} 
                        onChange={e => {
                          const next = [...fundsConfig];
                          next[index].etfSymbol = e.target.value.toUpperCase();
                          saveFunds(next);
                        }}
                        className="flex-1 bg-black/50 border border-white/10 rounded-lg px-2.5 py-1.5 text-[13px] text-white outline-none focus:border-[#0a84ff]/50 text-gray-400 placeholder:text-gray-600"
                        placeholder="附加 ETF 代码 (选填)"
                      />
                    </div>
                    
                    <div className="flex items-center gap-2 mt-2">
                      <span className="text-[#86868b] text-[13px] w-20">策略引擎</span>
                      <select 
                        value={fund.matrix || ''} 
                        onChange={e => {
                          const next = [...fundsConfig];
                          next[index].matrix = (e.target.value as 'NDX' | 'SPX') || undefined;
                          saveFunds(next);
                        }}
                        className="flex-1 bg-black/50 border border-white/10 rounded-lg px-2 py-1.5 text-[13px] text-white outline-none focus:border-[#0a84ff]/50 appearance-none"
                      >
                        <option value="">无 (仅展示行情)</option>
                        <option value="NDX">纳指100策略 (激进型)</option>
                        <option value="SPX">标普500策略 (稳健型)</option>
                      </select>
                    </div>
                  </div>
                </div>
              ))}
              {fundsConfig.length === 0 && (
                <div className="text-center py-6 text-[#86868b] text-[13px]">
                  还没有关注任何基金
                </div>
              )}
            </div>
            <div className="mt-4 text-[12px] text-[#86868b] leading-relaxed">
              * 提示：对于 A股/QDII基金，您可以直接输入6位代码（如 <code>159501</code>）。系统会自动在后台匹配最新净值及溢价率。
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderDashboard = () => {
    return (
      <div className="min-h-svh w-full relative bg-gradient-to-b from-[#1c1212] via-[#0f0a0a] to-[#050505] text-white p-4 flex flex-col items-center overflow-x-hidden">
        {/* Stars Background */}
        <div className="absolute inset-0 z-0 pointer-events-none opacity-40 select-none">
          <div className="absolute top-[8%] left-[15%] w-[3px] h-[3px] bg-white rounded-full opacity-60 shadow-[0_0_8px_white]"></div>
          <div className="absolute top-[15%] left-[85%] w-[4px] h-[4px] bg-white rounded-full opacity-30 shadow-[0_0_8px_white]"></div>
          <div className="absolute top-[35%] left-[8%] w-[2px] h-[2px] bg-white rounded-full opacity-40 shadow-[0_0_8px_white]"></div>
          <div className="absolute top-[25%] left-[80%] w-[3px] h-[3px] bg-white rounded-full opacity-80 shadow-[0_0_8px_white]"></div>
          <div className="absolute top-[60%] left-[10%] w-[4px] h-[4px] bg-white rounded-full opacity-30 shadow-[0_0_8px_white]"></div>
          <div className="absolute top-[50%] left-[85%] w-[2px] h-[2px] bg-white rounded-full opacity-50 shadow-[0_0_8px_white]"></div>
          <div className="absolute top-[85%] left-[20%] w-[3px] h-[3px] bg-white rounded-full opacity-60 shadow-[0_0_8px_white]"></div>
          <div className="absolute top-[75%] left-[75%] w-[4px] h-[4px] bg-white rounded-full opacity-40 shadow-[0_0_8px_white]"></div>
        </div>

        <div className="w-full max-w-sm flex flex-col items-center justify-center flex-1 z-10 py-10 gap-8">
          
          {/* Profile Button */}
          <button 
            onClick={() => setSelectedView('profile')}
            className="absolute top-6 right-6 p-2 text-white/50 hover:text-white transition-colors bg-white/5 rounded-full backdrop-blur-md border border-white/10"
            title="个人主页配置"
          >
            <Settings size={20} />
          </button>

          <div className="text-center flex-shrink-0 w-full mt-2">
            <h1 className="text-[26px] md:text-[28px] font-black italic tracking-widest mb-3 text-white" style={{ textShadow: '0 2px 10px rgba(0,0,0,0.4)', fontFamily: 'system-ui, -apple-system, sans-serif' }}>
              Hadwin退休计划
            </h1>
            <p className="text-[#a09e9e] text-[13px] md:text-[14px] font-medium tracking-[0.25em]">自律定投 · 复利为王</p>
          </div>

          <div className="text-center flex-shrink-0 w-full">
            <div className="flex items-baseline justify-center gap-3">
              <span className="text-[#a09e9e] text-2xl font-bold tracking-tight pb-3">第</span>
              <div className="relative inline-block pb-3">
                <div 
                  className="text-[100px] md:text-[110px] leading-[0.85] font-black tracking-tighter text-white hover:opacity-80 transition-opacity relative z-10 font-sans"
                >
                  {diffDays}
                </div>
                <div className="absolute bottom-0 left-[-5px] right-[-5px] h-[5px] bg-white rounded-full"></div>
                <input 
                  type="date"
                  onChange={handleDateChange}
                  value={startDate}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-20"
                />
              </div>
              <span className="text-[#a09e9e] text-2xl font-bold tracking-tight pb-3">天</span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 md:gap-4 w-full flex-shrink-0 px-2 md:px-0">
            {fundsConfig.map(fund => {
              const displayTitle = fund.name && fund.name !== '新资金' 
                ? fund.name 
                : (marketData?.data?.[fund.symbol]?.etf?.name || fund.symbol || '未命名');
              
              // Fallback logic for old saved items missing a matrix
              let effMatrix = fund.matrix;
              if (!effMatrix && displayTitle) {
                 if (displayTitle.includes('标普') || displayTitle.includes('SPX')) {
                    effMatrix = 'SPX';
                 } else {
                    effMatrix = 'NDX'; // Default fallback
                 }
              }

              return (
                <IndexCard
                  key={fund.id}
                  title={displayTitle}
                  ticker={fund.symbol}
                  matrix={effMatrix}
                  data={marketData ? marketData.data[fund.symbol] : null}
                  vix={marketData?.vix?.price}
                  globalPe={marketData?.globalPe}
                  onClick={() => { setSelectedView(fund.id); setThermometerMatrix(effMatrix || 'NDX'); }}
                />
              );
            })}
          </div>
        </div>

        <div className="text-center text-[#6e6b6b] text-[12px] font-medium tracking-widest uppercase pb-10 mt-auto flex-shrink-0 relative z-10 w-full pt-6">
          - 做时间的朋友 -
        </div>
      </div>
    );
  };

  const renderThermometer = (indexName: string, indexData: MarketData | null, defaultMatrix: 'NDX' | 'SPX', symbol: string) => {
    if (!indexData || !marketData?.vix) return null;

    const activeMatrix = thermometerMatrix || defaultMatrix;
    const pe = marketData.globalPe ? marketData.globalPe[activeMatrix] : indexData.pe;
    const vix = marketData.vix.price;

    let multiplier;
    let activeRow;
    let activeCol;
    let matrixDataToUse;
    let vixColsToUse;
    
    if (activeMatrix === 'NDX') {
        activeRow = getQqqRowIndex(pe);
        activeCol = getQqqColIndex(vix);
        multiplier = ndxMatrixData[activeRow]?.cells[activeCol] || '-';
        matrixDataToUse = ndxMatrixData;
        vixColsToUse = ndxVixCols;
    } else {
        activeRow = getSpyRowIndex(pe);
        activeCol = getSpyColIndex(vix);
        multiplier = spxMatrixData[activeRow]?.cells[activeCol] || '-';
        matrixDataToUse = spxMatrixData;
        vixColsToUse = spxVixCols;
    }

    const prm = indexData.etf?.premium;
    let dispMultiplier = multiplier === '溢价过高' ? '0.0x' : (multiplier.replace('倍', 'x') || '0.0x');
    const valLevel = getValuationLevel(activeRow);

    let textColorClass = valLevel.color;
    let bgColorClass = valLevel.bg;
    if (multiplier === '暂停') { textColorClass = "text-[#ff3b30]"; bgColorClass = "bg-[#ff3b30]/10"; }
    else if (multiplier === '观望') { textColorClass = "text-[#86868b]"; bgColorClass = "bg-[#86868b]/10"; }
    else if (multiplier === '顶格') { textColorClass = "text-[#bf5af2]"; bgColorClass = "bg-[#bf5af2]/10"; }
    else if (multiplier.includes('倍')) { textColorClass = "text-[#0ea5e9]"; bgColorClass = "bg-[#0ea5e9]/10"; }

    return (
      <div className="min-h-screen bg-[#F5F6F8] text-[#333] font-sans pb-10">
        <div className="bg-gradient-to-b from-[#1e293b] to-[#0f172a] text-white pt-10 pb-[4.5rem] px-4 relative shadow-md">
          <button 
            onClick={() => setSelectedView('dashboard')}
            className="text-white/80 hover:text-white flex items-center gap-1 transition-opacity absolute left-4 top-10"
          >
            <ChevronLeft size={24} className="-ml-2" />
            <span className="text-[16px] font-medium">返回</span>
          </button>
          
          <div className="w-full text-center pointer-events-none mt-2 flex flex-col items-center">
            <div className="inline-flex items-center gap-2 mb-1.5">
              <span className="text-[22px] font-bold tracking-tight text-white">{indexName}</span>
              <span className="px-2 py-0.5 rounded-md bg-white/10 text-white/80 text-[11px] font-medium tracking-widest border border-white/5 backdrop-blur-sm">
                策略仪表盘
              </span>
            </div>
            <p className="text-[#94a3b8] text-[12px] tracking-wider flex items-center justify-center gap-1.5">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </span>
              实时测算 · {format(new Date(), 'MM-dd HH:mm')}
            </p>
          </div>
        </div>

        <div className="mx-auto max-w-[500px] px-3 relative -mt-10">
          <div className="bg-white rounded-xl shadow-[0_8px_30px_rgba(0,0,0,0.06)] py-4 flex items-center justify-between border border-gray-100">
            
            <div className="flex-1 flex flex-col items-center gap-1.5 px-0.5 relative group cursor-pointer hover:bg-gray-50 rounded-lg transition-colors py-1">
              <div className="flex items-center gap-0.5">
                <span className="text-[#888] text-[11px] font-medium uppercase">PE ({activeMatrix})</span>
                <ChevronDown size={12} className="text-[#888]" />
              </div>
              <span className="text-[18px] sm:text-[20px] font-bold text-[#1f2937] leading-none">{pe.toFixed(2)}</span>
              <span className="text-[9px] bg-[#94a3b8] text-white px-1.5 py-0.5 rounded leading-none whitespace-nowrap">历史 {getPePercentile(activeMatrix, pe)}%</span>
              
              <select 
                value={activeMatrix} 
                onChange={(e) => setThermometerMatrix(e.target.value as 'NDX'|'SPX')}
                className="absolute opacity-0 inset-0 w-full h-full cursor-pointer z-10"
              >
                <option value="NDX">纳指100 (NDX)</option>
                <option value="SPX">标普500 (SPX)</option>
              </select>
            </div>
            
            <div className="w-[1px] h-10 bg-gray-100 flex-shrink-0"></div>
            
            <div className="flex-1 flex flex-col items-center gap-1.5 px-0.5">
              <span className="text-[#888] text-[11px] font-medium uppercase">VIX</span>
              <span className={cn("text-[18px] sm:text-[20px] font-bold leading-none", vix > 24 ? "text-amber-600" : vix > 18 ? "text-amber-500" : "text-emerald-500")}>{vix.toFixed(1)}</span>
              <span className={cn("text-[9px] px-1.5 py-0.5 rounded leading-none whitespace-nowrap", vix > 24 ? "text-amber-600 bg-amber-50" : vix > 18 ? "text-amber-500 bg-amber-50" : "text-emerald-500 bg-emerald-50")}>
                {vix > 24 ? '极度恐慌' : vix > 18 ? '市场波动' : '市场平静'}
              </span>
            </div>
            
            <div className="w-[1px] h-10 bg-gray-100 flex-shrink-0"></div>

            <div className="flex-1 flex flex-col items-center justify-center gap-2 px-1">
              <span className="text-[#888] text-[12px] font-bold uppercase text-center w-full truncate" title={indexData.etf?.name || activeMatrix}>{indexData.etf?.name ? indexData.etf.name.replace('ETF', '') : activeMatrix}</span>
              <span className="text-[18px] sm:text-[20px] font-bold text-[#1f2937] leading-none">{indexData.etf?.price?.toFixed(2) || indexData.price.toFixed(2)}</span>
            </div>
            
            <div className="w-[1px] h-10 bg-gray-100 flex-shrink-0"></div>

            <div className="flex-1 flex flex-col items-center gap-1.5 px-0.5">
              <span className="text-[#888] text-[11px] font-medium">溢价率</span>
              <span className={cn("text-[16px] sm:text-[18px] font-bold leading-none", prm != null && prm > 3 ? "text-[#b91c1c]" : prm != null && prm > 0 ? "text-[#dc2626]" : "text-gray-700")}>
                {prm != null ? `${prm > 0 ? '+' : ''}${prm.toFixed(2)}%` : '-'}
              </span>
              <span className={cn("text-[9px] px-1.5 py-0.5 rounded leading-none whitespace-nowrap", prm != null && prm > 3 ? "text-red-700 bg-red-50" : prm != null && prm > 0 ? "text-red-600 bg-red-50" : "text-gray-500 bg-gray-100")}>
                {prm != null ? (prm > 3 ? '严重溢价' : prm > 0 ? '溢价偏高' : '折价区间') : '无数据'}
              </span>
            </div>
            
            <div className="w-[1px] h-10 bg-gray-100 flex-shrink-0"></div>

            <div className="flex-[1.2] flex flex-col items-center gap-1.5 px-0.5 relative">
              <span className="text-[#888] text-[11px] font-medium">配比</span>
              <span className={cn("text-[17px] sm:text-[18px] font-bold leading-none", textColorClass)}>
                 {dispMultiplier}
              </span>
              <span className={cn("text-[8px] sm:text-[9px] px-1 py-0.5 rounded leading-none whitespace-nowrap overflow-hidden max-w-full text-ellipsis", textColorClass, bgColorClass)}>
                 {valLevel.label}
              </span>
            </div>

          </div>

          <div className="flex items-center gap-2 mt-8 mb-3 px-2">
            <div className="w-1.5 h-4 bg-[#eab308] rounded-full"></div>
            <h2 className="text-[16px] font-bold text-[#1f2937]">精细化策略分布</h2>
          </div>

          <div className="bg-white rounded-xl overflow-hidden shadow-[0_2px_10px_rgba(0,0,0,0.04)] border border-gray-100/50">
            <table className="w-full text-center text-[12px] sm:text-[13px]">
              <thead>
                <tr className="border-b border-gray-100 bg-[#f8fafc]">
                  <th className="py-3 font-medium text-[#64748b] border-r border-gray-100 w-[20%] text-[10px] sm:text-[11px] uppercase tracking-wider">PE / VIX</th>
                  {vixColsToUse.map((col, i) => (
                    <th key={col.label} className={cn("py-3 font-medium text-[#64748b] w-[20%]", i !== vixColsToUse.length - 1 && "border-r border-gray-100")}>
                      {col.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {matrixDataToUse.map((row, rIdx) => (
                  <tr key={row.peLabel} className="border-b border-gray-100 last:border-0 relative">
                    <td className={cn("py-2.5 font-bold text-white border-r border-white/20 text-[11px] sm:text-[12px]", row.bgSolid)}>
                      {row.peLabel}
                    </td>
                    {row.cells.map((cell, cIdx) => {
                      const isActive = rIdx === activeRow && cIdx === activeCol;
                      
                      let cellTextColor = "text-[#64748b]";
                      if (cell === '暂停') cellTextColor = "text-[#f59e0b]";
                      else if (cell === '观望') cellTextColor = "text-[#a8a29e]";
                      else if (cell.includes('倍')) cellTextColor = "text-[#0ea5e9]";
                      else if (cell === '顶格') cellTextColor = "text-[#dc2626]";

                      let icon = null;
                      if (cell === '暂停') icon = <span className="text-[11px] sm:text-[12px]">⏸</span>;
                      if (cell === '观望') icon = <span className="text-[11px] sm:text-[12px]">☕</span>;
                      if (cell.includes('倍')) {
                        const parsedMulti = parseFloat(cell.split('倍')[0]);
                        icon = <span className="text-[11px] sm:text-[12px]">{parsedMulti < 1 ? '💧' : '🔥'}</span>;
                      }
                      if (cell === '顶格') icon = <span className="text-[11px] sm:text-[12px]">🚀</span>;

                      return (
                        <td 
                          key={cIdx} 
                          className={cn(
                            "py-2.5 relative bg-white h-[44px]",
                            cIdx !== row.cells.length - 1 && "border-r border-gray-100",
                            isActive && "bg-blue-50/50"
                          )}
                        >
                          {isActive ? (
                            <div className="absolute inset-px border-[2.5px] border-[#0ea5e9] shadow-[0_4px_12px_rgba(14,165,233,0.3)] bg-blue-50/90 z-20 flex items-center justify-center rounded-[6px] transform scale-[1.08] transition-all">
                              <div className="absolute -left-1.5 -top-1.5 text-[12px] filter drop-shadow-sm pointer-events-none">📍</div>
                              <div className={cn("font-bold flex items-center gap-1 text-[13px] sm:text-[14px]", cellTextColor)}>
                                {icon} <span>{cell}</span>
                              </div>
                            </div>
                          ) : (
                            <div className={cn("flex items-center justify-center gap-0.5 font-medium whitespace-nowrap", cellTextColor)}>
                              {icon} <span>{cell}</span>
                            </div>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          
          {<PremiumChart symbol={symbol} currentPremium={indexData.etf?.premium} />}

          <div className="mt-8 text-center text-[10px] sm:text-[11px] font-medium text-[#94a3b8] leading-relaxed px-4">
            股市有风险，投资需谨慎 | 内容仅供学习交流，不构成投资建议<br/>
            数据来源: 公开市场数据 
          </div>
        </div>
      </div>
    );
  };

  if (loading || !marketData) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center text-white">
        <div className="flex flex-col items-center gap-4">
          <div className="w-8 h-8 border-[3px] border-white/20 border-t-white rounded-full animate-spin"></div>
          <p className="text-[#86868b] text-[13px] font-medium tracking-wider uppercase">Loading...</p>
        </div>
      </div>
    );
  }

  if (selectedView === 'profile') return renderProfile();
  
  const activeFund = fundsConfig.find(f => f.id === selectedView);
  if (activeFund) {
    const displayName = activeFund.name && activeFund.name !== '新资金' 
      ? activeFund.name 
      : (marketData.data[activeFund.symbol]?.etf?.name || activeFund.symbol || '未命名基金');
    return renderThermometer(displayName, marketData.data[activeFund.symbol], activeFund.matrix || 'NDX', activeFund.symbol);
  }

  return renderDashboard();
}

const IndexCard: React.FC<{ title: string, ticker: string, matrix?: 'NDX'|'SPX', data: MarketData | null, vix: number | undefined, globalPe?: {NDX: number, SPX: number}, onClick: () => void }> = ({ title, ticker, matrix, data, vix, globalPe, onClick }) => {
  if (!data) {
    return (
      <div className="bg-gradient-to-b from-[#241818] to-[#1c1111] rounded-[24px] p-5 text-left border border-white/5 opacity-50 flex items-center justify-center min-h-[160px]">
        <span className="text-[#86868b] text-[13px] font-medium tracking-wide uppercase">Offline / Error</span>
      </div>
    );
  }
  
  const pe = (matrix && globalPe) ? globalPe[matrix] : data.pe;
  const isPositive = data.change >= 0;
  
  let recommendation = '-';
  if (vix != null && matrix) {
      if (matrix === 'NDX') {
          recommendation = ndxMatrixData[getQqqRowIndex(pe)]?.cells[getQqqColIndex(vix)] || '-';
      } else if (matrix === 'SPX') {
          recommendation = spxMatrixData[getSpyRowIndex(pe)]?.cells[getSpyColIndex(vix)] || '-';
      }
  }

  let recColor = "text-[#34c759]";
  
  if (recommendation === '暂停') {
      recColor = "text-[#ff3b30]";
  } else if (recommendation === '观望') {
      recColor = "text-[#86868b]";
  } else if (recommendation === '顶格') {
      recColor = "text-[#bf5af2]";
  } else if (recommendation.includes('倍')) {
      recColor = "text-[#32ade6]";
  } else if (recommendation === '-') {
      recColor = "text-[#86868b]";
  }

  return (
    <button 
      onClick={onClick}
      className={cn(
        "bg-gradient-to-b from-[#2b2020] to-[#1d1414] rounded-[24px] px-3 py-4 text-center transition-all duration-300 flex flex-col border border-white/5",
        "hover:scale-[1.02] active:scale-[0.98] cursor-pointer"
      )}
    >
      <div className="w-full text-left mb-3 px-1">
        <div className="flex items-center gap-1.5 break-words">
           <h3 className="text-[16px] font-bold text-white tracking-tight leading-tight">{title}</h3>
        </div>
        <div className="text-[10px] font-medium text-[#86868b] tracking-wider mt-0.5">
          {format(new Date(), 'MM-dd HH:mm')}
        </div>
      </div>
      
      <div className="flex flex-col items-center justify-center mb-5 mt-1">
        <div className="text-[11px] font-medium text-[#86868b] mb-1">今日</div>
        <div className={cn(
          "text-[34px] sm:text-[38px] font-black tracking-tighter leading-none font-sans",
          isPositive ? "text-[#ff453a]" : "text-[#32d74b]"
        )}>
          {isPositive ? '+' : ''}{data.change.toFixed(2)}%
        </div>
      </div>
      
      <div className="mt-auto w-full bg-[#150d0d] rounded-[16px] p-2 border border-white/5 flex flex-col items-center justify-center gap-0.5">
        <div className="text-[10px] text-[#86868b] font-medium flex items-center justify-center gap-1">
           {matrix ? (
             <>
               PE: {pe?.toFixed(1)}{' '}
               <span className="opacity-40 scale-y-125">|</span>{' '}
               <span className={cn("opacity-80", data.etf?.premium && data.etf.premium > 3 ? "text-[#ff3b30] font-bold" : "")}>
                {data.etf?.premium != null ? `溢价: ${data.etf.premium > 0 ? '+' : ''}${data.etf.premium.toFixed(2)}%` : `历史: ${getPePercentile(matrix, pe)}%`}
               </span>
             </>
           ) : (
             <span className={cn("opacity-80", data.etf?.premium && data.etf.premium > 3 ? "text-[#ff3b30] font-bold" : "")}>
               {data.etf?.premium != null ? `溢价: ${data.etf.premium > 0 ? '+' : ''}${data.etf.premium.toFixed(2)}%` : '均价: 暂无'}
             </span>
           )}
        </div>
        <div className={cn("text-[14px] font-bold tracking-wide mt-1", recColor)}>
          {recommendation !== '-' ? recommendation : (isPositive ? '持仓观察' : '正常定投')}
        </div>
      </div>
    </button>
  );
}
