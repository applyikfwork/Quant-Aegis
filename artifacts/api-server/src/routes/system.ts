import { Router, type IRouter } from "express";
import { supabase } from "../lib/supabase";
import { GetSystemLogsQueryParams } from "@workspace/api-zod";

const startTime = Date.now();
const router: IRouter = Router();

router.get("/system/status", async (_req, res): Promise<void> => {
  let dbConnected = false;
  let dbLatency: number | null = null;
  try {
    const t0 = Date.now();
    const { error } = await supabase.from("strategies").select("id").limit(1);
    dbLatency = Date.now() - t0;
    dbConnected = !error;
  } catch { /* ignore */ }

  let cgLatency: number | null = null;
  let cgStatus: "online" | "offline" | "degraded" = "offline";
  try {
    const t0 = Date.now();
    const r = await fetch("https://api.coingecko.com/api/v3/ping", { signal: AbortSignal.timeout(3000) });
    cgLatency = Date.now() - t0;
    cgStatus = r.ok ? "online" : "degraded";
  } catch { cgStatus = "offline"; }

  let binanceStatus: "online" | "offline" | "degraded" = "offline";
  try {
    const r = await fetch("https://api.binance.com/api/v3/ping", { signal: AbortSignal.timeout(3000) });
    binanceStatus = r.ok ? "online" : "degraded";
  } catch { binanceStatus = "offline"; }

  const now = new Date().toISOString();
  const services = [
    { name: "API Server", status: "online" as const, lastChecked: now, latencyMs: null },
    { name: "Supabase Database", status: dbConnected ? "online" as const : "offline" as const, lastChecked: now, latencyMs: dbLatency },
    { name: "Supabase Realtime", status: dbConnected ? "online" as const : "offline" as const, lastChecked: now, latencyMs: null },
    { name: "CoinGecko Market Data", status: cgStatus, lastChecked: now, latencyMs: cgLatency },
    { name: "Binance Market Data", status: binanceStatus, lastChecked: now, latencyMs: null },
  ];
  const overallStatus = services.every(s => s.status === "online") ? "healthy"
    : services.some(s => s.status === "offline") ? "degraded" : "healthy";

  res.json({ status: overallStatus, services, databaseConnected: dbConnected, uptime: Math.floor((Date.now() - startTime) / 1000), version: "2.0.0" });
});

router.get("/system/logs", async (req, res): Promise<void> => {
  const query = GetSystemLogsQueryParams.safeParse(req.query);
  if (!query.success) { res.status(400).json({ error: query.error.message }); return; }
  let q = supabase.from("system_logs").select("*").order("timestamp", { ascending: false }).limit(query.data.limit ?? 50);
  if (query.data.service) q = q.eq("service", query.data.service);
  const { data, error } = await q;
  if (error) { res.status(500).json({ error: error.message }); return; }
  res.json((data ?? []).map(l => ({ id: l.id, service: l.service, event: l.event, message: l.message, level: l.level, timestamp: l.timestamp })));
});

export default router;
