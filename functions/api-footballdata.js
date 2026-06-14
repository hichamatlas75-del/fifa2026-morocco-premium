export async function onRequest(context) {
  const token = context.env.FOOTBALL_DATA_API_TOKEN;
  const url = "https://api.football-data.org/v4/competitions/WC/matches";

  if (!token) {
    return new Response(JSON.stringify({ error: "Jeton FOOTBALL_DATA_API_TOKEN manquant dans l'environnement du Worker." }), {
      status: 401,
      headers: { "Content-Type": "application/json; charset=utf-8", "Access-Control-Allow-Origin": "*" }
    });
  }

  // Utilisation du cache de Cloudflare pour ne pas saturer l'API gratuite (limite de 10 req/min)
  const cacheKey = new Request(context.request.url, context.request);
  const cache = caches.default;
  let response = await cache.match(cacheKey);

  if (!response) {
    try {
      const apiResponse = await fetch(url, {
        headers: { 
          "X-Auth-Token": token,
          "Authorization": `Bearer ${token}`,
          "Accept": "application/json"
        }
      });

      if (!apiResponse.ok) {
        throw new Error(`L'API Football-Data a renvoyé un statut ${apiResponse.status}`);
      }

      const data = await apiResponse.json();

      response = new Response(JSON.stringify(data), {
        headers: {
          "Content-Type": "application/json; charset=utf-8",
          "Access-Control-Allow-Origin": "*",
          "Cache-Control": "public, max-age=60" // Mise en cache d'une minute pour respecter le free tier
        }
      });

      // Mettre en cache pour 1 minute
      context.waitUntil(cache.put(cacheKey, response.clone()));
    } catch (error) {
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: { 
          "Content-Type": "application/json; charset=utf-8",
          "Access-Control-Allow-Origin": "*"
        }
      });
    }
  }

  return response;
}
