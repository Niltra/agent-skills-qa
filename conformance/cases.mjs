/**
 * Banco de conformidad: cada caso es una pagina con un unico defecto conocido
 * y un resultado esperado escrito de antemano. Si el motor se desvia, el caso falla.
 */

const css = `<style>
  body { margin: 0; padding: 20px; font: 16px/1.6 "Segoe UI", system-ui, sans-serif; background: #fff; }
  p { margin: 0 0 16px; }
</style>`;

// ---------- contraste-real ----------

const cPage = (body) => `<!doctype html><html lang="es"><head><meta charset="utf-8">${css}</head><body>${body}</body></html>`;

const contraste = [
  {
    name: "c-21",
    tool: "contraste-real",
    html: cPage(`<p style="color:#000000">Negro sobre blanco</p>`),
    args: [],
    expect: { exit: 0, has: ["0 por debajo", "1 textos medidos"], hasNot: ["fallo:"] },
  },
  {
    name: "c-454-pasa",
    tool: "contraste-real",
    html: cPage(`<p style="color:#767676">Gris 767676</p>`),
    args: [],
    expect: { exit: 0, has: ["0 por debajo"], hasNot: ["fallo:"] },
  },
  {
    name: "c-449-falla",
    tool: "contraste-real",
    html: cPage(`<p style="color:#777777">Gris 777777</p>`),
    args: [],
    expect: { exit: 1, has: ["4.48", "fallo:"] },
  },
  {
    name: "c-grande-pasa-aa",
    tool: "contraste-real",
    html: cPage(`<p style="color:#949494;font-size:30px">Titular grande</p>`),
    args: [],
    expect: { exit: 0, has: ["0 por debajo"], hasNot: ["fallo:"] },
  },
  {
    name: "c-grande-falla-aaa",
    tool: "contraste-real",
    html: cPage(`<p style="color:#949494;font-size:30px">Titular grande</p>`),
    args: ["--level", "AAA"],
    expect: { exit: 1, has: ["3.03", "fallo:"] },
  },
  {
    name: "c-sobre-degradado",
    tool: "contraste-real",
    html: cPage(`<div style="background:linear-gradient(180deg,#111,#222);padding:40px"><p style="color:#fff">Blanco sobre oscuro</p></div>`),
    args: [],
    expect: { exit: 0, has: ["0 por debajo"], hasNot: ["fallo:"] },
  },
  {
    name: "c-texto-degradado-se-ignora",
    tool: "contraste-real",
    html: cPage(`<p style="color:#000">Normal</p><p style="background:linear-gradient(90deg,#f00,#00f);-webkit-background-clip:text;background-clip:text;color:transparent;-webkit-text-fill-color:transparent">Degradado</p>`),
    args: [],
    expect: { exit: 0, has: ["1 textos medidos"], hasNot: ["fallo:"] },
  },
  {
    name: "c-blend-se-ignora",
    tool: "contraste-real",
    html: cPage(`<p style="color:#000">Normal</p><p style="color:#000;mix-blend-mode:multiply">Mezclado</p>`),
    args: [],
    expect: { exit: 0, has: ["1 textos medidos"], hasNot: ["fallo:"] },
  },
  {
    name: "c-opacidad-se-ignora",
    tool: "contraste-real",
    html: cPage(`<p style="color:#000">Normal</p><p style="color:#000;opacity:0.5">Translucido</p>`),
    args: [],
    expect: { exit: 0, has: ["1 textos medidos"], hasNot: ["fallo:"] },
  },
  {
    name: "c-sr-only-se-ignora",
    tool: "contraste-real",
    html: cPage(`<p style="color:#000">Normal</p><span style="position:absolute;width:1px;height:1px;overflow:hidden;color:#fff">Solo lectores</span>`),
    args: [],
    expect: { exit: 0, has: ["1 textos medidos"], hasNot: ["fallo:"] },
  },
  {
    name: "c-texto-invisible",
    tool: "contraste-real",
    html: cPage(`<p style="color:#111111;background:#111111">Mismo color que el fondo</p>`),
    args: [],
    expect: { exit: 1, has: ["texto invisible", "fallo:"] },
  },
  {
    name: "c-canvas",
    tool: "contraste-real",
    html: `<!doctype html><html lang="es"><head><meta charset="utf-8"><style>html,body{margin:0;height:100%}</style></head><body><canvas id="gl" width="1280" height="900" style="width:100vw;height:100vh;display:block;background:#000"></canvas></body></html>`,
    args: [],
    expect: { exit: 2, has: ["canvas"], hasNot: ["ok:"] },
  },
  {
    name: "c-scroll-revela-texto",
    tool: "contraste-real",
    html: `<!doctype html><html lang="es"><head><meta charset="utf-8"></head><body>
<div style="height:3000px"></div>
<p id="oculto" style="visibility:hidden;color:#000">Aparece al hacer scroll</p>
<script>
  new IntersectionObserver((entries) => {
    for (const e of entries) if (e.isIntersecting) document.getElementById("oculto").style.visibility = "visible";
  }).observe(document.getElementById("oculto"));
</script>
</body></html>`,
    args: [],
    expect: { exit: 0, has: ["1 textos medidos"], hasNot: ["fallo:"] },
  },
  {
    name: "c-alfa",
    tool: "contraste-real",
    html: cPage(`<p style="color:rgba(0,0,0,0.35)">Texto con alfa</p>`),
    args: [],
    expect: { exit: 1, has: ["2.4", "fallo:"] },
  },
  {
    name: "c-solo-degradado",
    tool: "contraste-real",
    html: cPage(`<p style="background:linear-gradient(90deg,#f00,#00f);-webkit-background-clip:text;background-clip:text;color:transparent;-webkit-text-fill-color:transparent">Solo degradado</p>`),
    args: [],
    expect: { exit: 2, has: ["0 medidos no es todo correcto"], hasNot: ["ok:"] },
  },
  {
    name: "c-sin-texto",
    tool: "contraste-real",
    html: cPage(`<div style="width:200px;height:80px;background:#eee"></div>`),
    args: [],
    expect: { exit: 0, has: ["0 textos medidos"], hasNot: ["fallo:"] },
  },
];

