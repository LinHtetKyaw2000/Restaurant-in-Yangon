import { HttpError } from "../../errors.js";
import { fetchJson, normalizePriceRange, pickArray } from "../../utils.js";

const GOOGLE_TEXT_SEARCH_ENDPOINT = "https://places.googleapis.com/v1/places:searchText";

function mapPriceLevel(level) {
  if (!level) return null;
  if (level.includes("EXPENSIVE") || level.includes("VERY_EXPENSIVE")) return "$$$";
  if (level.includes("MODERATE")) return "$$";
  if (level.includes("INEXPENSIVE")) return "$";
  return normalizePriceRange(level);
}

function mapGooglePlace(place, apiKey) {
  const photos = pickArray(place.photos)
    .slice(0, 4)
    .map((photo) => ({
      url: `https://places.googleapis.com/v1/${photo.name}/media?maxHeightPx=1000&key=${apiKey}`,
      source: "Google Maps"
    }));

  return {
    id: place.id ?? place.name,
    source: "google",
    name: place.displayName?.text ?? "",
    location: {
      address: place.formattedAddress ?? "",
      township: "",
      lat: place.location?.latitude ?? null,
      lng: place.location?.longitude ?? null
    },
    hours: pickArray(place.regularOpeningHours?.weekdayDescriptions).join(" | "),
    phone: place.nationalPhoneNumber ?? "",
    dishes: pickArray(place.types),
    reviews: {
      rating: typeof place.rating === "number" ? place.rating : null,
      count: typeof place.userRatingCount === "number" ? place.userRatingCount : null,
      summary: ""
    },
    priceRange: mapPriceLevel(place.priceLevel),
    photos,
    menuPhotos: []
  };
}

export async function fetchGoogleRestaurants({ query, township, limit, config }) {
  if (!config.googleMapsApiKey) {
    throw new HttpError(503, "GOOGLE_MAPS_API_KEY is required to fetch Google Maps data.");
  }

  const textQuery = [query || "restaurants", township || "", "Yangon Myanmar"]
    .filter(Boolean)
    .join(" ");

  const payload = {
    textQuery,
    maxResultCount: Math.min(limit, 20),
    languageCode: "en",
    regionCode: "MM"
  };

  const data = await fetchJson(
    GOOGLE_TEXT_SEARCH_ENDPOINT,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": config.googleMapsApiKey,
        "X-Goog-FieldMask":
          "places.id,places.name,places.displayName,places.formattedAddress,places.location,places.regularOpeningHours,places.nationalPhoneNumber,places.rating,places.userRatingCount,places.priceLevel,places.types,places.photos"
      },
      body: JSON.stringify(payload)
    },
    config.timeoutMs
  );

  return pickArray(data.places).map((place) => mapGooglePlace(place, config.googleMapsApiKey));
}
