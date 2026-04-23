import { HttpError } from "../../errors.js";
import { fetchJson, pickArray } from "../../utils.js";

function mapGrabItem(item) {
  return {
    id: item.id ?? item.uuid ?? item.name,
    source: "grab",
    name: item.name ?? item.title ?? "",
    location: {
      address: item.address ?? item.location?.address ?? "",
      township: item.township ?? item.location?.township ?? "",
      lat: item.location?.lat ?? null,
      lng: item.location?.lng ?? null
    },
    hours: item.openingHours ?? item.hours ?? "",
    phone: item.phone ?? "",
    dishes: pickArray(item.dishes ?? item.categories),
    reviews: {
      rating: item.rating ?? null,
      count: item.reviewCount ?? null,
      summary: item.reviewSummary ?? ""
    },
    priceRange: item.priceRange ?? item.price_level ?? null,
    photos: pickArray(item.photos).map((url) => ({ url, source: "GrabFood" })),
    menuPhotos: pickArray(item.menuPhotos).map((url) => ({ url, source: "GrabFood" }))
  };
}

export async function fetchGrabRestaurants({ query, township, limit, config }) {
  if (!config.grab.baseUrl) {
    throw new HttpError(
      503,
      "GRAB_API_BASE_URL is required. Use a licensed provider endpoint or your own proxy."
    );
  }

  const url = new URL("/restaurants", config.grab.baseUrl);
  if (query) url.searchParams.set("query", query);
  if (township) url.searchParams.set("township", township);
  url.searchParams.set("limit", String(limit));

  const headers = config.grab.token
    ? { Authorization: `Bearer ${config.grab.token}` }
    : undefined;

  const data = await fetchJson(url.toString(), { headers }, config.timeoutMs);
  const records = pickArray(data.restaurants ?? data.data ?? data.items);
  return records.map(mapGrabItem);
}
