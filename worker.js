const ORIGIN = "https://fragrant-flower-64d1.analiamcg.workers.dev";

const TYPES = [
  "rosario",
  "adoracion",
  "misa_dominical",
  "misa_alianza",
  "ermita",
  "otros"
];

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "content-type": "application/json; charset=UTF-8",
      "cache-control": "no-store"
    }
  });
}

async function getStats(env) {
  const rows = await env.DB
    .prepare("SELECT type, COUNT(*) AS count FROM offerings GROUP BY type")
    .all();

  const stats = Object.fromEntries(
    TYPES.map(type => [type, 0])
  );

  for (const row of rows.results || []) {
    if (TYPES.includes(row.type)) {
      stats[row.type] = Number(row.count);
    }
  }

  return stats;
}

const APP_JS = `
const types = [
  "rosario",
  "adoracion",
  "misa_dominical",
  "misa_alianza",
  "ermita",
  "otros"
];

const state = Object.fromEntries(
  types.map(type => [type, 0])
);

const totalEl = document.getElementById("total");
const thankyou = document.getElementById("thankyou");

function render() {
  document.querySelectorAll(".offering").forEach(btn => {
    const value = state[btn.dataset.type] || 0;
    const counter = btn.querySelector("b");

    if (counter) {
      counter.textContent = value;
    }
  });

  if (totalEl) {
    totalEl.textContent = Object.values(state)
      .reduce((a, b) => a + b, 0);
  }
}

async function loadStats() {
  try {
    const response = await fetch("/api/stats", {
      cache: "no-store"
    });

    if (!response.ok) {
      throw new Error("No se pudieron cargar los contadores");
    }

    const data = await response.json();

    for (const type of types) {
      state[type] = Number(data[type] || 0);
    }

    render();
  } catch (error) {
    console.error(error);
  }
}

async function celebrate(type) {
  try {
    const response = await fetch("/api/offer", {
      method: "POST",
      headers: {
        "content-type": "application/json"
      },
      body: JSON.stringify({ type })
    });

    if (!response.ok) {
      throw new Error("No se pudo registrar la ofrenda");
    }

    const data = await response.json();

    for (const item of types) {
      state[item] = Number(data[item] || 0);
    }

    render();

    if (thankyou) {
      thankyou.classList.add("show");
      thankyou.setAttribute("aria-hidden", "false");
    }

  } catch (error) {
    console.error(error);
    alert(
      "No pudimos registrar la ofrenda. Por favor, intentá nuevamente."
    );
  }
}

document.querySelectorAll(".offering").forEach(btn => {
  btn.addEventListener("click", () => {
    celebrate(btn.dataset.type);
  });
});

const back = document.getElementById("back");

if (back) {
  back.addEventListener("click", () => {
    thankyou.classList.remove("show");
    thankyou.setAttribute("aria-hidden", "true");
  });
}

render();
loadStats();
`;

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === "/api/health") {
      return json({
        ok: true,
        app: "Conquista de la Cruz de la Unidad"
      });
    }

    if (url.pathname === "/api/stats" && request.method === "GET") {
      if (!env.DB) {
        return json(
          { error: "Base de datos no conectada" },
          503
        );
      }

      try {
        const stats = await getStats(env);
        return json(stats);
      } catch (error) {
        console.error(error);

        return json(
          { error: "No se pudieron leer los contadores" },
          500
        );
      }
    }

    if (url.pathname === "/api/offer" && request.method === "POST") {
      if (!env.DB) {
        return json(
          { error: "Base de datos no conectada" },
          503
        );
      }

      try {
        const body = await request.json();
        const type = String(body.type || "");

        if (!TYPES.includes(type)) {
          return json(
            { error: "Tipo de ofrenda inválido" },
            400
          );
        }

        await env.DB
          .prepare(
            "INSERT INTO offerings(type) VALUES(?)"
          )
          .bind(type)
          .run();

        const stats = await getStats(env);

        return json(stats);

      } catch (error) {
        console.error(error);

        return json(
          { error: "No se pudo registrar la ofrenda" },
          500
        );
      }
    }

    if (url.pathname === "/app.js") {
      return new Response(APP_JS, {
        headers: {
          "content-type": "application/javascript; charset=UTF-8",
          "cache-control": "no-store"
        }
      });
    }

    const target = new URL(
  url.pathname + url.search,
  ORIGIN
);

return fetch(new Request(target, request));
  }
};
