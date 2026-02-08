const API_BASE = "/api";
export async function searchProducts(query) {
  if (!query.trim()) return [];

  const res = await fetch(
    `${API_BASE}/search-product?q=${encodeURIComponent(query)}`
  );

  const data = await res.json();
  return data.ids || [];
}
