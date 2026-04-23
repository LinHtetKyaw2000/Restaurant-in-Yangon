import { HttpError } from "./errors.js";

export async function fetchJson(url, options = {}, timeoutMs = 10000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal
    });

    if (!response.ok) {
      const body = await response.text();
      throw new HttpError(response.status, `Request failed: ${response.statusText}`, {
        url,
        body
      });
    }

    return await response.json();
  } catch (error) {
    if (error.name === "AbortError") {
      throw new HttpError(504, "Request timed out", { url });
    }
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

export function normalizePriceRange(value) {
  if (typeof value === "string") {
    if (value.includes("$$$")) return "$$$";
    if (value.includes("$$")) return "$$";
    if (value.includes("$")) return "$";
  }
  if (typeof value === "number") {
    if (value >= 3) return "$$$";
    if (value === 2) return "$$";
    if (value === 1) return "$";
  }
  return null;
}

export function pickArray(value) {
  return Array.isArray(value) ? value : [];
}
