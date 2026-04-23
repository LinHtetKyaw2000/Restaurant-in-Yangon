import { pool } from "../db/pool.js";

function parsePhotoArray(value) {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => {
      if (typeof item === "string") return { url: item };
      if (item && typeof item.url === "string") return { url: item.url, source: item.source };
      return null;
    })
    .filter(Boolean);
}

function parseRawPayload(rawPayload) {
  if (!rawPayload || typeof rawPayload !== "object") return {};
  return rawPayload;
}

export async function queryDatabaseRestaurants({
  query,
  township,
  priceRange,
  minRating,
  signatureDish,
  page,
  limit
}) {
  const whereClauses = [];
  const params = [];

  if (query) {
    params.push(`%${query}%`);
    whereClauses.push(`(r.name ILIKE $${params.length} OR r.address ILIKE $${params.length})`);
  }

  if (township) {
    params.push(township);
    whereClauses.push(`t.name = $${params.length}`);
  }

  if (priceRange) {
    params.push(priceRange);
    whereClauses.push(`r.price_range = $${params.length}`);
  }

  if (minRating !== null) {
    params.push(minRating);
    whereClauses.push(`r.rating IS NOT NULL AND r.rating >= $${params.length}`);
  }

  if (signatureDish) {
    params.push(`%${signatureDish}%`);
    whereClauses.push(
      `EXISTS (SELECT 1 FROM restaurant_menus m WHERE m.restaurant_id = r.id AND m.item_name ILIKE $${params.length})`
    );
  }

  const whereSql = whereClauses.length ? `WHERE ${whereClauses.join(" AND ")}` : "";

  const countResult = await pool.query(
    `
      SELECT COUNT(*)::INT AS total_count
      FROM restaurants r
      LEFT JOIN townships t ON t.id = r.township_id
      ${whereSql}
    `,
    params
  );

  const totalCount = countResult.rows[0]?.total_count ?? 0;
  const totalPages = Math.max(1, Math.ceil(totalCount / limit));
  const offset = (page - 1) * limit;

  const rowsResult = await pool.query(
    `
      SELECT
        r.id,
        r.primary_source AS source,
        r.name,
        r.address,
        COALESCE(t.name, '') AS township,
        r.lat,
        r.lng,
        r.opening_hours AS hours,
        r.phone,
        r.price_range AS "priceRange",
        r.rating,
        r.review_count AS "reviewCount",
        r.review_summary AS "reviewSummary",
        r.raw_payload AS "rawPayload"
      FROM restaurants r
      LEFT JOIN townships t ON t.id = r.township_id
      ${whereSql}
      ORDER BY r.review_count DESC NULLS LAST, r.name ASC
      LIMIT $${params.length + 1}
      OFFSET $${params.length + 2}
    `,
    [...params, limit, offset]
  );

  const restaurantIds = rowsResult.rows.map((row) => row.id);
  let menuMap = new Map();
  if (restaurantIds.length > 0) {
    const menuResult = await pool.query(
      `
        SELECT restaurant_id, item_name
        FROM restaurant_menus
        WHERE restaurant_id = ANY($1::uuid[])
      `,
      [restaurantIds]
    );
    menuMap = menuResult.rows.reduce((acc, row) => {
      const list = acc.get(row.restaurant_id) ?? [];
      list.push(row.item_name);
      acc.set(row.restaurant_id, list);
      return acc;
    }, new Map());
  }

  const data = rowsResult.rows.map((row) => {
    const raw = parseRawPayload(row.rawPayload);
    const photos = parsePhotoArray(raw.photos);
    const menuPhotos = parsePhotoArray(raw.menuPhotos);
    const dishesFromMenus = menuMap.get(row.id) ?? [];
    const dishes = dishesFromMenus.length > 0 ? dishesFromMenus : Array.isArray(raw.dishes) ? raw.dishes : [];

    return {
      id: String(row.id),
      source: row.source,
      name: row.name,
      location: {
        address: row.address,
        township: row.township,
        lat: row.lat,
        lng: row.lng
      },
      hours: row.hours ?? "",
      phone: row.phone ?? "",
      dishes,
      reviews: {
        rating: row.rating === null ? null : Number(row.rating),
        count: row.reviewCount,
        summary: row.reviewSummary ?? ""
      },
      priceRange: row.priceRange,
      photos,
      menuPhotos
    };
  });

  return {
    data,
    meta: {
      requestedSources: ["database"],
      errorCount: 0,
      errors: [],
      pagination: {
        page,
        pageSize: limit,
        totalCount,
        totalPages,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1
      }
    }
  };
}
