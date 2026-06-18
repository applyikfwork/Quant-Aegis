import { useState, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import TradingChart, { OHLCCandle } from "@/components/TradingChart";
import {
  Search, Star, RefreshCw, Wifi, WifiOff, ChevronDown,
  ArrowUpRight, ArrowDownRight, Maximize2, DollarSign,
  GitBranch, Activity, BarChart2, Flame, Layers, ScanLine, Brain
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────
interface Ticker { symbol:string; price:number; change24h:number; high24h:number; low24h:number; volume24h:number; prevClose:number; bid:number; ask:number; }
interface OBEntry { price:number; qty:number; total:number; }
interface OrderBook { bids:OBEntry[]; asks:OBEntry[]; spread:number|null; bidAskRatio:number; updatedAt:string; }
interface RecentTrade { time:string; price:number; qty:number; value:number; side:string; }
interface FundingData { fundingRate:number|null; openInterest:number; openInterestChange:number; fundingTime:string|null; }
interface ScanResult { symbol:string; signal:string; confidence:number; price:number; change:number; volume:number; reason:string; entry:number; sl:number; tp:number; rr:string; }

// ─── Constants ────────────────────────────────────────────────────────────────
const SYMBOLS = [
  { symbol:"BTCUSDT",  base:"BTC",  name:"Bitcoin" },
  { symbol:"ETHUSDT",  base:"ETH",  name:"Ethereum" },
  { symbol:"SOLUSDT",  base:"SOL",  name:"Solana" },
  { symbol:"BNBUSDT",  base:"BNB",  name:"BNB" },
  { symbol:"XRPUSDT",  base:"XRP",  name:"XRP" },
  { symbol:"ADAUSDT",  base:"ADA",  name:"Cardano" },
  { symbol:"AVAXUSDT", base:"AVAX", name:"Avalanche" },
  { symbol:"DOGEUSDT", base:"DOGE", name:"Dogecoin" },
];
const TIMEFRAMES = ["1m","3m","5m","15m","30m","1h","2h","4h","6h","12h","1d","1w"];
const TF_LABEL: Record<string,string> = { "1m":"1m","3m":"3m","5m":"5m","15m":"15m","30m":"30m","1h":"1H","2h":"2H","4h":"4H","6h":"6H","12h":"12H","1d":"1D","1w":"1W" };

// ─── Utils ────────────────────────────────────────────────────────────────────
const fmt = (n:number|undefined|null, d=2) => (n??0).toLocaleString("en-US",{minimumFractionDigits:d,maximumFractionDigits:d});
const fmtP = (n:number|undefined|null) => { const v=n??0; return v>=1000 ? fmt(v,2) : v>=1 ? fmt(v,4) : fmt(v,6); };
const fmtV = (n:number|undefined|null) => { const v=n??0; return v>=1e9 ? `$${(v/1e9).toFixed(2)}B` : v>=1e6 ? `$${(v/1e6).toFixed(1)}M` : v>=1e3 ? `$${(v/1e3).toFixed(1)}K` : `$${v.toFixed(2)}`; };
const fmtQ = (n:number|undefined|null) => { const v=n??0; return v>=1e6 ? `${(v/1e6).toFixed(2)}M` : v>=1e3 ? `${(v/1e3).toFixed(2)}K` : v.toFixed(4); };
const clx = (...a:(string|false|null|undefined)[]) => a.filter(Boolean).join(" ");
const apiFetch = <T,>(path:string) => ():Promise<T> => fetch(path).then(r=>{ if(!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); });

// ─── Indicator math ───────────────────────────────────────────────────────────
function ema(closes:number[], period:number):number[] {
  const k=2/(period+1), out:number[]=[];
  closes.forEach((c,i)=>{ if(i<period-1) out.push(NaN); else if(i===period-1) out.push(closes.slice(0,period).reduce((a,b)=>a+b)/period); else out.push(c*k+out[i-1]*(1-k)); });
  return out;
}
function rsi(closes:number[], p=14):number {
  if(closes.length<p+1) return 50;
  const ch=closes.slice(1).map((c,i)=>c-closes[i]), rec=ch.slice(-p);
  const g=rec.filter(c=>c>0).reduce((a,b)=>a+b,0)/p, l=Math.abs(rec.filter(c=>c<0).reduce((a,b)=>a+b,0))/p;
  return l===0?100:100-(100/(1+g/l));
}
function atr(candles:OHLCCandle[], p=14):number {
  if(candles.length<2) return 0;
  const trs=candles.slice(1).map((c,i)=>Math.max(c.high-c.low,Math.abs(c.high-candles[i].close),Math.abs(c.low-candles[i].close)));
  return trs.slice(-p).reduce((a,b)=>a+b,0)/Math.min(p,trs.length);
}
function macd(closes:number[]) {
  const e12=ema(closes,12),e26=ema(closes,26);
  const ml=closes.map((_,i)=>isNaN(e12[i])||isNaN(e26[i])?NaN:e12[i]-e26[i]);
  const valid=ml.filter(v=>!isNaN(v)), sig=ema(valid,9);
  const m=valid[valid.length-1]??0, s=sig[sig.length-1]??0;
  return { macd:m, signal:s, histogram:m-s };
}
function bollinger(closes:number[], p=20) {
  if(closes.length<p) return { upper:0, mid:0, lower:0 };
  const sl=closes.slice(-p), mid=sl.reduce((a,b)=>a+b)/p;
  const std=Math.sqrt(sl.reduce((a,b)=>a+(b-mid)**2,0)/p);
  return { upper:mid+2*std, mid, lower:mid-2*std };
}
function mtfSignal(candles:OHLCCandle[]) {
  if(candles.length<30) return { trend:"Neutral",momentum:"Neutral",strength:50,confidence:50,support:0,resistance:0 };
  const cl=candles.map(c=>c.close), price=cl[cl.length-1];
  const r=rsi(cl), m=macd(cl), e20=ema(cl,20), e50=ema(cl,50);
  const l20=e20[e20.length-1], l50=e50[e50.length-1];
  const high=Math.max(...candles.slice(-20).map(c=>c.high)), low=Math.min(...candles.slice(-20).map(c=>c.low));
  const bulls=[price>l20,price>l50,l20>l50,m.macd>m.signal,r>50,r<70].filter(Boolean).length;
  const strength=Math.round(bulls/6*100);
  const trend=strength>=70?"Strong Bullish":strength>=55?"Bullish":strength<=30?"Strong Bearish":strength<=45?"Bearish":"Neutral";
  const momentum=m.macd>m.signal&&r>50?"Bullish":m.macd<m.signal&&r<50?"Bearish":"Neutral";
  return { trend, momentum, strength, confidence:Math.round(50+Math.abs(strength-50)*0.8), support:low, resistance:high };
}

// ─── Data hooks ───────────────────────────────────────────────────────────────
const useTicker = (sym:string) => useQuery<Ticker>({ queryKey:["ticker",sym], queryFn:apiFetch(`/api/market/ticker/${sym}`), refetchInterval:3000, staleTime:1000 });
const useKlines = (sym:string, tf:string, limit=300) => useQuery<OHLCCandle[]>({ queryKey:["klines",sym,tf,limit], queryFn:apiFetch(`/api/market/klines/${sym}/${tf}?limit=${limit}`), refetchInterval:30000, staleTime:15000 });
const useOrderBook = (sym:string) => useQuery<OrderBook>({ queryKey:["ob",sym], queryFn:apiFetch(`/api/market/orderbook/${sym}?limit=20`), refetchInterval:1500, staleTime:500 });
const useTrades = (sym:string) => useQuery<RecentTrade[]>({ queryKey:["rt",sym], queryFn:apiFetch(`/api/market/trades/${sym}?limit=40`), refetchInterval:2000, staleTime:1000 });
const useFunding = (sym:string) => useQuery<FundingData>({ queryKey:["fund",sym], queryFn:apiFetch(`/api/market/funding/${sym}`), refetchInterval:60000, staleTime:30000 });
const useScanner = () => useQuery<ScanResult[]>({ queryKey:["scanner"], queryFn:apiFetch("/api/market/scanner"), refetchInterval:60000, staleTime:30000 });

// ─── Price Bar ────────────────────────────────────────────────────────────────
function PriceBar({ ticker, symbol }:{ ticker?:Ticker; symbol:string }) {
  if (!ticker) return <div className="h-16 bg-[#0d1117] border-b border-[#1f2937] animate-pulse"/>;
  const up=ticker.change24h>=0;
  const spread=ticker.ask&&ticker.bid?((ticker.ask-ticker.bid)/ticker.bid*100):null;
  return (
    <div className="flex flex-wrap items-center gap-x-6 gap-y-1 px-4 py-2.5 bg-[#0d1117] border-b border-[#1f2937]">
      <div>
        <div className="text-2xl font-bold text-white font-mono">${fmtP(ticker.price)}</div>
        <div className={clx("text-xs font-medium flex items-center gap-0.5 mt-0.5", up?"text-green-400":"text-red-400")}>
          {up?<ArrowUpRight size={12}/>:<ArrowDownRight size={12}/>}
          {up?"+":""}{ticker.change24h.toFixed(2)}% &nbsp;24h
        </div>
      </div>
      {[
        { l:"24h High", v:`$${fmtP(ticker.high24h)}`,  c:"text-green-400" },
        { l:"24h Low",  v:`$${fmtP(ticker.low24h)}`,   c:"text-red-400" },
        { l:"Volume",   v:fmtV(ticker.volume24h),        c:"text-blue-400" },
        { l:"Bid",      v:`$${fmtP(ticker.bid)}`,        c:"text-green-300" },
        { l:"Ask",      v:`$${fmtP(ticker.ask)}`,        c:"text-red-300" },
        ...(spread!=null?[{ l:"Spread", v:`${spread.toFixed(3)}%`, c:"text-yellow-400" }]:[]),
      ].map(s=>(
        <div key={s.l} className="text-center hidden sm:block">
          <div className="text-xs text-gray-500">{s.l}</div>
          <div className={clx("text-xs font-mono font-semibold", s.c)}>{s.v}</div>
        </div>
      ))}
    </div>
  );
}

// ─── Order Book ───────────────────────────────────────────────────────────────
function OrderBookPanel({ symbol }:{ symbol:string }) {
  const { data:ob } = useOrderBook(symbol);
  if (!ob) return <div className="flex-1 animate-pulse bg-[#0a0c10]"/>;
  const mxB=Math.max(...ob.bids.map(b=>b.total),1), mxA=Math.max(...ob.asks.map(a=>a.total),1);
  return (
    <div className="flex flex-col h-full text-xs">
      <div className="flex items-center justify-between px-3 py-1.5 bg-[#0d1117] border-b border-[#1f2937]">
        <span className="text-xs font-semibold text-gray-300">Order Book</span>
        <span className="text-xs"><span className="text-green-400">{ob.bidAskRatio.toFixed(1)}%</span><span className="text-gray-600 mx-1">|</span><span className="text-red-400">{(100-ob.bidAskRatio).toFixed(1)}%</span></span>
      </div>
      <div className="grid grid-cols-3 px-3 py-1 text-gray-600">
        <span>Price</span><span className="text-center">Qty</span><span className="text-right">Total</span>
      </div>
      {/* Asks reversed so lowest ask is nearest spread */}
      <div className="flex flex-col-reverse overflow-y-auto" style={{maxHeight:"40%"}}>
        {ob.asks.slice(0,15).map((a,i)=>(
          <div key={i} className="relative grid grid-cols-3 px-3 py-0.5 hover:bg-red-900/10 cursor-default">
            <div className="absolute inset-0 bg-red-900/15" style={{width:`${(a.total/mxA)*100}%`}}/>
            <span className="relative text-red-400 font-mono">{fmtP(a.price)}</span>
            <span className="relative text-center text-gray-300">{a.qty.toFixed(4)}</span>
            <span className="relative text-right text-gray-400">{fmtV(a.total)}</span>
          </div>
        ))}
      </div>
      <div className="flex items-center justify-center gap-2 px-3 py-1 bg-[#111827] border-y border-[#1f2937]">
        <span className="text-yellow-400 font-mono font-bold text-xs">
          {ob.spread ? `$${ob.spread<1 ? ob.spread.toFixed(6) : ob.spread.toFixed(2)}` : "—"}
        </span>
        <span className="text-gray-600 text-xs">spread</span>
      </div>
      <div className="overflow-y-auto flex-1">
        {ob.bids.slice(0,15).map((b,i)=>(
          <div key={i} className="relative grid grid-cols-3 px-3 py-0.5 hover:bg-green-900/10 cursor-default">
            <div className="absolute inset-0 bg-green-900/15" style={{width:`${(b.total/mxB)*100}%`}}/>
            <span className="relative text-green-400 font-mono">{fmtP(b.price)}</span>
            <span className="relative text-center text-gray-300">{b.qty.toFixed(4)}</span>
            <span className="relative text-right text-gray-400">{fmtV(b.total)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Recent Trades ────────────────────────────────────────────────────────────
function TradesPanel({ symbol }:{ symbol:string }) {
  const { data:trades } = useTrades(symbol);
  if (!trades) return <div className="flex-1 animate-pulse bg-[#0a0c10]"/>;
  return (
    <div className="flex flex-col h-full text-xs">
      <div className="px-3 py-1.5 bg-[#0d1117] border-b border-[#1f2937]">
        <span className="text-xs font-semibold text-gray-300">Recent Trades</span>
      </div>
      <div className="grid grid-cols-3 px-3 py-1 text-gray-600">
        <span>Price</span><span className="text-center">Qty</span><span className="text-right">Time</span>
      </div>
      <div className="overflow-y-auto flex-1">
        {trades.map((t,i)=>(
          <div key={i} className="grid grid-cols-3 px-3 py-0.5 hover:bg-white/5">
            <span className={clx("font-mono",t.side==="Buy"?"text-green-400":"text-red-400")}>{fmtP(t.price)}</span>
            <span className="text-center text-gray-300">{t.qty.toFixed(4)}</span>
            <span className="text-right text-gray-500">{new Date(t.time).toLocaleTimeString([],{hour:"2-digit",minute:"2-digit",second:"2-digit"})}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Stats Panel ──────────────────────────────────────────────────────────────
function StatsPanel({ ticker, candles }:{ ticker?:Ticker; candles?:OHLCCandle[] }) {
  if (!ticker) return <div className="p-4 text-gray-500 text-sm">Loading…</div>;
  const a=candles?atr(candles):0, vol=(a/ticker.price*100);
  const avg=candles?.length?candles.slice(-24).reduce((s,c)=>s+c.close,0)/Math.min(candles.length,24):ticker.price;
  const range=ticker.high24h>0?((ticker.high24h-ticker.low24h)/ticker.low24h*100):0;
  const spread=ticker.ask&&ticker.bid?((ticker.ask-ticker.bid)/ticker.bid*100):null;
  return (
    <div className="p-3 grid grid-cols-2 gap-2">
      {[
        { l:"24h High",    v:`$${fmtP(ticker.high24h)}`,    c:"text-green-400" },
        { l:"24h Low",     v:`$${fmtP(ticker.low24h)}`,     c:"text-red-400" },
        { l:"Avg Price",   v:`$${fmtP(avg)}`,                c:"text-gray-300" },
        { l:"24h Range",   v:`${range.toFixed(2)}%`,         c:"text-yellow-400" },
        { l:"ATR (14)",    v:`$${fmtP(a)}`,                  c:"text-purple-400" },
        { l:"Volatility",  v:`${vol.toFixed(3)}%`,           c:"text-orange-400" },
        ...(spread!=null?[{ l:"Spread", v:`${spread.toFixed(4)}%`, c:"text-blue-400" }]:[]),
        { l:"Volume USD",  v:fmtV(ticker.volume24h),          c:"text-blue-300" },
      ].map(s=>(
        <div key={s.l} className="bg-[#111827] rounded p-2">
          <div className="text-xs text-gray-500">{s.l}</div>
          <div className={clx("text-xs font-mono font-semibold mt-0.5",s.c)}>{s.v}</div>
        </div>
      ))}
    </div>
  );
}

// ─── MTF Analysis ─────────────────────────────────────────────────────────────
function MTFPanel({ symbol }:{ symbol:string }) {
  const tfs = ["1m","5m","15m","1h","4h","1d"] as const;
  // We must call hooks at the top level — map inside would violate rules of hooks
  const r1m  = useKlines(symbol,"1m",100);
  const r5m  = useKlines(symbol,"5m",100);
  const r15m = useKlines(symbol,"15m",100);
  const r1h  = useKlines(symbol,"1h",100);
  const r4h  = useKlines(symbol,"4h",100);
  const r1d  = useKlines(symbol,"1d",100);
  const results = [
    { tf:"1m",  data:r1m.data  },
    { tf:"5m",  data:r5m.data  },
    { tf:"15m", data:r15m.data },
    { tf:"1h",  data:r1h.data  },
    { tf:"4h",  data:r4h.data  },
    { tf:"1d",  data:r1d.data  },
  ].map(r=>({ tf:r.tf, ...(r.data ? mtfSignal(r.data) : { trend:"Loading…",momentum:"—",strength:50,confidence:50,support:0,resistance:0 }) }));
  const done=results.filter(r=>r.trend!=="Loading…");
  const bull=done.filter(r=>r.trend.includes("Bullish")).length;
  const bear=done.filter(r=>r.trend.includes("Bearish")).length;
  const overall=bull>bear?(bull>=4?"Strong Bullish":"Bullish"):bear>bull?(bear>=4?"Strong Bearish":"Bearish"):"Neutral";
  const conf=done.length?Math.round(done.reduce((a,r)=>a+r.confidence,0)/done.length):50;
  return (
    <div className="p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-gray-200">Multi-Timeframe Confluence</h3>
        <span className={clx("px-3 py-1 rounded-full text-xs font-bold",
          overall.includes("Bullish")?"bg-green-900/40 text-green-400":
          overall.includes("Bearish")?"bg-red-900/40 text-red-400":"bg-gray-800 text-gray-400"
        )}>{overall} · {conf}% conf</span>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
        {results.map(r=>{
          const bull=r.trend.includes("Bullish"),bear=r.trend.includes("Bearish");
          return (
            <div key={r.tf} className="bg-[#111827] rounded-lg p-3">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs font-bold text-blue-400">{TF_LABEL[r.tf]}</span>
                <span className={clx("text-xs font-semibold",bull?"text-green-400":bear?"text-red-400":"text-yellow-400")}>{r.trend}</span>
              </div>
              <div className="flex items-center gap-2 mb-1">
                <div className="flex-1 bg-gray-800 rounded-full h-1.5">
                  <div className={clx("h-1.5 rounded-full",bull?"bg-green-500":bear?"bg-red-500":"bg-yellow-500")} style={{width:`${r.strength}%`}}/>
                </div>
                <span className="text-xs text-gray-500">{r.confidence}%</span>
              </div>
              <div className="flex justify-between text-xs text-gray-600">
                <span>S ${fmtP(r.support)}</span>
                <span>R ${fmtP(r.resistance)}</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Indicators Panel ─────────────────────────────────────────────────────────
function IndicatorsPanel({ candles, ticker }:{ candles?:OHLCCandle[]; ticker?:Ticker }) {
  if (!candles||candles.length<30) return <div className="p-6 text-center text-gray-500 text-sm">Loading indicators…</div>;
  const cl=candles.map(c=>c.close), price=ticker?.price??cl[cl.length-1];
  const r=rsi(cl), m=macd(cl), at=atr(candles), bb=bollinger(cl);
  const e20=ema(cl,20), e50=ema(cl,50), e200=ema(cl,200);
  const l20=e20[e20.length-1], l50=e50[e50.length-1], l200=e200[e200.length-1];
  const vwapNum=candles.slice(-24).reduce((a,c)=>a+((c.high+c.low+c.close)/3)*c.volume,0);
  const vwapDen=candles.slice(-24).reduce((a,c)=>a+c.volume,0);
  const vwap=vwapDen>0?vwapNum/vwapDen:price;
  const groups=[
    { label:"Trend", items:[
      { n:"EMA 20",   v:`$${fmtP(l20)}`,     s:price>l20?"Bullish":"Bearish",         bull:price>l20 },
      { n:"EMA 50",   v:`$${fmtP(l50)}`,     s:price>l50?"Bullish":"Bearish",         bull:price>l50 },
      { n:"EMA 200",  v:`$${fmtP(l200)}`,    s:price>l200?"Bullish":"Bearish",        bull:price>l200 },
      { n:"VWAP",     v:`$${fmtP(vwap)}`,    s:price>vwap?"Above VWAP":"Below VWAP", bull:price>vwap },
    ]},
    { label:"Momentum", items:[
      { n:"RSI (14)", v:fmt(r,1),             s:r>70?"Overbought":r<30?"Oversold":r>50?"Bullish":"Bearish", bull:r>50&&r<70 },
      { n:"MACD",     v:fmt(m.macd,4),        s:m.macd>m.signal?"Bull Cross":"Bear Cross", bull:m.macd>m.signal },
      { n:"Signal",   v:fmt(m.signal,4),      s:m.histogram>0?"Positive":"Negative",   bull:m.histogram>0 },
      { n:"Histogram",v:fmt(m.histogram,4),   s:m.histogram>0?"Bullish":"Bearish",     bull:m.histogram>0 },
    ]},
    { label:"Volatility", items:[
      { n:"ATR (14)", v:`$${fmtP(at)}`,       s:`${(at/price*100).toFixed(2)}% range`, bull:true },
      { n:"BB Upper", v:`$${fmtP(bb.upper)}`, s:price<bb.upper?"Inside":"Above",       bull:price<bb.upper },
      { n:"BB Mid",   v:`$${fmtP(bb.mid)}`,   s:price>bb.mid?"Above":"Below",          bull:price>bb.mid },
      { n:"BB Lower", v:`$${fmtP(bb.lower)}`, s:price>bb.lower?"Above":"Below band",   bull:price>bb.lower },
    ]},
  ];
  const allItems=groups.flatMap(g=>g.items);
  const bullCount=allItems.filter(i=>i.bull).length, total=allItems.length;
  const signal=bullCount/total>0.65?"Buy":bullCount/total<0.35?"Sell":"Neutral";
  return (
    <div className="p-4 space-y-3">
      <div className="flex items-center justify-between bg-[#111827] rounded-lg p-3">
        <span className="text-sm font-semibold text-gray-200">Technical Signal</span>
        <span className={clx("px-3 py-1 rounded-full text-xs font-bold",
          signal==="Buy"?"bg-green-900/40 text-green-400":
          signal==="Sell"?"bg-red-900/40 text-red-400":"bg-yellow-900/40 text-yellow-400"
        )}>{signal} · {bullCount}/{total} bullish</span>
      </div>
      {groups.map(g=>(
        <div key={g.label}>
          <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">{g.label}</h4>
          <div className="space-y-1">
            {g.items.map(item=>(
              <div key={item.n} className="flex items-center justify-between bg-[#111827] rounded px-3 py-2">
                <span className="text-xs text-gray-400 w-24">{item.n}</span>
                <span className="text-xs font-mono text-gray-200 flex-1 text-center">{item.v}</span>
                <span className={clx("text-xs font-medium w-28 text-right",item.bull?"text-green-400":"text-red-400")}>{item.s}</span>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Volume Panel ─────────────────────────────────────────────────────────────
function VolumePanel({ candles }:{ candles?:OHLCCandle[] }) {
  if (!candles||candles.length<10) return <div className="p-6 text-center text-gray-500 text-sm">Loading…</div>;
  const recent=candles.slice(-30), last=candles[candles.length-1];
  const avgVol=recent.reduce((a,c)=>a+c.volume,0)/recent.length;
  const relVol=last.volume/avgVol;
  const buyVol=recent.filter(c=>c.close>=c.open).reduce((a,c)=>a+c.volume,0);
  const sellVol=recent.filter(c=>c.close<c.open).reduce((a,c)=>a+c.volume,0);
  const total=buyVol+sellVol, maxVol=Math.max(...recent.map(c=>c.volume));
  return (
    <div className="p-4 space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { l:"Current Vol",  v:fmtQ(last.volume),   c:"text-blue-400" },
          { l:"Avg Vol (30)", v:fmtQ(avgVol),          c:"text-gray-300" },
          { l:"Relative Vol", v:`${relVol.toFixed(2)}x`, c:relVol>1.5?"text-orange-400":"text-gray-400" },
          { l:"Buy/Sell",     v:`${(buyVol/total*100).toFixed(0)}% / ${(sellVol/total*100).toFixed(0)}%`, c:"text-yellow-400" },
        ].map(s=>(
          <div key={s.l} className="bg-[#111827] rounded-lg p-3">
            <div className="text-xs text-gray-500">{s.l}</div>
            <div className={clx("text-sm font-mono font-bold mt-1",s.c)}>{s.v}</div>
          </div>
        ))}
      </div>
      <div>
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-semibold text-gray-400">Volume Bars (Last 30 Candles)</span>
          {relVol>2&&<span className="text-xs text-orange-400 font-bold animate-pulse">⚡ Volume Spike</span>}
        </div>
        <div className="bg-[#111827] rounded-lg p-3 flex items-end gap-0.5 h-28">
          {recent.map((c,i)=>{
            const bull=c.close>=c.open, h=Math.max(4, Math.round((c.volume/maxVol)*100));
            return <div key={i} title={`${fmtQ(c.volume)} · ${bull?"Buy":"Sell"}`}
              className={clx("flex-1 rounded-sm hover:opacity-80",bull?"bg-green-500/60":"bg-red-500/60")} style={{height:`${h}%`}}/>;
          })}
        </div>
      </div>
      <div className="space-y-2">
        {[
          { l:"Buying Volume",  v:fmtQ(buyVol),  p:buyVol/total*100,  c:"bg-green-500" },
          { l:"Selling Volume", v:fmtQ(sellVol), p:sellVol/total*100, c:"bg-red-500" },
        ].map(s=>(
          <div key={s.l} className="flex items-center gap-3">
            <span className="text-xs text-gray-400 w-28">{s.l}</span>
            <div className="flex-1 bg-gray-800 rounded-full h-2"><div className={clx("h-2 rounded-full",s.c)} style={{width:`${s.p}%`}}/></div>
            <span className="text-xs font-mono text-gray-300 w-20 text-right">{s.v}</span>
          </div>
        ))}
      </div>
      <div className="bg-[#111827] rounded-lg p-3 text-xs text-gray-400 leading-relaxed">
        {relVol>2.5
          ? `⚡ Extreme volume spike (${relVol.toFixed(1)}x avg). Significant institutional activity likely. High probability of continued directional momentum.`
          : relVol>1.5
          ? `📈 Above-average volume (${relVol.toFixed(1)}x). Move is backed by real participation. ${buyVol>sellVol?"Buyers dominate — accumulation signal.":"Sellers dominate — distribution pressure."}`
          : `📊 Volume is ${relVol.toFixed(1)}x average — within normal range. No major institutional activity. Current price action may lack follow-through without volume confirmation.`
        }
      </div>
    </div>
  );
}

// ─── Whale Activity ───────────────────────────────────────────────────────────
function WhalePanel({ symbol }:{ symbol:string }) {
  const { data:ob } = useOrderBook(symbol);
  if (!ob) return <div className="p-6 text-center text-gray-500 text-sm">Loading whale data…</div>;
  const THRESHOLD=50000;
  const bigBids=ob.bids.filter(b=>b.total>THRESHOLD).sort((a,b)=>b.total-a.total).slice(0,6);
  const bigAsks=ob.asks.filter(a=>a.total>THRESHOLD).sort((a,b)=>b.total-a.total).slice(0,6);
  const totB=bigBids.reduce((a,b)=>a+b.total,0), totA=bigAsks.reduce((a,b)=>a+b.total,0);
  const bias=totB>totA?"Bullish":totA>totB?"Bearish":"Neutral";
  return (
    <div className="p-4 space-y-4">
      <div className="grid grid-cols-3 gap-3">
        {[
          { l:"Large Buy Walls",  v:`${bigBids.length} orders`, c:"text-green-400" },
          { l:"Large Sell Walls", v:`${bigAsks.length} orders`, c:"text-red-400" },
          { l:"Whale Bias",       v:bias, c:bias==="Bullish"?"text-green-400":bias==="Bearish"?"text-red-400":"text-yellow-400" },
        ].map(s=>(
          <div key={s.l} className="bg-[#111827] rounded-lg p-3 text-center">
            <div className="text-xs text-gray-500">{s.l}</div>
            <div className={clx("text-sm font-bold mt-1",s.c)}>{s.v}</div>
          </div>
        ))}
      </div>
      <div className="grid grid-cols-2 gap-4">
        {(["bids","asks"] as const).map(side=>(
          <div key={side}>
            <h4 className={clx("text-xs font-semibold uppercase tracking-wider mb-2",side==="bids"?"text-green-400":"text-red-400")}>
              🐋 {side==="bids"?"Large Buy Orders":"Large Sell Orders"}
            </h4>
            <div className="space-y-1">
              {(side==="bids"?bigBids:bigAsks).length===0
                ? <div className="text-xs text-gray-600 italic">No large orders detected</div>
                : (side==="bids"?bigBids:bigAsks).map((o,i)=>(
                  <div key={i} className="flex items-center justify-between bg-[#111827] rounded px-3 py-1.5">
                    <span className={clx("text-xs font-mono",side==="bids"?"text-green-400":"text-red-400")}>${fmtP(o.price)}</span>
                    <span className="text-xs text-gray-400">{fmtV(o.total)}</span>
                  </div>
                ))
              }
            </div>
          </div>
        ))}
      </div>
      <div className="bg-[#111827] rounded-lg p-3">
        <div className="text-xs font-semibold text-blue-400 mb-1 flex items-center gap-1"><Brain size={12}/>AI Whale Analysis</div>
        <p className="text-xs text-gray-400 leading-relaxed">
          {bigBids.length===0&&bigAsks.length===0
            ? "No significant large orders in current order book. Market in a low-participation phase."
            : totB>totA*1.5
            ? `Strong institutional buying ($${fmtV(totB)}). Large buy walls suggest whales are defending support levels. Potential for upward movement.`
            : totA>totB*1.5
            ? `Significant sell pressure ($${fmtV(totA)} in large asks). Possible distribution phase. Caution advised for long positions.`
            : `Balanced whale activity. Bids (${fmtV(totB)}) vs asks (${fmtV(totA)}) suggest consolidation. Watch for breakout direction.`
          }
        </p>
      </div>
    </div>
  );
}

// ─── Funding & OI ────────────────────────────────────────────────────────────
function FundingPanel({ symbol }:{ symbol:string }) {
  const { data:f, isLoading } = useFunding(symbol);
  if (isLoading) return <div className="p-6 text-center text-gray-500 text-sm">Loading derivatives…</div>;
  if (!f) return <div className="p-6 text-center text-gray-500 text-sm">Data unavailable</div>;
  const pos=(f.fundingRate??0)>=0;
  const oiFmt=f.openInterest>1e9?`$${(f.openInterest/1e9).toFixed(2)}B`:`$${(f.openInterest/1e6).toFixed(0)}M`;
  return (
    <div className="p-4 space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { l:"Funding Rate (8h)", v:f.fundingRate!=null?`${pos?"+":""}${f.fundingRate.toFixed(4)}%`:"N/A", c:pos?"text-green-400":"text-red-400" },
          { l:"Annualized",        v:f.fundingRate!=null?`${(f.fundingRate*3*365).toFixed(1)}%`:"N/A", c:pos?"text-green-300":"text-red-300" },
          { l:"Open Interest",     v:oiFmt, c:"text-blue-400" },
          { l:"OI Change (1h)",    v:`${f.openInterestChange>0?"+":""}${f.openInterestChange.toFixed(2)}%`, c:f.openInterestChange>0?"text-green-400":"text-red-400" },
        ].map(s=>(
          <div key={s.l} className="bg-[#111827] rounded-lg p-3">
            <div className="text-xs text-gray-500">{s.l}</div>
            <div className={clx("text-base font-mono font-bold mt-1",s.c)}>{s.v}</div>
          </div>
        ))}
      </div>
      {f.fundingRate!=null&&(
        <div className="bg-[#111827] rounded-lg p-4">
          <div className="flex justify-between text-xs text-gray-500 mb-1"><span>Short bias (–0.1%)</span><span>Neutral</span><span>Long bias (+0.1%)</span></div>
          <div className="relative h-4 bg-gray-800 rounded-full overflow-hidden">
            <div className="absolute inset-y-0 left-1/2 w-0.5 bg-gray-600"/>
            <div className={clx("absolute top-0 h-full rounded-full",pos?"bg-green-500":"bg-red-500")}
              style={{ left:pos?"50%":`${Math.max(0,50+f.fundingRate!*500)}%`, width:`${Math.min(50,Math.abs(f.fundingRate!)*500)}%` }}/>
          </div>
          <div className="text-center text-xs text-gray-400 mt-2">
            {pos?"Longs paying shorts":"Shorts paying longs"} · {Math.abs(f.fundingRate!).toFixed(4)}% / 8h
          </div>
        </div>
      )}
      <div className="bg-[#111827] rounded-lg p-3">
        <div className="text-xs font-semibold text-blue-400 mb-1 flex items-center gap-1"><Brain size={12}/>AI Derivatives Analysis</div>
        <p className="text-xs text-gray-400 leading-relaxed">
          {(f.fundingRate??0)>0.05
            ? "Market is long-heavy. Longs paying shorts signals over-leveraged longs. A sudden drop could trigger a long squeeze cascade."
            : (f.fundingRate??0)<-0.05
            ? "Short-heavy positioning. Shorts paying longs — elevated short squeeze risk if price rallies."
            : "Funding near neutral. No major derivatives imbalance detected."
          }
          {f.openInterestChange!==0&&` Open interest ${f.openInterestChange>0?"rose":"fell"} ${Math.abs(f.openInterestChange).toFixed(2)}% — ${f.openInterestChange>0?"new money entering, trend continuation possible.":"positions closing, conviction weakening."}`}
        </p>
      </div>
    </div>
  );
}

// ─── Correlation ──────────────────────────────────────────────────────────────
function CorrelationPanel() {
  const { data:prices } = useQuery<any[]>({ queryKey:["mkt-prices"], queryFn:apiFetch("/api/market/prices"), refetchInterval:30000 });
  const pairs=[["BTC","ETH"],["BTC","SOL"],["BTC","BNB"],["BTC","XRP"],["BTC","ADA"],["BTC","AVAX"],["ETH","SOL"],["ETH","BNB"],["SOL","AVAX"]];
  const ch=(s:string)=>prices?.find((p:any)=>p.symbol===s+"USDT")?.changePercent24h??0;
  const corr=(a:string,b:string)=>{
    const ca=ch(a),cb=ch(b);
    if(!ca&&!cb) return 0.5;
    return Math.max(-1,Math.min(1,1-Math.abs(ca-cb)/(Math.abs(ca)+Math.abs(cb)+0.01)));
  };
  const cColor=(v:number)=>v>0.7?"text-green-400 bg-green-900/20":v>0.3?"text-green-300 bg-green-900/10":v>-0.3?"text-yellow-400 bg-yellow-900/20":v>-0.7?"text-orange-400 bg-orange-900/20":"text-red-400 bg-red-900/20";
  const cLabel=(v:number)=>v>0.7?"Strong +"  :v>0.3?"Positive":v>-0.3?"Neutral":v>-0.7?"Negative":"Strong −";
  return (
    <div className="p-4">
      <h3 className="text-sm font-semibold text-gray-200 mb-3">Correlation Matrix (24h Price Change)</h3>
      <div className="space-y-1.5">
        {pairs.map(([a,b])=>{
          const v=corr(a,b);
          return (
            <div key={`${a}-${b}`} className="flex items-center gap-3 bg-[#111827] rounded-lg px-3 py-2">
              <span className="text-xs font-bold text-blue-400 w-8">{a}</span>
              <span className="text-gray-600 text-xs">↔</span>
              <span className="text-xs font-bold text-purple-400 w-8">{b}</span>
              <div className="flex-1 bg-gray-800 rounded-full h-2">
                <div className="bg-blue-500 h-2 rounded-full" style={{width:`${(v+1)/2*100}%`}}/>
              </div>
              <span className={clx("text-xs px-2 py-0.5 rounded font-mono w-12 text-center",cColor(v))}>{v.toFixed(2)}</span>
              <span className="text-xs text-gray-500 w-20">{cLabel(v)}</span>
            </div>
          );
        })}
      </div>
      <div className="mt-3 bg-[#111827] rounded-lg p-3 text-xs text-gray-400">
        <span className="text-blue-400 font-semibold">Note: </span>Correlations derived from 24h price changes. High correlation (&gt;0.7) means assets move together — reduces diversification benefit.
      </div>
    </div>
  );
}

// ─── AI Scanner ───────────────────────────────────────────────────────────────
function ScannerPanel() {
  const { data:results, isLoading } = useScanner();
  const [filter, setFilter] = useState("all");
  const FILTERS=["all","Breakout","Breakdown","Bullish Momentum","High Volatility"];
  const filtered=filter==="all"?(results??[]):(results??[]).filter(r=>r.signal===filter);
  const SC:Record<string,string>={ "Breakout":"text-green-400 bg-green-900/30","Breakdown":"text-red-400 bg-red-900/30","Bullish Momentum":"text-blue-400 bg-blue-900/30","High Volatility":"text-yellow-400 bg-yellow-900/30" };
  if (isLoading) return <div className="p-8 text-center text-gray-500 text-sm">Scanning {FILTERS.length} markets…</div>;
  return (
    <div className="p-4">
      <div className="flex items-center gap-2 mb-3 flex-wrap">
        {FILTERS.map(f=>(
          <button key={f} onClick={()=>setFilter(f)} className={clx("text-xs px-3 py-1 rounded-full transition-colors",
            filter===f?"bg-blue-600 text-white":"bg-[#1f2937] text-gray-400 hover:text-white"
          )}>{f==="all"?"All":f}</button>
        ))}
        <span className="ml-auto text-xs text-gray-500">{filtered.length} signals</span>
      </div>
      <div className="space-y-2">
        {filtered.slice(0,20).map((r,i)=>(
          <div key={i} className="bg-[#111827] rounded-lg p-3 hover:bg-[#1a2133] transition-colors">
            <div className="flex items-center justify-between mb-1.5">
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold text-white">{r.symbol.replace("USDT","")}</span>
                <span className={clx("text-xs px-2 py-0.5 rounded-full font-medium",SC[r.signal]??"text-gray-400 bg-gray-800")}>{r.signal}</span>
              </div>
              <div className="flex items-center gap-3">
                <span className={clx("text-xs",r.change>=0?"text-green-400":"text-red-400")}>{r.change>=0?"+":""}{r.change}%</span>
                <div className="flex items-center gap-1">
                  <div className="w-10 bg-gray-700 rounded-full h-1.5"><div className="bg-blue-500 h-1.5 rounded-full" style={{width:`${r.confidence}%`}}/></div>
                  <span className="text-xs text-blue-400">{r.confidence}%</span>
                </div>
              </div>
            </div>
            <div className="text-xs text-gray-400 mb-1.5">{r.reason}</div>
            <div className="grid grid-cols-4 gap-2 text-xs">
              <span><span className="text-gray-500">Entry </span><span className="text-white font-mono">${fmtP(r.entry)}</span></span>
              <span><span className="text-red-500">SL </span><span className="text-red-400 font-mono">${fmtP(r.sl)}</span></span>
              <span><span className="text-green-500">TP </span><span className="text-green-400 font-mono">${fmtP(r.tp)}</span></span>
              <span><span className="text-gray-500">RR </span><span className="text-yellow-400 font-mono">{r.rr}:1</span></span>
            </div>
          </div>
        ))}
        {filtered.length===0&&<div className="text-center text-gray-500 py-6 text-sm">No signals matching filter</div>}
      </div>
    </div>
  );
}

// ─── AI Intelligence ─────────────────────────────────────────────────────────
function AIPanel({ candles, ticker, symbol, timeframe }:{ candles?:OHLCCandle[]; ticker?:Ticker; symbol:string; timeframe:string }) {
  const [loading, setLoading] = useState(false);
  const [analysis, setAnalysis] = useState<any>(null);
  const [err, setErr] = useState<string|null>(null);
  const base=SYMBOLS.find(s=>s.symbol===symbol)?.base??symbol.replace("USDT","");
  const run=useCallback(async()=>{
    if(!candles||!ticker) return;
    setLoading(true); setErr(null);
    try {
      const cl=candles.map(c=>c.close);
      const r=rsi(cl), m=macd(cl), at=atr(candles), bb=bollinger(cl), sig=mtfSignal(candles);
      const e20=ema(cl,20), e50=ema(cl,50);
      const ctx={ symbol, timeframe, price:ticker.price, change24h:ticker.change24h, high24h:ticker.high24h, low24h:ticker.low24h, volume:ticker.volume24h,
        rsi:Math.round(r*10)/10, macd:Math.round(m.macd*10000)/10000, macdSignal:Math.round(m.signal*10000)/10000, macdHistogram:Math.round(m.histogram*10000)/10000,
        atr:Math.round(at*100)/100, bbUpper:Math.round(bb.upper*100)/100, bbLower:Math.round(bb.lower*100)/100,
        ema20:Math.round(e20[e20.length-1]*100)/100, ema50:Math.round(e50[e50.length-1]*100)/100,
        trend:sig.trend, momentum:sig.momentum, support:Math.round(sig.support*100)/100, resistance:Math.round(sig.resistance*100)/100,
      };
      const res=await fetch("/api/ai/analyze",{ method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify({ symbol, timeframe, context:JSON.stringify(ctx) }) });
      setAnalysis(await res.json());
    } catch(e:any) { setErr(e.message); }
    setLoading(false);
  },[candles,ticker,symbol,timeframe]);

  if (!candles||!ticker) return <div className="p-6 text-center text-gray-500 text-sm">Waiting for market data…</div>;
  const cl=candles.map(c=>c.close), sig=mtfSignal(candles), r=rsi(cl), m=macd(cl);
  const isBull=sig.trend.includes("Bullish"), isBear=sig.trend.includes("Bearish");
  return (
    <div className="p-4 space-y-4">
      {/* Quick summary card */}
      <div className={clx("rounded-xl p-4 border", isBull?"border-green-800/50 bg-green-950/20":isBear?"border-red-800/50 bg-red-950/20":"border-yellow-800/50 bg-yellow-950/20")}>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Brain size={15} className="text-blue-400"/>
            <span className="text-sm font-bold text-white">AI Market Intelligence</span>
            <span className="text-xs text-gray-500">· {base}/{timeframe}</span>
          </div>
          <button onClick={run} disabled={loading||!candles}
            className="flex items-center gap-1.5 text-xs bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white px-3 py-1.5 rounded-lg transition-colors">
            {loading?<RefreshCw size={11} className="animate-spin"/>:<Brain size={11}/>}
            {loading?"Analyzing…":"Run Full Analysis"}
          </button>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { l:"Market Bias", v:sig.trend,                                                              c:isBull?"text-green-400":isBear?"text-red-400":"text-yellow-400" },
            { l:"Confidence",  v:`${sig.confidence}%`,                                                   c:"text-blue-400" },
            { l:"RSI",         v:fmt(r,1),                                                               c:r>70?"text-red-400":r<30?"text-green-400":"text-yellow-400" },
            { l:"MACD",        v:m.macd>m.signal?"Bullish cross":"Bearish cross",                        c:m.macd>m.signal?"text-green-400":"text-red-400" },
          ].map(s=>(
            <div key={s.l}>
              <div className="text-xs text-gray-500">{s.l}</div>
              <div className={clx("text-sm font-bold mt-0.5",s.c)}>{s.v}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Market structure */}
      <div className="bg-[#111827] rounded-xl p-4">
        <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Market Structure</h4>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
          {[
            { l:"Trend Phase",    v:isBull?"Uptrend":isBear?"Downtrend":"Sideways" },
            { l:"Momentum",       v:sig.momentum },
            { l:"Strength",       v:`${sig.strength}%` },
            { l:"Support Zone",   v:`$${fmtP(sig.support)}` },
            { l:"Resistance",     v:`$${fmtP(sig.resistance)}` },
            { l:"Price vs EMA20", v:(()=>{const e=ema(cl,20);const d=(ticker.price-e[e.length-1])/e[e.length-1]*100;return `${d>=0?"+":""}${d.toFixed(2)}%`;})() },
          ].map(s=>(
            <div key={s.l} className="bg-[#0d1117] rounded-lg p-2">
              <div className="text-xs text-gray-500">{s.l}</div>
              <div className="text-xs font-mono text-gray-200 mt-0.5">{s.v}</div>
            </div>
          ))}
        </div>
      </div>

      {/* AI response */}
      {err&&<div className="bg-red-950/20 border border-red-800/40 rounded-lg p-3 text-sm text-red-400">{err}</div>}
      {analysis&&(
        <div className="space-y-3">
          <div className={clx("rounded-xl p-4 border",
            analysis.bias?.toLowerCase().includes("bull")?"border-green-800 bg-green-950/20":
            analysis.bias?.toLowerCase().includes("bear")?"border-red-800 bg-red-950/20":"border-yellow-800 bg-yellow-950/20"
          )}>
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-bold text-white">Full Analysis Report</span>
              <span className={clx("px-3 py-1 rounded-full text-xs font-bold",
                analysis.bias?.toLowerCase().includes("bull")?"bg-green-900/50 text-green-400":
                analysis.bias?.toLowerCase().includes("bear")?"bg-red-900/50 text-red-400":"bg-yellow-900/50 text-yellow-400"
              )}>{analysis.bias??"Neutral"}</span>
            </div>
            {analysis.summary&&<p className="text-sm text-gray-300 leading-relaxed">{analysis.summary}</p>}
          </div>
          {(analysis.entry||analysis.stopLoss||analysis.takeProfit)&&(
            <div className="grid grid-cols-3 gap-3">
              {[
                { l:"Entry Zone", v:`$${fmtP(analysis.entry??0)}`,                         c:"text-blue-400",  bg:"bg-blue-950/20 border-blue-800/40" },
                { l:"Stop Loss",  v:`$${fmtP(analysis.stopLoss??analysis.stop_loss??0)}`,   c:"text-red-400",   bg:"bg-red-950/20 border-red-800/40" },
                { l:"Take Profit",v:`$${fmtP(analysis.takeProfit??analysis.take_profit??0)}`,c:"text-green-400",bg:"bg-green-950/20 border-green-800/40" },
              ].map(s=>(
                <div key={s.l} className={clx("rounded-lg p-3 border text-center",s.bg)}>
                  <div className="text-xs text-gray-500">{s.l}</div>
                  <div className={clx("text-sm font-mono font-bold mt-1",s.c)}>{s.v}</div>
                </div>
              ))}
            </div>
          )}
          {analysis.reasoning&&(
            <div className="bg-[#111827] rounded-xl p-4">
              <div className="text-xs font-semibold text-blue-400 mb-2">Reasoning</div>
              <p className="text-xs text-gray-400 leading-relaxed">{analysis.reasoning}</p>
            </div>
          )}
          {analysis.risks&&(
            <div className="bg-red-950/10 border border-red-900/30 rounded-xl p-3">
              <div className="text-xs font-semibold text-red-400 mb-1">Key Risks</div>
              <p className="text-xs text-gray-400 leading-relaxed">{analysis.risks}</p>
            </div>
          )}
        </div>
      )}
      {!analysis&&!loading&&(
        <div className="bg-[#111827] rounded-xl p-6 text-center">
          <Brain size={28} className="text-blue-400/40 mx-auto mb-2"/>
          <div className="text-sm text-gray-400 mb-1">Deep AI analysis not run yet</div>
          <div className="text-xs text-gray-600">Click "Run Full Analysis" for a complete report: entry, SL, TP, reasoning & risk assessment.</div>
        </div>
      )}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function MarketData() {
  const [symbol, setSymbol]     = useState("BTCUSDT");
  const [timeframe, setTf]      = useState("1h");
  const [rightTab, setRightTab] = useState<"book"|"trades"|"stats">("book");
  const [bottomTab, setBot]     = useState<"mtf"|"indicators"|"volume"|"whale"|"funding"|"correlation"|"scanner"|"ai">("mtf");
  const [searchQ, setSearchQ]   = useState("");
  const [showSearch, setShowSearch] = useState(false);
  const [favorites, setFavs]    = useState(new Set(["BTCUSDT","ETHUSDT"]));
  const [fullChart, setFullChart]= useState(false);

  const { data:ticker, isFetching:tickFetch } = useTicker(symbol);
  const { data:candles, isLoading:candLoading } = useKlines(symbol, timeframe, 300);
  const base=SYMBOLS.find(s=>s.symbol===symbol)?.base??symbol.replace("USDT","");
  const filtered=SYMBOLS.filter(s=>s.symbol.toLowerCase().includes(searchQ.toLowerCase())||s.name.toLowerCase().includes(searchQ.toLowerCase()));

  const BOTTOM_TABS=[
    { k:"mtf",         icon:<GitBranch size={12}/>,  l:"MTF" },
    { k:"indicators",  icon:<Activity size={12}/>,   l:"Indicators" },
    { k:"volume",      icon:<BarChart2 size={12}/>,   l:"Volume" },
    { k:"whale",       icon:<Flame size={12}/>,       l:"Whale" },
    { k:"funding",     icon:<DollarSign size={12}/>,  l:"Funding/OI" },
    { k:"correlation", icon:<Layers size={12}/>,      l:"Correlation" },
    { k:"scanner",     icon:<ScanLine size={12}/>,    l:"AI Scanner" },
    { k:"ai",          icon:<Brain size={12}/>,        l:"AI Analysis" },
  ] as const;

  return (
    <div className="flex flex-col bg-[#0a0c10] text-gray-200 overflow-hidden" style={{height:"calc(100vh - 58px)"}}>

      {/* ── Top Toolbar ──────────────────────────────────────────────────── */}
      <div className="flex items-center gap-2 px-3 py-1.5 bg-[#0d1117] border-b border-[#1f2937] flex-shrink-0">
        {/* Symbol picker */}
        <div className="relative">
          <button onClick={()=>setShowSearch(!showSearch)}
            className="flex items-center gap-1.5 bg-[#1f2937] hover:bg-[#374151] rounded-lg px-3 py-1.5 text-sm font-bold text-white transition-colors">
            <span className="text-blue-400">{base}</span>
            <span className="text-gray-500">/USDT</span>
            {ticker&&<span className={clx("text-xs",ticker.change24h>=0?"text-green-400":"text-red-400")}>&nbsp;{ticker.change24h>=0?"+":""}{ticker.change24h.toFixed(2)}%</span>}
            <ChevronDown size={12} className="text-gray-500"/>
          </button>
          {showSearch&&(
            <div className="absolute top-full left-0 mt-1 w-60 bg-[#1a2233] border border-[#374151] rounded-xl shadow-2xl z-50">
              <div className="p-2 border-b border-[#374151]">
                <div className="flex items-center gap-1.5 bg-[#0d1117] rounded-lg px-2 py-1">
                  <Search size={11} className="text-gray-500"/>
                  <input className="bg-transparent text-sm text-gray-200 outline-none flex-1 placeholder-gray-600"
                    placeholder="Search…" value={searchQ} onChange={e=>setSearchQ(e.target.value)} autoFocus/>
                </div>
              </div>
              <div className="max-h-52 overflow-y-auto">
                {filtered.map(s=>(
                  <button key={s.symbol} onClick={()=>{ setSymbol(s.symbol); setShowSearch(false); setSearchQ(""); }}
                    className={clx("w-full flex items-center justify-between px-3 py-2 hover:bg-[#374151] transition-colors text-left",s.symbol===symbol&&"bg-blue-900/20")}>
                    <div className="flex items-center gap-2">
                      <button onClick={e=>{ e.stopPropagation(); setFavs(p=>{ const n=new Set(p); n.has(s.symbol)?n.delete(s.symbol):n.add(s.symbol); return n; }); }}
                        className={clx(favorites.has(s.symbol)?"text-yellow-400":"text-gray-600","hover:text-yellow-400")}>
                        <Star size={10} fill={favorites.has(s.symbol)?"currentColor":"none"}/>
                      </button>
                      <span className="text-sm font-bold text-white">{s.base}</span>
                      <span className="text-xs text-gray-500">{s.name}</span>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Timeframe buttons */}
        <div className="flex items-center bg-[#1f2937] rounded-lg overflow-hidden">
          {TIMEFRAMES.map(tf=>(
            <button key={tf} onClick={()=>setTf(tf)}
              className={clx("px-2 py-1.5 text-xs font-medium transition-colors",
                timeframe===tf?"bg-blue-600 text-white":"text-gray-400 hover:text-white hover:bg-[#374151]"
              )}>{TF_LABEL[tf]}</button>
          ))}
        </div>

        <div className="ml-auto flex items-center gap-2">
          {tickFetch&&<RefreshCw size={11} className="animate-spin text-blue-400"/>}
          <div className={clx("flex items-center gap-1 text-xs px-2 py-1 rounded-full", ticker?"bg-green-900/30 text-green-400":"bg-gray-800 text-gray-400")}>
            {ticker?<Wifi size={10}/>:<WifiOff size={10}/>}
            {ticker?"Live":"Connecting…"}
          </div>
          <button onClick={()=>setFullChart(!fullChart)} title="Toggle full chart"
            className="text-gray-500 hover:text-white p-1.5 rounded transition-colors">
            <Maximize2 size={13}/>
          </button>
        </div>
      </div>

      {/* ── Price Bar ────────────────────────────────────────────────────── */}
      <PriceBar ticker={ticker} symbol={symbol}/>

      {/* ── Chart + Right Sidebar ────────────────────────────────────────── */}
      <div className="flex overflow-hidden" style={{height:480, flexShrink:0}}>
        {/* Chart */}
        <div className="flex-1 min-w-0 relative bg-[#0a0c10] overflow-hidden">
          {candLoading&&(
            <div className="absolute inset-0 flex items-center justify-center bg-[#0a0c10]/90 z-10">
              <div className="flex items-center gap-2 text-gray-400 text-sm">
                <RefreshCw size={14} className="animate-spin"/>{base} chart loading…
              </div>
            </div>
          )}
          <TradingChart candles={candles??[]} height={480} showVolume/>
        </div>

        {/* Right sidebar */}
        {!fullChart&&(
          <div className="w-72 flex-shrink-0 flex flex-col border-l border-[#1f2937]">
            <div className="flex border-b border-[#1f2937]">
              {[{k:"book",l:"Order Book"},{k:"trades",l:"Trades"},{k:"stats",l:"Stats"}].map(t=>(
                <button key={t.k} onClick={()=>setRightTab(t.k as any)}
                  className={clx("flex-1 py-1.5 text-xs font-medium transition-colors",
                    rightTab===t.k?"bg-[#111827] text-white border-b-2 border-blue-500":"text-gray-500 hover:text-gray-300"
                  )}>{t.l}</button>
              ))}
            </div>
            <div className="flex-1 overflow-hidden">
              {rightTab==="book"   && <OrderBookPanel symbol={symbol}/>}
              {rightTab==="trades" && <TradesPanel symbol={symbol}/>}
              {rightTab==="stats"  && <StatsPanel ticker={ticker} candles={candles}/>}
            </div>
          </div>
        )}
      </div>

      {/* ── Bottom Analysis Panel ────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col border-t border-[#1f2937] min-h-0">
        {/* Tab bar */}
        <div className="flex items-center gap-1 px-3 py-1 border-b border-[#1f2937] bg-[#0d1117] overflow-x-auto flex-shrink-0">
          {BOTTOM_TABS.map(t=>(
            <button key={t.k} onClick={()=>setBot(t.k)}
              className={clx("flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors",
                bottomTab===t.k?"bg-blue-600 text-white":"text-gray-500 hover:text-gray-300 hover:bg-[#1f2937]"
              )}>
              {t.icon}{t.l}
            </button>
          ))}
        </div>
        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          {bottomTab==="mtf"         && <MTFPanel symbol={symbol}/>}
          {bottomTab==="indicators"  && <IndicatorsPanel candles={candles} ticker={ticker}/>}
          {bottomTab==="volume"      && <VolumePanel candles={candles}/>}
          {bottomTab==="whale"       && <WhalePanel symbol={symbol}/>}
          {bottomTab==="funding"     && <FundingPanel symbol={symbol}/>}
          {bottomTab==="correlation" && <CorrelationPanel/>}
          {bottomTab==="scanner"     && <ScannerPanel/>}
          {bottomTab==="ai"          && <AIPanel candles={candles} ticker={ticker} symbol={symbol} timeframe={timeframe}/>}
        </div>
      </div>

      {/* Dropdown backdrop */}
      {showSearch&&<div className="fixed inset-0 z-40" onClick={()=>setShowSearch(false)}/>}
    </div>
  );
}
