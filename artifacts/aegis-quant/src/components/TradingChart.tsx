import { useEffect, useRef } from "react";
import { createChart, CandlestickSeries, HistogramSeries, LineSeries, ColorType } from "lightweight-charts";

export interface OHLCCandle {
  timestamp: string;
  open: number; high: number; low: number; close: number; volume: number;
}

interface Props {
  candles: OHLCCandle[];
  height?: number;
  showVolume?: boolean;
  ema20?: number | null;
  ema50?: number | null;
  ema200?: number | null;
}

export default function TradingChart({ candles, height = 420, showVolume = true, ema20, ema50, ema200 }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<any>(null);
  const candleSeriesRef = useRef<any>(null);
  const volSeriesRef = useRef<any>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    const chart = createChart(containerRef.current, {
      layout: { background: { type: ColorType.Solid, color: "#0a0c10" }, textColor: "#9ca3af" },
      grid: { vertLines: { color: "#1f2937" }, horzLines: { color: "#1f2937" } },
      crosshair: { mode: 1 },
      rightPriceScale: { borderColor: "#374151" },
      timeScale: { borderColor: "#374151", timeVisible: true, secondsVisible: false },
      width: containerRef.current.offsetWidth,
      height: showVolume ? height : height - 80,
    });

    const candleSeries = chart.addSeries(CandlestickSeries, {
      upColor: "#22c55e", downColor: "#ef4444",
      borderUpColor: "#22c55e", borderDownColor: "#ef4444",
      wickUpColor: "#22c55e", wickDownColor: "#ef4444",
    });

    let volSeries: any = null;
    if (showVolume) {
      volSeries = chart.addSeries(HistogramSeries, {
        color: "#3b82f640", priceFormat: { type: "volume" },
        priceScaleId: "volume",
      });
      chart.priceScale("volume").applyOptions({ scaleMargins: { top: 0.8, bottom: 0 } });
    }

    chartRef.current = chart;
    candleSeriesRef.current = candleSeries;
    volSeriesRef.current = volSeries;

    const ro = new ResizeObserver(entries => {
      for (const entry of entries) {
        chart.applyOptions({ width: entry.contentRect.width });
      }
    });
    ro.observe(containerRef.current);

    return () => { ro.disconnect(); chart.remove(); };
  }, [height, showVolume]);

  useEffect(() => {
    if (!candleSeriesRef.current || !candles?.length) return;
    try {
      const data = candles.map(c => ({
        time: Math.floor(new Date(c.timestamp).getTime() / 1000) as any,
        open: c.open, high: c.high, low: c.low, close: c.close,
      }));
      candleSeriesRef.current.setData(data);

      if (volSeriesRef.current) {
        const volData = candles.map(c => ({
          time: Math.floor(new Date(c.timestamp).getTime() / 1000) as any,
          value: c.volume,
          color: c.close >= c.open ? "#22c55e40" : "#ef444440",
        }));
        volSeriesRef.current.setData(volData);
      }
      chartRef.current?.timeScale().fitContent();
    } catch (_) { /* ignore timestamp conflicts */ }
  }, [candles]);

  return <div ref={containerRef} className="w-full" style={{ height }} />;
}
