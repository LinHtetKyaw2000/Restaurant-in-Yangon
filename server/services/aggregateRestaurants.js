import { normalizeRestaurantRecord } from "./normalize.js";
import { fetchFoodpandaRestaurants } from "./providers/foodpanda.js";
import { fetchGoogleRestaurants } from "./providers/googleMaps.js";
import { fetchGrabRestaurants } from "./providers/grab.js";
import { fetchFacebookRestaurants } from "./providers/facebook.js";
import { fetchOsmRestaurants } from "./providers/osm.js";

const providerFetchers = {
  osm: fetchOsmRestaurants,
  google: fetchGoogleRestaurants,
  grab: fetchGrabRestaurants,
  foodpanda: fetchFoodpandaRestaurants,
  facebook: fetchFacebookRestaurants
};

export const availableSources = Object.keys(providerFetchers);

function parseSources(sourceText) {
  if (!sourceText) {
    return ["osm"];
  }

  return sourceText
    .split(",")
    .map((source) => source.trim().toLowerCase())
    .filter((source) => availableSources.includes(source));
}

export async function aggregateRestaurants({
  query,
  township,
  limit,
  sourceText,
  strict,
  config
}) {
  const sources = parseSources(sourceText);
  const tasks = sources.map(async (source) => {
    try {
      const rows = await providerFetchers[source]({ query, township, limit, config });
      return { source, rows };
    } catch (error) {
      throw {
        source,
        status: error?.status ?? 500,
        message: error?.message ?? "Unknown provider error"
      };
    }
  });

  const settled = await Promise.allSettled(tasks);
  const data = [];
  const errors = [];

  for (const result of settled) {
    if (result.status === "fulfilled") {
      data.push(...result.value.rows.map(normalizeRestaurantRecord));
      continue;
    }
    errors.push({
      source: result.reason?.source ?? "unknown",
      status: result.reason?.status ?? 500,
      message: result.reason?.message ?? "Unknown provider error"
    });
  }

  if (strict && errors.length > 0) {
    const err = new Error("At least one source failed");
    err.status = 502;
    err.details = errors;
    throw err;
  }

  return {
    data,
    meta: {
      requestedSources: sources,
      errorCount: errors.length,
      errors
    }
  };
}
