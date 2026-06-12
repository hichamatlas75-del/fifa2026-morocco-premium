export async function onRequest(context) {
  const url = "https://api.openligadb.de/getmatchdata/wm26/2026";

  // Cache API de Cloudflare pour ne pas saturer la clé (max 12 req/min)
  const cacheKey = new Request(context.request.url, context.request);
  const cache = caches.default;
  let response = await cache.match(cacheKey);

  if (!response) {
    try {
      const apiResponse = await fetch(url, {
        headers: { 
          "Accept": "application/json"
        }
      });

      if (!apiResponse.ok) {
        throw new Error(`API returned status ${apiResponse.status}`);
      }

      const data = await apiResponse.json();

      response = new Response(JSON.stringify(data), {
        headers: {
          "Content-Type": "application/json; charset=utf-8",
          "Access-Control-Allow-Origin": "*",
          "Cache-Control": "public, max-age=30" // Mise en cache de 30 secondes pour tous les clients
        }
      });

      // Stocker dans le cache pour 30 secondes
      context.waitUntil(cache.put(cacheKey, response.clone()));
    } catch (error) {
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: { "Content-Type": "application/json" }
      });
    }
  }

  return response;
}
