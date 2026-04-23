import { useEffect, useMemo, useState } from "react";
import type { ApiRestaurant, RestaurantsApiResponse, TownshipsApiResponse } from "./types";

const PAGE_SIZE = 12;
type Language = "en" | "my";
const apiBaseUrl =
  (import.meta.env.VITE_API_BASE_URL ||
    (import.meta.env.DEV ? "http://localhost:8787" : window.location.origin)).replace(/\/$/, "");
const staticDataPathByLang: Record<Language, string> = {
  en: "/data-osm-restaurants.json",
  my: "/data-osm-restaurants-my.json"
};
const uiText: Record<
  Language,
  {
    title: string;
    subtitle: string;
    language: string;
    search: string;
    searchPlaceholder: string;
    township: string;
    allTownships: string;
    signatureDish: string;
    signatureDishPlaceholder: string;
    partialResults: string;
    loadingRestaurants: string;
    restaurantsFound: string;
    previous: string;
    next: string;
    addressNotAvailable: string;
    townshipLabel: string;
    openingHoursLabel: string;
    phoneLabel: string;
    unknown: string;
    notAvailable: string;
    availableFoodDishes: string;
    notListed: string;
    noMatches: string;
  }
> = {
  en: {
    title: "Restaurant in Yangon",
    subtitle: "Warmly Welcome...",
    language: "Language",
    search: "Search",
    searchPlaceholder: "Restaurant, address, dish...",
    township: "Township",
    allTownships: "All townships",
    signatureDish: "Signature dish",
    signatureDishPlaceholder: "e.g. mohinga, shan noodles, steak",
    partialResults: "Partial results",
    loadingRestaurants: "Loading restaurants...",
    restaurantsFound: "restaurants found",
    previous: "Previous",
    next: "Next",
    addressNotAvailable: "Address not available",
    townshipLabel: "Township",
    openingHoursLabel: "Opening/Closing Hours",
    phoneLabel: "Phone Number",
    unknown: "-",
    notAvailable: "-",
    availableFoodDishes: "Available Food / Dishes",
    notListed: "-",
    noMatches: "No restaurants matched your filters."
  },
  my: {
    title: "Restaurant in Yangon",
    subtitle: "Warmly Welcome...",
    language: "ဘာသာစကား",
    search: "ရှာဖွေရန်",
    searchPlaceholder: "ဆိုင်အမည်၊ လိပ်စာ၊ ဟင်းအမည်...",
    township: "မြို့နယ်",
    allTownships: "မြို့နယ်အားလုံး",
    signatureDish: "အဓိကဟင်း",
    signatureDishPlaceholder: "ဥပမာ - မုန့်ဟင်းခါး၊ ရှမ်းခေါက်ဆွဲ၊ စတိတ်",
    partialResults: "ဒေတာအချို့သာ",
    loadingRestaurants: "ဆိုင်ဒေတာများ တင်နေသည်...",
    restaurantsFound: "ဆိုင် တွေ့ရှိသည်",
    previous: "ယခင်",
    next: "နောက်",
    addressNotAvailable: "လိပ်စာ မရှိသေးပါ",
    townshipLabel: "မြို့နယ်",
    openingHoursLabel: "ဖွင့်/ပိတ်ချိန်",
    phoneLabel: "ဖုန်းနံပါတ်",
    unknown: "-",
    notAvailable: "-",
    availableFoodDishes: "ရရှိနိုင်သော အစားအစာ/ဟင်းများ",
    notListed: "-",
    noMatches: "စစ်ထုတ်မှုအရ ကိုက်ညီသော ဆိုင်မတွေ့ပါ။"
  }
};

const staticRestaurantsPromiseByLang: Partial<Record<Language, Promise<ApiRestaurant[]>>> = {};

async function loadStaticRestaurants(lang: Language) {
  if (!staticRestaurantsPromiseByLang[lang]) {
    staticRestaurantsPromiseByLang[lang] = fetch(staticDataPathByLang[lang]).then(async (response) => {
      if (!response.ok) {
        throw new Error("Failed to load static restaurant data.");
      }
      const payload = (await response.json()) as ApiRestaurant[];
      return Array.isArray(payload) ? payload : [];
    });
  }
  return staticRestaurantsPromiseByLang[lang] as Promise<ApiRestaurant[]>;
}

function filterRestaurants({
  data,
  queryText,
  township,
  signatureDish
}: {
  data: ApiRestaurant[];
  queryText: string;
  township: string;
  signatureDish: string;
}) {
  const queryLower = queryText.toLowerCase();
  const dishLower = signatureDish.trim().toLowerCase();

  return data.filter((restaurant) => {
    const matchesQuery =
      !queryLower ||
      restaurant.name.toLowerCase().includes(queryLower) ||
      restaurant.location.address.toLowerCase().includes(queryLower);
    const matchesTownship =
      township === "all" ||
      restaurant.location.township.toLowerCase() === township.toLowerCase();
    const matchesSignature =
      !dishLower || restaurant.dishes.some((dish) => dish.toLowerCase().includes(dishLower));

    return matchesQuery && matchesTownship && matchesSignature;
  });
}

