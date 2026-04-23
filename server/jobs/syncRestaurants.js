import { config } from "../config.js";
import { pool } from "../db/pool.js";
import { yangonTownships } from "../data/yangonTownships.js";
import { aggregateRestaurants } from "../services/aggregateRestaurants.js";
import { fileURLToPath } from "node:url";

function normalizeExternalId(restaurant) {
  if (restaurant.id) {
    return String(restaurant.id);
  }
  return `${restaurant.source}:${restaurant.name}:${restaurant.location?.address ?? ""}`;
}

function makeReviewFingerprint(restaurant) {
  const rating = restaurant.reviews?.rating ?? "";
  const count = restaurant.reviews?.count ?? "";
  const summary = restaurant.reviews?.summary ?? "";
  return `${rating}|${count}|${summary}`.slice(0, 240);
}

async function upsertTownship(client, name, cache) {
  if (cache.has(name)) {
    return cache.get(name);
  }
  const result = await client.query(
    `
      INSERT INTO townships (name)
      VALUES ($1)
      ON CONFLICT (name) DO UPDATE SET name = EXCLUDED.name
      RETURNING id
    `,
    [name]
  );
  const townshipId = result.rows[0].id;
  cache.set(name, townshipId);
  return townshipId;
}

async function upsertRestaurant(client, townshipId, restaurant) {
  const result = await client.query(
    `
      INSERT INTO restaurants (
        external_id,
        primary_source,
        name,
        township_id,
        address,
        lat,
        lng,
        opening_hours,
        phone,
        price_range,
        rating,
        review_count,
        review_summary,
        raw_payload,
        updated_at
      )
      VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14::jsonb, NOW()
      )
      ON CONFLICT (primary_source, external_id)
      DO UPDATE SET
        name = EXCLUDED.name,
        township_id = EXCLUDED.township_id,
        address = EXCLUDED.address,
        lat = EXCLUDED.lat,
        lng = EXCLUDED.lng,
        opening_hours = EXCLUDED.opening_hours,
        phone = EXCLUDED.phone,
        price_range = EXCLUDED.price_range,
        rating = EXCLUDED.rating,
        review_count = EXCLUDED.review_count,
        review_summary = EXCLUDED.review_summary,
        raw_payload = EXCLUDED.raw_payload,
        updated_at = NOW()
      RETURNING id
    `,
    [
      normalizeExternalId(restaurant),
      restaurant.source,
      restaurant.name,
      townshipId,
      restaurant.location?.address ?? "",
      restaurant.location?.lat ?? null,
      restaurant.location?.lng ?? null,
      restaurant.hours ?? "",
      restaurant.phone ?? "",
      restaurant.priceRange ?? null,
      restaurant.reviews?.rating ?? null,
      restaurant.reviews?.count ?? null,
      restaurant.reviews?.summary ?? "",
      JSON.stringify(restaurant)
    ]
  );
  return result.rows[0].id;
}

async function upsertSourceRows(client, restaurantId, restaurant) {
  let count = 0;
  const sourceRef = normalizeExternalId(restaurant);
  await client.query(
    `
      INSERT INTO restaurant_sources (restaurant_id, source_name, source_ref, source_url, payload)
      VALUES ($1, $2, $3, $4, $5::jsonb)
      ON CONFLICT (restaurant_id, source_name, source_ref)
      DO UPDATE SET source_url = EXCLUDED.source_url, payload = EXCLUDED.payload, fetched_at = NOW()
    `,
    [restaurantId, restaurant.source, sourceRef, restaurant.sourceUrl || null, JSON.stringify(restaurant)]
  );
  count += 1;

  const photoRows = [...(restaurant.photos ?? []), ...(restaurant.menuPhotos ?? [])];
  for (const photo of photoRows) {
    const photoRef = photo.url ?? "";
    if (!photoRef) {
      continue;
    }
    await client.query(
      `
        INSERT INTO restaurant_sources (restaurant_id, source_name, source_ref, source_url, payload)
        VALUES ($1, $2, $3, $4, $5::jsonb)
        ON CONFLICT (restaurant_id, source_name, source_ref)
        DO UPDATE SET source_url = EXCLUDED.source_url, payload = EXCLUDED.payload, fetched_at = NOW()
      `,
      [restaurantId, photo.source ?? restaurant.source, photoRef, photo.url, JSON.stringify(photo)]
    );
    count += 1;
  }
  return count;
}