// ---------- rompelayout ----------

const page = (text, { ellipsis = false, extra = "" } = {}) => `<!doctype html><html lang="es"><head><meta charset="utf-8">
<style>
  body { margin: 20px; font: 16px/1.5 "Segoe UI", system-ui, sans-serif; }
  .caja { width: 140px; overflow: hidden; white-space: nowrap; border: 1px solid #ccc; ${ellipsis ? "text-overflow: ellipsis;" : ""} }
</style></head><body>
<div class="caja"><span>${text}</span></div>
${extra}
</body></html>`;

const pageVW = (text) => `<!doctype html><html lang="es"><head><meta charset="utf-8">
<style>
  body { margin: 20px; font: 16px/1.5 "Segoe UI", system-ui, sans-serif; }
  .caja { width: 60vw; overflow: hidden; white-space: nowrap; border: 1px solid #ccc; }
</style></head><body>
<div class="caja"><span>${text}</span></div>
</body></html>`;

const rompelayout = [
  {
    name: "r-solo-aleman",
    tool: "rompelayout",
    files: { "es.html": page("Corto"), "de.html": page("Bundesausbildungsförderungsgesetz") },
    args: ["--locales", "es,de"],
    expect: { exit: 1, has: ["de\\s+1", "fallo:"], hasNot: [] },
  },
  {
    name: "r-mismo-fallo",
    tool: "rompelayout",
    files: { "es.html": page("Titular demasiado largo"), "de.html": page("Überschrift viel zu lang") },
    args: ["--locales", "es,de"],
    expect: { exit: 0, has: ["ya existen en es"], hasNot: ["fallo:"] },
  },
  {
    name: "r-base-roto-hijo-limpio",
    tool: "rompelayout",
    files: { "es.html": page("Titular demasiado largo"), "de.html": page("Kurz") },
    args: ["--locales", "es,de"],
    expect: { exit: 0, has: ["ya existen en es"], hasNot: ["fallo:"] },
  },
  {
    name: "r-ellipsis-es-revisar",
    tool: "rompelayout",
    files: { "es.html": page("Corto"), "de.html": page("Bundesausbildungsförderungsgesetz", { ellipsis: true }) },
    args: ["--locales", "es,de"],
    expect: { exit: 0, has: ["1 recortes con ellipsis"], hasNot: ["fallo:"] },
  },
  {
    name: "r-svg-se-ignora",
    tool: "rompelayout",
    files: {
      "es.html": page("Corto"),
      "de.html": page("Corto", { extra: `<svg width="100" height="40"><text x="0" y="20" style="font-size:20px">Bundesausbildungsförderungsgesetz</text></svg>` }),
    },
    args: ["--locales", "es,de"],
    expect: { exit: 0, has: ["0\\s+0", "ok:"], hasNot: ["fallo:"] },
  },
  {
    name: "r-scroll-revela",
    tool: "rompelayout",
    files: {
      "es.html": `<!doctype html><html lang="es"><head><meta charset="utf-8"><style>
        body{margin:20px;font:20px/1.5 "Segoe UI",sans-serif}
        .caja{width:140px;overflow:hidden;white-space:nowrap;border:1px solid #ccc;visibility:hidden}
      </style></head><body>
      <div style="height:3000px"></div>
      <div class="caja" id="tarde"><span>iii</span></div>
      <script>new IntersectionObserver((es)=>{for(const e of es) if(e.isIntersecting) document.getElementById("tarde").style.visibility="visible"}).observe(document.getElementById("tarde"))</script>
      </body></html>`,
      "de.html": `<!doctype html><html lang="de"><head><meta charset="utf-8"><style>
        body{margin:20px;font:20px/1.5 "Segoe UI",sans-serif}
        .caja{width:140px;overflow:hidden;white-space:nowrap;border:1px solid #ccc;visibility:hidden}
      </style></head><body>
      <div style="height:3000px"></div>
      <div class="caja" id="tarde"><span>WWWWWWWWWWWWWWWW</span></div>
      <script>new IntersectionObserver((es)=>{for(const e of es) if(e.isIntersecting) document.getElementById("tarde").style.visibility="visible"}).observe(document.getElementById("tarde"))</script>
      </body></html>`,
    },
    args: ["--locales", "es,de"],
    expect: { exit: 1, has: ["de\\s+1", "fallo:"], hasNot: [] },
  },
  {
    name: "r-ancestro-recorta",
    tool: "rompelayout",
    files: {
      "es.html": `<!doctype html><html lang="es"><head><meta charset="utf-8"><style>
        body{margin:20px;font:18px/1.5 "Segoe UI",sans-serif}
        .card{width:160px;overflow:hidden;padding:8px}
        .card p{white-space:nowrap;margin:0}
      </style></head><body>
      <div class="card"><p>Kurz</p></div>
      </body></html>`,
      "de.html": `<!doctype html><html lang="de"><head><meta charset="utf-8"><style>
        body{margin:20px;font:18px/1.5 "Segoe UI",sans-serif}
        .card{width:160px;overflow:hidden;padding:8px}
        .card p{white-space:nowrap;margin:0}
      </style></head><body>
      <div class="card"><p>Geschwindigkeitsbegrenzung auf der Autobahn</p></div>
      </body></html>`,
    },
    args: ["--locales", "es,de"],
    expect: { exit: 1, has: ["clipped", "fallo:"] },
  },
  {
    name: "r-ancho-1280",
    tool: "rompelayout",
    files: { "es.html": pageVW("Corto"), "de.html": pageVW("Bundesausbildungsförderungsgesetz") },
    args: ["--locales", "es,de"],
    expect: { exit: 0, has: ["ok:"], hasNot: ["fallo:"] },
  },
  {
    name: "r-ancho-375",
    tool: "rompelayout",
    files: { "es.html": pageVW("Corto"), "de.html": pageVW("Bundesausbildungsförderungsgesetz") },
    args: ["--locales", "es,de", "--width", "375"],
    expect: { exit: 1, has: ["fallo:"], hasNot: [] },
  },
  {
    name: "r-sin-texto",
    tool: "rompelayout",
    files: { "es.html": page(""), "de.html": page("") },
    args: ["--locales", "es,de"],
    expect: { exit: 0, has: ["ok:"], hasNot: ["fallo:"] },
  },
];

