const ORIGIN = "https://fragrant-flower-64d1.analiamcg.workers.dev";
const TYPES = ["rosario","adoracion","misa_dominical","misa_alianza","ermita","otros"];

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "content-type": "application/json; charset=UTF-8",
      "cache-control": "no-store"
    }
  });
}

async function stats(env) {
  const rows = await env.DB.prepare(
    "SELECT type, COUNT(*) AS count FROM offerings GROUP BY type"
  ).all();

  const result = Object.fromEntries(TYPES.map(type => [type, 0]));

  for (const row of rows.results || []) {
    if (TYPES.includes(row.type)) result[row.type] = Number(row.count);
  }

  return result;
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === "/api/health") {
      return json({ ok: true, app: "Conquista de la Cruz de la Unidad" });
    }

    if (url.pathname === "/api/stats" && request.method === "GET") {
      try {
        return json(await stats(env));
      } catch (error) {
        console.error(error);
        return json({ error: "No se pudieron leer los contadores" }, 500);
      }
    }

    if (url.pathname === "/api/offer" && request.method === "POST") {
      try {
        const body = await request.json();
        const type = String(body.type || "");

        if (!TYPES.includes(type)) {
          return json({ error: "Tipo de ofrenda inválido" }, 400);
        }

        await env.DB.prepare(
          "INSERT INTO offerings(type) VALUES(?)"
        ).bind(type).run();

        return json(await stats(env));
      } catch (error) {
        console.error(error);
        return json({ error: "No se pudo registrar la ofrenda" }, 500);
      }
    }

    return fetch(new Request(
      new URL(url.pathname + url.search, ORIGIN),
      request
    ));
  }
};