async function upsertMenuRows(client, restaurantId, restaurant) {
  let count = 0;
  for (const dish of restaurant.dishes ?? []) {
    await client.query(
      `
        INSERT INTO restaurant_menus (restaurant_id, item_name, category, source_name)
        VALUES ($1, $2, 'dish', $3)
        ON CONFLICT (restaurant_id, item_name, category, source_name)
        DO UPDATE SET item_name = EXCLUDED.item_name
      `,
      [restaurantId, dish, restaurant.source]
    );
    count += 1;
  }
  return count;
}

async function upsertReviewRows(client, restaurantId, restaurant) {
  const fingerprint = makeReviewFingerprint(restaurant);
  if (!fingerprint || !restaurant.reviews?.summary) {
    return 0;
  }

  await client.query(
    `
      INSERT INTO restaurant_reviews (
        restaurant_id,
        source_name,
        review_fingerprint,
        rating,
        review_text,
        reviewed_at,
        payload
      )
      VALUES ($1, $2, $3, $4, $5, NOW(), $6::jsonb)
      ON CONFLICT (restaurant_id, source_name, review_fingerprint)
      DO UPDATE SET
        rating = EXCLUDED.rating,
        review_text = EXCLUDED.review_text,
        reviewed_at = EXCLUDED.reviewed_at,
        payload = EXCLUDED.payload
    `,
    [
      restaurantId,
      restaurant.source,
      fingerprint,
      restaurant.reviews?.rating ?? null,
      restaurant.reviews?.summary ?? "",
      JSON.stringify(restaurant.reviews ?? {})
    ]
  );
  return 1;
}

export async function runRestaurantSyncJob() {
  const client = await pool.connect();
  const townshipCache = new Map();
  const requestedSources = (config.sync.sourceFilter || "osm")
    .split(",")
    .map((source) => source.trim())
    .filter(Boolean);

  const runResult = await client.query(
    `
      INSERT INTO sync_runs (status, requested_sources, township_count)
      VALUES ('running', $1::text[], $2)
      RETURNING id
    `,
    [requestedSources, yangonTownships.length]
  );
  const runId = runResult.rows[0].id;

  let restaurantUpserts = 0;
  let menuUpserts = 0;
  let reviewUpserts = 0;
  let sourceUpserts = 0;

  try {
    for (const township of yangonTownships) {
      const result = await aggregateRestaurants({
        query: "",
        township,
        limit: config.sync.limitPerTownship,
        sourceText: config.sync.sourceFilter,
        strict: false,
        config
      });

      const townshipId = await upsertTownship(client, township, townshipCache);
      for (const restaurant of result.data) {
        const restaurantId = await upsertRestaurant(client, townshipId, restaurant);
        restaurantUpserts += 1;
        menuUpserts += await upsertMenuRows(client, restaurantId, restaurant);
        reviewUpserts += await upsertReviewRows(client, restaurantId, restaurant);
        sourceUpserts += await upsertSourceRows(client, restaurantId, restaurant);
      }
    }

    await client.query(
      `
        UPDATE sync_runs
        SET status = 'succeeded',
            restaurant_upserts = $2,
            menu_upserts = $3,
            review_upserts = $4,
            source_upserts = $5,
            finished_at = NOW()
        WHERE id = $1
      `,
      [runId, restaurantUpserts, menuUpserts, reviewUpserts, sourceUpserts]
    );
    return { runId, restaurantUpserts, menuUpserts, reviewUpserts, sourceUpserts };
  } catch (error) {
    await client.query(
      `
        UPDATE sync_runs
        SET status = 'failed',
            finished_at = NOW(),
            restaurant_upserts = $2,
            menu_upserts = $3,
            review_upserts = $4,
            source_upserts = $5,
            error_payload = $6::jsonb
        WHERE id = $1
      `,
      [
        runId,
        restaurantUpserts,
        menuUpserts,
        reviewUpserts,
        sourceUpserts,
        JSON.stringify({ message: error.message })
      ]
    );
    throw error;
  } finally {
    client.release();
  }
}

async function main() {
  const result = await runRestaurantSyncJob();
  // eslint-disable-next-line no-console
  console.log(JSON.stringify(result, null, 2));
  await pool.end();
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main().catch(async (error) => {
    // eslint-disable-next-line no-console
    console.error(error);
    await pool.end();
    process.exit(1);
  });
}
