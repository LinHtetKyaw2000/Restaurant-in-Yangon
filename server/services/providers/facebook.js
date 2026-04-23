import { HttpError } from "../../errors.js";
import { fetchJson, pickArray } from "../../utils.js";

const FACEBOOK_GRAPH_ENDPOINT = "https://graph.facebook.com/v20.0/search";

function mapFacebookPage(page) {
  return {
    id: page.id,
    source: "facebook",
    name: page.name ?? "",
    location: {
      address: page.location?.street
        ? [page.location.street, page.location.city].filter(Boolean).join(", ")
        : "",
      township: page.location?.city ?? "",
      lat: page.location?.latitude ?? null,
      lng: page.location?.longitude ?? null
    },
    hours: "",
    phone: page.phone ?? "",
    dishes: [],
    reviews: {
      rating: page.overall_star_rating ?? null,
      count: page.rating_count ?? null,
      summary: ""
    },
    priceRange: null,
    photos: page.picture?.data?.url ? [{ url: page.picture.data.url, source: "Facebook" }] : [],
    menuPhotos: []
  };
}

export async function fetchFacebookRestaurants({ query, township, limit, config }) {
  if (!config.facebookAccessToken) {
    throw new HttpError(503, "FACEBOOK_ACCESS_TOKEN is required to fetch Facebook data.");
  }

  const q = [query || "restaurant", township || "", "Yangon"].filter(Boolean).join(" ");
  const url = new URL(FACEBOOK_GRAPH_ENDPOINT);
  url.searchParams.set("type", "page");
  url.searchParams.set("q", q);
  url.searchParams.set("limit", String(Math.min(limit, 50)));
  url.searchParams.set(
    "fields",
    "id,name,location,phone,overall_star_rating,rating_count,picture"
  );
  url.searchParams.set("access_token", config.facebookAccessToken);

  const data = await fetchJson(url.toString(), {}, config.timeoutMs);
  return pickArray(data.data).map(mapFacebookPage);
}