function App() {
  const [lang, setLang] = useState<Language>(() => {
    const saved = window.localStorage.getItem("lang");
    return saved === "my" ? "my" : "en";
  });
  const [search, setSearch] = useState("");
  const [township, setTownship] = useState("all");
  const [signatureDish, setSignatureDish] = useState("");
  const [page, setPage] = useState(1);
  const [townships, setTownships] = useState<string[]>([]);
  const [restaurants, setRestaurants] = useState<ApiRestaurant[]>([]);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [providerErrors, setProviderErrors] = useState<Array<{ source: string; message: string }>>(
    []
  );
  const t = uiText[lang];

  useEffect(() => {
    window.localStorage.setItem("lang", lang);
  }, [lang]);

  useEffect(() => {
    async function loadTownships() {
      try {
        const response = await fetch(`${apiBaseUrl}/api/townships`);
        if (!response.ok) {
          throw new Error("Failed to load township list.");
        }
        const payload = (await response.json()) as TownshipsApiResponse;
        if (!Array.isArray(payload.data)) {
          throw new Error("Invalid township response.");
        }
        setTownships(payload.data);
      } catch (loadError) {
        try {
          const fallback = await loadStaticRestaurants(lang);
          const townshipSet = new Set(
            fallback
              .map((item) => item.location.township.trim())
              .filter((item) => item.length > 0)
          );
          setTownships(Array.from(townshipSet).sort((a, b) => a.localeCompare(b)));
        } catch {
          const message =
            loadError instanceof Error ? loadError.message : "Failed to load township list.";
          setError(message);
        }
      }
    }

    loadTownships();
  }, [lang]);

  useEffect(() => {
    const queryText = search.trim();
    const timeout = setTimeout(() => {
      async function loadRestaurants() {
        setLoading(true);
        setError(null);

        try {
          const params = new URLSearchParams({
            limit: String(PAGE_SIZE),
            page: String(page),
            from: "db"
          });

          if (queryText) {
            params.set("query", queryText);
          }
          if (township !== "all") {
            params.set("township", township);
          }
          if (signatureDish.trim()) {
            params.set("signatureDish", signatureDish.trim());
          }

          const response = await fetch(`${apiBaseUrl}/api/restaurants?${params.toString()}`);
          if (!response.ok) {
            throw new Error("Failed to load restaurant data from API.");
          }

          const payload = (await response.json()) as RestaurantsApiResponse;
          if (!Array.isArray(payload.data) || !payload.meta?.pagination) {
            throw new Error("Invalid restaurant response.");
          }
          setRestaurants(payload.data);
          setTotalPages(payload.meta.pagination.totalPages);
          setTotalCount(payload.meta.pagination.totalCount);
          setProviderErrors(
            payload.meta.errors.map((item) => ({
              source: item.source,
              message: item.message
            }))
          );
        } catch (loadError) {
          const message =
            loadError instanceof Error ? loadError.message : "Failed to load restaurant data.";
          try {
            const fallback = await loadStaticRestaurants(lang);
            const filtered = filterRestaurants({
              data: fallback,
              queryText,
              township,
              signatureDish
            });
            const total = filtered.length;
            const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
            const currentPage = Math.min(page, pages);
            const offset = (currentPage - 1) * PAGE_SIZE;

            setRestaurants(filtered.slice(offset, offset + PAGE_SIZE));
            setTotalPages(pages);
            setTotalCount(total);
            setProviderErrors([]);
            setError(null);
            if (currentPage !== page) {
              setPage(currentPage);
            }
          } catch {
            setError(message);
            setRestaurants([]);
            setTotalPages(1);
            setTotalCount(0);
            setProviderErrors([]);
          }
        } finally {
          setLoading(false);
        }
      }

      loadRestaurants();
    }, 300);

    return () => clearTimeout(timeout);
  }, [lang, page, search, township, signatureDish]);

  const pageLabel = useMemo(
    () =>
      lang === "my"
        ? `စာမျက်နှာ ${page} / ${Math.max(totalPages, 1)}`
        : `Page ${page} of ${Math.max(totalPages, 1)}`,
    [lang, page, totalPages]
  );

  return (
    <div className="min-h-screen bg-sky-100 text-gray-700">
      <header className="border-b border-gray-200 bg-white/90 backdrop-blur">
        <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-sm font-semibold uppercase tracking-wider text-emerald-600">Created by Han Thar</p>
              <h1 className="mt-1 text-3xl font-bold tracking-tight text-gray-800">{t.title}</h1>
            </div>
            <button
              type="button"
              onClick={() => setLang((prev) => (prev === "en" ? "my" : "en"))}
              className="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50"
              aria-label={t.language}
            >
              <span aria-hidden="true">🌐</span>
              <span>{lang === "en" ? "EN" : "မြန်မာ"}</span>
            </button>
          </div>
          <p className="mt-2 max-w-3xl text-sm text-gray-600">
            {t.subtitle}
          </p>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-6 pb-24 sm:px-6 md:pb-6 lg:px-8">
        <section className="sticky top-2 z-20 mb-6 rounded-2xl bg-white p-4 shadow-soft">
          <div className="grid gap-3 md:grid-cols-2">
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-gray-600">{t.search}</span>
              <input
                type="text"
                value={search}
                onChange={(event) => {
                  setSearch(event.target.value);
                  setPage(1);
                }}
                placeholder={t.searchPlaceholder}
                className="w-full rounded-xl border border-gray-300 px-3 py-3 text-base outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100 md:py-2 md:text-sm"
              />
            </label>

            <label className="block">
              <span className="mb-1 block text-xs font-medium text-gray-600">{t.township}</span>
              <select
                value={township}
                onChange={(event) => {
                  setTownship(event.target.value);
                  setPage(1);
                }}
                className="w-full rounded-xl border border-gray-300 px-3 py-3 text-base outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100 md:py-2 md:text-sm"
              >
                <option value="all">{t.allTownships}</option>
                {townships.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>
            </label>

          </div>

          <div className="mt-3 grid gap-3 md:grid-cols-2">
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-gray-600">{t.signatureDish}</span>
              <input
                type="text"
                value={signatureDish}
                onChange={(event) => {
                  setSignatureDish(event.target.value);
                  setPage(1);
                }}
                placeholder={t.signatureDishPlaceholder}
                className="w-full rounded-xl border border-gray-300 px-3 py-3 text-base outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100 md:py-2 md:text-sm"
              />
            </label>
          </div>
        </section>

        {providerErrors.length > 0 ? (
          <p className="mb-4 rounded-xl border border-amber-300 bg-amber-50 p-3 text-xs text-amber-700">
            {t.partialResults}: {providerErrors.map((item) => `${item.source}: ${item.message}`).join(" | ")}
          </p>
        ) : null}

        {error ? (
          <p className="mb-4 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">{error}</p>
        ) : null}

        <div className="mb-4 hidden flex-wrap items-center justify-between gap-3 text-sm text-gray-600 md:flex">
          <p>
            {loading ? t.loadingRestaurants : `${totalCount.toLocaleString()} ${t.restaurantsFound}`}
          </p>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setPage((prev) => Math.max(1, prev - 1))}
              disabled={page <= 1 || loading}
              className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {t.previous}
            </button>
            <span className="rounded-lg bg-gray-200 px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-gray-700">
              {pageLabel}
            </span>
            <button
              type="button"
              onClick={() => setPage((prev) => Math.min(totalPages, prev + 1))}
              disabled={page >= totalPages || loading}
              className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {t.next}
            </button>
          </div>
        </div>

        <section className="grid gap-6 lg:grid-cols-2">
          {restaurants.map((restaurant) => (
            <article key={`${restaurant.source}-${restaurant.id}`} className="overflow-hidden rounded-2xl bg-white shadow-soft">
              <div className="space-y-4 p-4">
                <div>
                  <h2 className="text-xl font-semibold text-gray-800">{restaurant.name}</h2>
                  <p className="text-sm text-gray-600">
                    {restaurant.location.address || t.addressNotAvailable}
                  </p>
                </div>

                <div className="grid gap-2 rounded-xl bg-gray-50 p-3 text-sm">
                  <p>
                    <span className="font-semibold text-gray-700">{t.townshipLabel}:</span>{" "}
                    {restaurant.location.township || t.unknown}
                  </p>
                  <p>
                    <span className="font-semibold text-gray-700">{t.openingHoursLabel}:</span>{" "}
                    {restaurant.hours || t.notAvailable}
                  </p>
                  <p>
                    <span className="font-semibold text-gray-700">{t.phoneLabel}:</span>{" "}
                    {restaurant.phone || t.notAvailable}
                  </p>
                </div>

                <div>
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">
                    {t.availableFoodDishes}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {(restaurant.dishes.length > 0 ? restaurant.dishes : [t.notListed]).map((dish) => (
                      <span
                        key={dish}
                        className="rounded-full border border-gray-200 bg-white px-2.5 py-1 text-xs text-gray-700"
                      >
                        {dish}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </article>
          ))}
        </section>

        {!loading && restaurants.length === 0 ? (
          <p className="mt-8 rounded-xl bg-white p-4 text-center text-sm text-gray-600 shadow-soft">
            {t.noMatches}
          </p>
        ) : null}

        <div className="fixed inset-x-0 bottom-0 z-30 border-t border-gray-200 bg-white/95 p-3 backdrop-blur md:hidden">
          <div className="mx-auto flex max-w-7xl items-center justify-between gap-2">
            <button
              type="button"
              onClick={() => setPage((prev) => Math.max(1, prev - 1))}
              disabled={page <= 1 || loading}
              className="min-h-11 flex-1 rounded-lg border border-gray-300 bg-white px-4 py-2 text-base font-medium text-gray-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {t.previous}
            </button>
            <span className="rounded-lg bg-gray-200 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-gray-700">
              {pageLabel}
            </span>
            <button
              type="button"
              onClick={() => setPage((prev) => Math.min(totalPages, prev + 1))}
              disabled={page >= totalPages || loading}
              className="min-h-11 flex-1 rounded-lg border border-gray-300 bg-white px-4 py-2 text-base font-medium text-gray-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {t.next}
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}

export default App;