// ---------- formulario-que-no-miente ----------

const form = ({ label = true, autocomplete = true, validate = true, aria = true, guard = true, live = "aria-live" } = {}) => `<!doctype html>
<html lang="es"><head><meta charset="utf-8">
<style>body{font:16px/1.6 "Segoe UI",sans-serif;max-width:480px;margin:40px auto}label{display:block;margin-top:12px;font-size:14px}input{width:100%;padding:8px;margin-top:4px}.error{color:#b3261e;font-size:13px;min-height:16px}</style>
</head><body>
<form id="f" novalidate>
  ${label ? '<label for="nombre">Nombre</label>' : ""}
  <input id="nombre" name="nombre" placeholder="Tu nombre" ${autocomplete ? 'autocomplete="name"' : ""} ${aria ? 'aria-describedby="e1"' : ""}>
  <p class="error" id="e1"></p>

  <label for="email">Email</label>
  <input id="email" name="email" type="email" ${autocomplete ? 'autocomplete="email"' : ""} ${aria ? 'aria-describedby="e2"' : ""}>
  <p class="error" id="e2"></p>

  <label for="tel">Teléfono</label>
  <input id="tel" name="tel" type="tel" ${autocomplete ? 'autocomplete="tel"' : ""} ${aria ? 'aria-describedby="e3"' : ""}>
  <p class="error" id="e3"></p>

  ${aria ? `<div id="live" ${live === "role" ? 'role="status"' : 'aria-live="polite"'}></div>` : ""}
  <button type="submit">Enviar</button>
</form>
<script>
  const form = document.getElementById("f");
  const errs = { nombre: "e1", email: "e2", tel: "e3" };
  const inputs = [...form.querySelectorAll("input")];
  let sending = false;
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    ${guard ? "if (sending) return;" : ""}
    ${validate ? `
    let first = null;
    for (const el of inputs) {
      const v = el.value.trim();
      let msg = "";
      if (!v) msg = "Obligatorio";
      else if (el.type === "email" && !/^[^@\\s]+@[^@\\s]+\\.[^@\\s]+$/.test(v)) msg = "Email no valido";
      ${aria ? 'el.setAttribute("aria-invalid", msg ? "true" : "false");' : ""}
      document.getElementById(errs[el.name]).textContent = msg;
      if (msg && !first) first = el;
    }
    ${aria ? 'document.getElementById("live").textContent = first ? "Revisa los campos" : "";' : ""}
    if (first) { first.focus(); return; }
    ` : ""}
    ${guard ? "sending = true; form.querySelector('button').disabled = true;" : ""}
    await fetch("https://example.com/api/enviar", { method: "POST", body: "{}" });
    ${guard ? "sending = false; form.querySelector('button').disabled = false;" : ""}
  });
</script>
</body></html>`;

