import express from "express";
import { config } from "../config.js";
import { yangonTownships } from "../data/yangonTownships.js";
import { availableSources, aggregateRestaurants } from "../services/aggregateRestaurants.js";
import { HttpError } from "../errors.js";

const router = express.Router();

function parseLimit(value) {
  if (!value) return 25;
  const parsed = Number(value);
  if (Number.isNaN(parsed) || parsed < 1 || parsed > 100) {
    throw new HttpError(400, "limit must be a number between 1 and 100");
  }
  return parsed;
}

function parseStrict(value) {
  return value === "1" || value === "true";
}

function parsePage(value) {
  if (!value) return 1;
  const parsed = Number(value);
  if (Number.isNaN(parsed) || parsed < 1) {
    throw new HttpError(400, "page must be a number greater than or equal to 1");
  }
  return parsed;
}

function parsePriceRange(value) {
  if (!value) return "";
  if (value === "$" || value === "$$" || value === "$$$") return value;
  throw new HttpError(400, "priceRange must be one of $, $$, $$$");
}

function parseMinRating(value) {
  if (!value) return null;
  const parsed = Number(value);
  if (Number.isNaN(parsed) || parsed < 0 || parsed > 5) {
    throw new HttpError(400, "minRating must be a number between 0 and 5");
  }
  return parsed;
}

router.get("/sources", (_req, res) => {
  res.json({ sources: availableSources });
});

router.get("/townships", (_req, res) => {
  res.json({ data: yangonTownships });
});

router.get("/restaurants", async (req, res, next) => {
  try {
    const query = typeof req.query.query === "string" ? req.query.query : "";
    const township = typeof req.query.township === "string" ? req.query.township : "";
    const sources = typeof req.query.sources === "string" ? req.query.sources : "";
    const limit = parseLimit(typeof req.query.limit === "string" ? req.query.limit : "");
    const page = parsePage(typeof req.query.page === "string" ? req.query.page : "");
    const strict = parseStrict(typeof req.query.strict === "string" ? req.query.strict : "");
    const priceRange = parsePriceRange(
      typeof req.query.priceRange === "string" ? req.query.priceRange : ""
    );
    const minRating = parseMinRating(
      typeof req.query.minRating === "string" ? req.query.minRating : ""
    );
    const signatureDish = typeof req.query.signatureDish === "string" ? req.query.signatureDish : "";
    const fetchMode = typeof req.query.from === "string" ? req.query.from : "db";

    if (fetchMode === "db" && config.databaseUrl) {
      const { queryDatabaseRestaurants } = await import("../services/queryDatabaseRestaurants.js");
      const dbResponse = await queryDatabaseRestaurants({
        query,
        township,
        priceRange,
        minRating,
        signatureDish,
        page,
        limit
      });
      res.json({
        data: dbResponse.data,
        meta: {
          ...dbResponse.meta,
          activeFilters: {
            township: township || null,
            priceRange: priceRange || null,
            minRating,
            signatureDish: signatureDish || null
          }
        }
      });
      return;
    }

    const response = await aggregateRestaurants({
      query,
      township,
      limit,
      sourceText: sources,
      strict,
      config
    });

    const signatureQuery = signatureDish.trim().toLowerCase();
    const filteredData = response.data.filter((restaurant) => {
      const matchesPrice = !priceRange || restaurant.priceRange === priceRange;
      const rating = typeof restaurant.reviews?.rating === "number" ? restaurant.reviews.rating : null;
      const matchesRating = minRating === null || (rating !== null && rating >= minRating);
      const matchesSignature =
        !signatureQuery ||
        (restaurant.dishes ?? []).some((dish) => dish.toLowerCase().includes(signatureQuery));
      return matchesPrice && matchesRating && matchesSignature;
    });

    const totalCount = filteredData.length;
    const totalPages = Math.max(1, Math.ceil(totalCount / limit));
    const offset = (page - 1) * limit;
    const pagedData = filteredData.slice(offset, offset + limit);

    res.json({
      data: pagedData,
      meta: {
        ...response.meta,
        activeFilters: {
          township: township || null,
          priceRange: priceRange || null,
          minRating,
          signatureDish: signatureDish || null
        },
        pagination: {
          page,
          pageSize: limit,
          totalCount,
          totalPages,
          hasNextPage: page < totalPages,
          hasPrevPage: page > 1
        }
      }
    });
  } catch (error) {
    next(error);
  }
});

export default router;
