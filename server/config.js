import dotenv from "dotenv";

dotenv.config();

function parseTimeout(value, fallback) {
  const parsed = Number(value);
  if (Number.isNaN(parsed) || parsed <= 0) {
    return fallback;
  }
  return parsed;
}

export const config = {
  port: Number(process.env.PORT ?? 8787),
  databaseUrl: process.env.DATABASE_URL ?? "",
  timeoutMs: parseTimeout(process.env.REQUEST_TIMEOUT_MS, 10000),
  overpassApiUrl:
    process.env.OVERPASS_API_URL ??
    "https://overpass-api.de/api/interpreter,https://overpass.kumi.systems/api/interpreter,https://overpass.openstreetmap.fr/api/interpreter",
  sync: {
    limitPerTownship: Number(process.env.SYNC_LIMIT_PER_TOWNSHIP ?? 120),
    sourceFilter: process.env.SYNC_SOURCE_FILTER ?? "osm",
    intervalMinutes: Number(process.env.SYNC_INTERVAL_MINUTES ?? 30)
  },
  googleMapsApiKey: process.env.GOOGLE_MAPS_API_KEY ?? "",
  facebookAccessToken: process.env.FACEBOOK_ACCESS_TOKEN ?? "",
  grab: {
    baseUrl: process.env.GRAB_API_BASE_URL ?? "",
    token: process.env.GRAB_API_TOKEN ?? ""
  },
  foodpanda: {
    baseUrl: process.env.FOODPANDA_API_BASE_URL ?? "",
    token: process.env.FOODPANDA_API_TOKEN ?? ""
  }
};
