import { HttpError } from "../../errors.js";
import { fetchJson } from "../../utils.js";

function escapeOverpassValue(value) {
  return String(value).replace(/"/g, '\\"');
}

function parseCuisine(tags) {
  const raw = tags.cuisine ?? "";
  if (!raw) return [];
  return raw
    .split(/[;,]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function buildAddress(tags) {
  const pieces = [
    tags["addr:housenumber"],
    tags["addr:street"],
    tags["addr:suburb"],
    tags["addr:city"],
    tags["addr:country"]
  ].filter(Boolean);

  if (pieces.length === 0) {
    return tags["addr:full"] ?? tags.address ?? "";
  }
  return pieces.join(", ");
}

function imageFromTag(imageTag) {
  if (!imageTag) return null;
  if (imageTag.startsWith("http://") || imageTag.startsWith("https://")) return imageTag;
  if (imageTag.startsWith("File:")) {
    return `https://commons.wikimedia.org/wiki/Special:FilePath/${encodeURIComponent(imageTag.slice(5))}`;
  }
  return null;
}

function buildPhotos(tags) {
  const urls = [];
  const image = imageFromTag(tags.image);
  if (image) urls.push(image);
  if (tags.wikimedia_commons) {
    const commons = tags.wikimedia_commons.replace(/^File:/, "");
    urls.push(`https://commons.wikimedia.org/wiki/Special:FilePath/${encodeURIComponent(commons)}`);
  }

  const unique = Array.from(new Set(urls));
  return unique.map((url) => ({ url, source: "OpenStreetMap" }));
}

function mapOverpassElement(element, townshipName) {
  const tags = element.tags ?? {};
  const lat = typeof element.lat === "number" ? element.lat : element.center?.lat ?? null;
  const lng = typeof element.lon === "number" ? element.lon : element.center?.lon ?? null;
  const cuisine = parseCuisine(tags);
  const photos = buildPhotos(tags);
  const osmUrl = `https://www.openstreetmap.org/${element.type}/${element.id}`;
  const townshipFromTags = tags["addr:suburb"] || tags["addr:city_district"] || tags["addr:city"];

  return {
    id: `osm:${element.type}/${element.id}`,
    source: "osm",
    name: tags.name,
    location: {
      address: buildAddress(tags),
      township: townshipFromTags || townshipName || "",
      lat,
      lng
    },
    hours: tags.opening_hours ?? "",
    phone: tags.phone ?? tags["contact:phone"] ?? "",
    dishes: cuisine,
    reviews: {
      rating: null,
      count: null,
      summary: ""
    },
    priceRange: tags.price_range ?? null,
    photos,
    menuPhotos: [],
    sourceUrl: osmUrl
  };
}

function buildOverpassQuery({ query }) {
  const cleanedQuery = escapeOverpassValue(query || "");
  const nameFilter = cleanedQuery ? `["name"~"${cleanedQuery}",i]` : "";

  return `
[out:json][timeout:120];
(
  node["amenity"~"restaurant|fast_food|cafe|food_court"${nameFilter}](16.6,95.9,17.2,96.35);
  way["amenity"~"restaurant|fast_food|cafe|food_court"${nameFilter}](16.6,95.9,17.2,96.35);
  relation["amenity"~"restaurant|fast_food|cafe|food_court"${nameFilter}](16.6,95.9,17.2,96.35);
);
out center tags;
  `.trim();
}

export async function fetchOsmRestaurants({ query, township, limit, config }) {
  if (!config.overpassApiUrl) {
    throw new HttpError(503, "OVERPASS_API_URL is required to fetch open data.");
  }

  const endpoints = config.overpassApiUrl
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);

  async function runOverpassRequest() {
    const overpassQuery = buildOverpassQuery({ query });
    let lastError = null;
    for (const endpoint of endpoints) {
      try {
        return await fetchJson(
          endpoint,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
              Accept: "application/json",
              "User-Agent": "YangonRestaurantPWA/1.0 (+https://localhost)",
              Referer: "https://localhost"
            },
            body: `data=${encodeURIComponent(overpassQuery)}`
          },
          Math.max(config.timeoutMs, 25000)
        );
      } catch (error) {
        lastError = error;
      }
    }
    throw lastError ?? new HttpError(503, "No Overpass endpoints available.");
  }

  const data = await runOverpassRequest();

  let rows = (data.elements ?? [])
    .filter((item) => item?.tags?.name)
    .map((item) => mapOverpassElement(item, township))
    .slice(0, Math.max(1, limit) * (township ? 5 : 1));

  if (township) {
    const townshipLower = township.toLowerCase();
    const townshipFiltered = rows.filter((row) =>
      row.location.township.toLowerCase().includes(townshipLower)
    );
    if (townshipFiltered.length > 0) {
      rows = townshipFiltered;
    }
  }

  rows = rows.slice(0, Math.max(1, limit));

  return rows;
}
