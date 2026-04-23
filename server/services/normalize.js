import { normalizePriceRange, pickArray } from "../utils.js";

function normalizePhotos(photos) {
  return pickArray(photos)
    .map((photo) => {
      if (typeof photo === "string") {
        return { url: photo };
      }
      if (photo?.url) {
        return { url: photo.url, source: photo.source };
      }
      return null;
    })
    .filter(Boolean);
}

function normalizeDishes(dishes) {
  return pickArray(dishes).filter((dish) => typeof dish === "string");
}

export function normalizeRestaurantRecord(input) {
  return {
    id: String(input.id ?? ""),
    source: String(input.source ?? "unknown"),
    name: String(input.name ?? ""),
    location: {
      address: input.location?.address ? String(input.location.address) : "",
      township: input.location?.township ? String(input.location.township) : "",
      lat: typeof input.location?.lat === "number" ? input.location.lat : null,
      lng: typeof input.location?.lng === "number" ? input.location.lng : null
    },
    hours: input.hours ? String(input.hours) : "",
    phone: input.phone ? String(input.phone) : "",
    dishes: normalizeDishes(input.dishes),
    reviews: {
      rating: typeof input.reviews?.rating === "number" ? input.reviews.rating : null,
      count: typeof input.reviews?.count === "number" ? input.reviews.count : null,
      summary: input.reviews?.summary ? String(input.reviews.summary) : ""
    },
    priceRange: normalizePriceRange(input.priceRange),
    photos: normalizePhotos(input.photos),
    menuPhotos: normalizePhotos(input.menuPhotos),
    sourceUrl: input.sourceUrl ? String(input.sourceUrl) : ""
  };
}
