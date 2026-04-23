import { config } from "../config.js";
import { pool } from "../db/pool.js";
import { runRestaurantSyncJob } from "./syncRestaurants.js";

async function runOnce() {
  const result = await runRestaurantSyncJob();
  // eslint-disable-next-line no-console
  console.log(`[sync] completed run ${result.runId} with ${result.restaurantUpserts} restaurant upserts`);
}

async function start() {
  const intervalMs = Math.max(5, config.sync.intervalMinutes) * 60 * 1000;
  await runOnce();
  setInterval(async () => {
    try {
      await runOnce();
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error("[sync] failed:", error.message);
    }
  }, intervalMs);
}

start().catch(async (error) => {
  // eslint-disable-next-line no-console
  console.error(error);
  await pool.end();
  process.exit(1);
});
