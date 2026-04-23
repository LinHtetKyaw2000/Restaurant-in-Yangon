import { HttpError } from "../../errors.js";
import { fetchJson, pickArray } from "../../utils.js";

function mapFoodpandaItem(item) {
  return {
    id: item.id ?? item.code ?? item.name,
    source: "foodpanda",
    name: item.name ?? "",
    location: {
      address: item.address ?? item.location?.address ?? "",
      township: item.township ?? item.location?.township ?? "",
      lat: item.location?.lat ?? null,
      lng: item.location?.lng ?? null
    },
    hours: item.hours ?? item.openingHours ?? "",
    phone: item.phone ?? "",
    dishes: pickArray(item.dishes ?? item.tags),
    reviews: {
      rating: item.rating ?? null,
      count: item.reviewCount ?? null,
      summary: item.reviewSummary ?? ""
    },
    priceRange: item.priceRange ?? item.price_level ?? null,
    photos: pickArray(item.photos).map((url) => ({ url, source: "Foodpanda" })),
    menuPhotos: pickArray(item.menuPhotos).map((url) => ({ url, source: "Foodpanda" }))
  };
}

export async function fetchFoodpandaRestaurants({ query, township, limit, config }) {
  if (!config.foodpanda.baseUrl) {
    throw new HttpError(
      503,
      "FOODPANDA_API_BASE_URL is required. Use a licensed provider endpoint or your own proxy."
    );
  }

  const url = new URL("/restaurants", config.foodpanda.baseUrl);
  if (query) url.searchParams.set("query", query);
  if (township) url.searchParams.set("township", township);
  url.searchParams.set("limit", String(limit));

  const headers = config.foodpanda.token
    ? { Authorization: `Bearer ${config.foodpanda.token}` }
    : undefined;

  const data = await fetchJson(url.toString(), { headers }, config.timeoutMs);
  const records = pickArray(data.restaurants ?? data.data ?? data.items);
  return records.map(mapFoodpandaItem);
}