const formulario = [
  {
    name: "f-bueno",
    tool: "formulario-que-no-miente",
    html: form(),
    args: [],
    expect: { exit: 0, has: ["7 de 7"], hasNot: ["FALLO"] },
  },
  {
    name: "f-sin-label",
    tool: "formulario-que-no-miente",
    html: form({ label: false }),
    args: [],
    expect: { exit: 1, has: ["FALLO  nombre accesible"], hasNot: ["FALLO  envío vacío"] },
  },
  {
    name: "f-sin-autocomplete",
    tool: "formulario-que-no-miente",
    html: form({ autocomplete: false }),
    args: [],
    expect: { exit: 1, has: ["FALLO  autocompletado"], hasNot: ["FALLO  envío vacío"] },
  },
  {
    name: "f-sin-aria",
    tool: "formulario-que-no-miente",
    html: form({ aria: false }),
    args: [],
    expect: { exit: 1, has: ["FALLO  error anunciado"], hasNot: ["FALLO  envío vacío"] },
  },
  {
    name: "f-doble-envio",
    tool: "formulario-que-no-miente",
    html: form({ guard: false }),
    args: [],
    expect: { exit: 1, has: ["FALLO  doble envío"], hasNot: ["FALLO  envío vacío"] },
  },
  {
    name: "f-envia-vacio",
    tool: "formulario-que-no-miente",
    html: form({ validate: false, aria: false }),
    args: [],
    expect: { exit: 1, has: ["FALLO  envío vacío"], hasNot: [] },
  },
  {
    name: "f-get",
    tool: "formulario-que-no-miente",
    html: `<!doctype html><html lang="es"><head><meta charset="utf-8"></head><body>
<form method="get" action="/captura" novalidate>
  <label for="e">Email</label>
  <input id="e" name="email" type="email" autocomplete="email">
  <button type="submit">Enviar</button>
</form>
</body></html>`,
    args: [],
    expect: { exit: 1, has: ["FALLO  envío vacío bloqueado"], hasNot: [] },
  },
  {
    name: "f-select-vacio",
    tool: "formulario-que-no-miente",
    html: `<!doctype html><html lang="es"><head><meta charset="utf-8"></head><body>
<form id="f" novalidate>
  <label for="p">País</label>
  <select id="p" name="pais" autocomplete="country"><option value="">Elige</option><option value="es">España</option></select>
  <label for="e"></label>
  <input id="e" name="email" aria-label="Email" type="email" autocomplete="email">
  <button type="submit">Enviar</button>
</form>
<script>
  document.getElementById("f").addEventListener("submit", (e) => {
    e.preventDefault();
    const ok = [...document.querySelectorAll("select, input")].every((el) => el.value.trim());
    if (ok) fetch("/x", { method: "POST" });
  });
</script>
</body></html>`,
    args: [],
    expect: { exit: 1, has: ["OK     envío vacío bloqueado", "OK     nombre accesible"], hasNot: ["FALLO  envío vacío", "FALLO  nombre accesible"] },
  },
  {
    name: "f-shadow",
    tool: "formulario-que-no-miente",
    html: `<!doctype html><html lang="es"><head><meta charset="utf-8"></head><body>
<div id="host"></div>
<script>
  const root = document.getElementById("host").attachShadow({ mode: "open" });
  root.innerHTML = '<form id="f" novalidate><label for="e">Email</label><input id="e" name="email" type="email" autocomplete="email"><button type="submit">Enviar</button></form>';
  root.getElementById("f").addEventListener("submit", (e) => { e.preventDefault(); });
</script>
</body></html>`,
    args: [],
    expect: { exit: 1, has: ["nombre accesible"], hasNot: ["no se encontraron campos"] },
  },
  {
    name: "f-role-status",
    tool: "formulario-que-no-miente",
    html: form({ live: "role" }),
    args: [],
    expect: { exit: 0, has: ["7 de 7"], hasNot: ["FALLO"] },
  },
  {
    name: "f-contenteditable",
    tool: "formulario-que-no-miente",
    html: `<!doctype html><html lang="es"><head><meta charset="utf-8"></head><body>
<form id="f" novalidate>
  <label for="email">Email</label>
  <input id="email" name="email" type="email" autocomplete="email">
  <label>Nombre</label>
  <div contenteditable="true" aria-label="Nombre"></div>
  <button type="submit">Enviar</button>
</form>
</body></html>`,
    args: [],
    expect: { exit: 1, has: ["2 campos"], hasNot: ["1 campos"] },
  },
  {
    name: "f-fetch-get",
    tool: "formulario-que-no-miente",
    html: `<!doctype html><html lang="es"><head><meta charset="utf-8"></head><body>
<form id="f" novalidate>
  <label for="e">Email</label>
  <input id="e" name="email" type="email" autocomplete="email">
  <button type="submit">Enviar</button>
</form>
<script>
  document.getElementById("f").addEventListener("submit", (e) => {
    e.preventDefault();
    fetch("https://example.com/colectar?email=" + encodeURIComponent(document.getElementById("e").value));
  });
</script>
</body></html>`,
    args: [],
    expect: { exit: 1, has: ["FALLO  envío vacío bloqueado", "1 peticiones"] },
  },
  {
    name: "f-sin-campos",
    tool: "formulario-que-no-miente",
    html: `<!doctype html><html><body><form><p>Sin campos</p><button>Enviar</button></form></body></html>`,
    args: [],
    expect: { exit: 2, has: [], hasNot: [] },
  },
];

