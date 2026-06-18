import app from "./app";
import { logger } from "./lib/logger";
import { setupTables } from "./lib/supabase";
import { startMarketWorker } from "./lib/market-worker";

const rawPort = process.env["PORT"] ?? "8080";
const port = Number(rawPort);
if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

app.listen(port, async (err) => {
  if (err) {
    logger.error({ err }, "Error listening on port");
    process.exit(1);
  }
  logger.info({ port }, "Server listening");

  // Set up Supabase tables then start market worker
  try {
    await setupTables();
    startMarketWorker();
  } catch (e) {
    logger.warn({ err: e }, "Setup warning — market worker may need manual table creation");
    startMarketWorker();
  }
});
