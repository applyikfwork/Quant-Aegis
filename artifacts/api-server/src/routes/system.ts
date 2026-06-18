import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { systemLogsTable } from "@workspace/db";
import {
  GetSystemLogsQueryParams,
  GetSystemLogsResponse,
} from "@workspace/api-zod";
import { eq, desc, and } from "drizzle-orm";

const startTime = Date.now();

const router: IRouter = Router();

router.get("/system/status", async (_req, res): Promise<void> => {
  let dbConnected = false;
  let dbLatency: number | null = null;

  try {
    const t0 = Date.now();
    await db.execute({ sql: "SELECT 1", params: [] } as Parameters<typeof db.execute>[0]);
    dbLatency = Date.now() - t0;
    dbConnected = true;
  } catch {
    // DB check failed
  }

  // Verify CoinGecko reachability
  let cgLatency: number | null = null;
  let cgStatus: "online" | "offline" | "degraded" = "offline";
  try {
    const t0 = Date.now();
    const r = await fetch("https://api.coingecko.com/api/v3/ping", { signal: AbortSignal.timeout(3000) });
    cgLatency = Date.now() - t0;
    cgStatus = r.ok ? "online" : "degraded";
  } catch {
    cgStatus = "offline";
  }

  const now = new Date().toISOString();
  const services = [
    { name: "API Server", status: "online" as const, lastChecked: now, latencyMs: null },
    { name: "PostgreSQL Database", status: dbConnected ? ("online" as const) : ("offline" as const), lastChecked: now, latencyMs: dbLatency },
    { name: "CoinGecko Market Data", status: cgStatus, lastChecked: now, latencyMs: cgLatency },
    { name: "Indicator Engine", status: "online" as const, lastChecked: now, latencyMs: null },
    { name: "Signal Engine", status: "online" as const, lastChecked: now, latencyMs: null },
  ];

  const overallStatus = services.every((s) => s.status === "online")
    ? "healthy"
    : services.some((s) => s.status === "offline")
    ? "degraded"
    : "healthy";

  res.json({
    status: overallStatus,
    services,
    databaseConnected: dbConnected,
    uptime: Math.floor((Date.now() - startTime) / 1000),
    version: "1.0.0",
  });
});

router.get("/system/logs", async (req, res): Promise<void> => {
  const query = GetSystemLogsQueryParams.safeParse(req.query);
  if (!query.success) {
    res.status(400).json({ error: query.error.message });
    return;
  }

  const conditions = [];
  if (query.data.service) {
    conditions.push(eq(systemLogsTable.service, query.data.service));
  }

  const logs = await db
    .select()
    .from(systemLogsTable)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(systemLogsTable.timestamp))
    .limit(query.data.limit ?? 50);

  res.json(
    GetSystemLogsResponse.parse(
      logs.map((l) => ({
        ...l,
        timestamp: l.timestamp.toISOString(),
      }))
    )
  );
});

export default router;