// ---------- lector-de-pantalla ----------

const lPage = (body, lang = "es") => `<!doctype html><html lang="${lang}"><head><meta charset="utf-8"></head><body>${body}</body></html>`;

const INGLES = `The application lets a team create invoices, collect payments and reconcile the month without exporting anything by hand. The administration team can review every payment from a single panel, and the sales team checks the status of each customer when it needs to with a search by name or by invoice number. The reports are generated every morning and are sent to the address that the user configures. If a payment fails, the application shows a notice in the panel and sends an email, and it keeps the attempt recorded so that it can be reviewed later with the rest of the history of that customer and that invoice.`;

const lector = [
  {
    name: "l-bueno",
    tool: "lector-de-pantalla",
    html: lPage(`<h1>Facturas</h1><p>Texto normal.</p><img src="a.png" alt="Panel con tres pagos"><a href="/d">Leer la documentación</a>`),
    args: [],
    expect: { exit: 0, has: ["nombre útil"], hasNot: ["RUIDO"] },
  },
  {
    name: "l-alt-fichero",
    tool: "lector-de-pantalla",
    html: lPage(`<h1>Tienda</h1><img src="a.png" alt="hero-final-2.jpg">`),
    args: [],
    expect: { exit: 1, has: ["alt = nombre del fichero"] },
  },
  {
    name: "l-enlace-generico",
    tool: "lector-de-pantalla",
    html: lPage(`<h1>Tienda</h1><a href="/a">leer más</a>`),
    args: [],
    expect: { exit: 1, has: ["enlace sin nombre útil"] },
  },
  {
    name: "l-repetido",
    tool: "lector-de-pantalla",
    html: lPage(`<h1>Tienda</h1><img src="a.png" alt="Producto"><img src="b.png" alt="Producto"><img src="c.png" alt="Producto">`),
    args: [],
    expect: { exit: 1, has: ["texto repetido"] },
  },
  {
    name: "l-idioma",
    tool: "lector-de-pantalla",
    html: lPage(`<h1>Invoices</h1><p>${INGLES}</p>`, "es"),
    args: [],
    expect: { exit: 1, has: ["idioma declarado incorrecto", "parece en"] },
  },
  {
    name: "l-dificil",
    tool: "lector-de-pantalla",
    html: `<!doctype html><html lang="es" dir="rtl"><head><meta charset="utf-8"></head><body>
<h1>Casos raros</h1>
<img src="a.png" alt='Foto "destacada" del producto'>
<img src="b.png" alt="Ruta C:\\temp\\foto">
<img src="c.png" alt="${"Descripción muy larga ".repeat(8)}">
<button aria-label='Cerrar "ventana"'></button>
<div id="host"></div>
<script>
  const root = document.getElementById("host").attachShadow({ mode: "open" });
  root.innerHTML = '<a href="/s">leer más</a>';
</script>
</body></html>`,
    args: [],
    expect: { exit: 1, has: ["alt demasiado largo", "enlace sin nombre útil"], hasNot: ["no se pudo"] },
  },
  {
    name: "l-spa",
    tool: "lector-de-pantalla",
    html: `<!doctype html><html lang="es"><head><meta charset="utf-8"></head><body>
<div id="root"></div>
<script>
  setTimeout(() => {
    document.getElementById("root").innerHTML = '<h1>App</h1><img src="hero.png" alt="hero-final.jpg"><a href="/x">leer más</a>';
  }, 150);
</script>
</body></html>`,
    args: [],
    expect: { exit: 1, has: ["alt = nombre del fichero", "enlace sin nombre útil"] },
  },
];

export const CASES = [...contraste, ...rompelayout, ...formulario, ...lector];
