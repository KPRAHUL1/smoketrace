const LEVEL_COLOR = { low: "#3fb37f", moderate: "#e6b422", high: "#f06a2b", severe: "#d63a5a" };
const T = {
  en: {
    fires: "Farm fires (satellite)", smoke: "Projected smoke", statFires: "fires, 48h", statFrp: "MW fire power",
    statHot: "areas at risk", yourArea: "Your area", share: "Share on WhatsApp", allAreas: "Delhi-NCR, next 48 hours",
    topSources: "Where the fires are", pmTitle: "Delhi PM2.5 forecast (CAMS, µg/m³)",
    foot: "Smoke paths are estimates from satellite fire detections (NASA FIRMS) and 925 hPa wind forecasts (Open-Meteo). Treat them as an early warning, not a measurement. Clouds can hide fires.",
    low: "Low", moderate: "Moderate", high: "High", severe: "Severe",
    arrives: "smoke from", peak: "peak", none: "no smoke expected", from: "Likely smoke sources",
    updated: "Updated", now: "now", fireCount: "fires",
    askTitle: "Ask SmokeTrace", askBtn: "Ask", ex1: "Is Saturday's school sports day in Noida safe?",
    ex2: "Where is today's smoke coming from?", thinking: "Checking the latest forecast…", askErr: "Couldn't answer right now. Please try again.",
  },
  hi: {
    fires: "खेतों की आग (सैटेलाइट)", smoke: "धुएँ का अनुमानित रास्ता", statFires: "आग, 48 घंटे", statFrp: "MW अग्नि शक्ति",
    statHot: "जोखिम वाले क्षेत्र", yourArea: "आपका क्षेत्र", share: "WhatsApp पर भेजें", allAreas: "दिल्ली-एनसीआर, अगले 48 घंटे",
    topSources: "आग कहाँ लगी है", pmTitle: "दिल्ली PM2.5 पूर्वानुमान (CAMS, µg/m³)",
    foot: "धुएँ के रास्ते NASA FIRMS सैटेलाइट आग डेटा और हवा के पूर्वानुमान पर आधारित अनुमान हैं। इन्हें शुरुआती चेतावनी मानें, माप नहीं। बादल आग को छिपा सकते हैं।",
    low: "कम", moderate: "मध्यम", high: "अधिक", severe: "गंभीर",
    arrives: "धुआँ", peak: "सबसे ज़्यादा", none: "धुएँ की संभावना नहीं", from: "धुएँ के संभावित स्रोत",
    updated: "अपडेट", now: "अभी", fireCount: "आग",
    askTitle: "SmokeTrace से पूछें", askBtn: "पूछें", ex1: "क्या शनिवार को नोएडा में स्कूल का खेल दिवस सुरक्षित है?",
    ex2: "आज का धुआँ कहाँ से आ रहा है?", thinking: "ताज़ा पूर्वानुमान देख रहे हैं…", askErr: "अभी जवाब नहीं मिल सका। फिर से कोशिश करें।",
  },
};
let lang = "en", data, nowTs, sel;
const $ = (id) => document.getElementById(id);
const t = (k) => T[lang][k];

const fmt = (iso) => new Date(iso).toLocaleString(lang === "hi" ? "hi-IN" : "en-IN",
  { timeZone: "Asia/Kolkata", weekday: "short", hour: "numeric", minute: "2-digit" });

const map = L.map("map", { zoomControl: true, preferCanvas: true }).setView([29.9, 76.0], 7);
L.tileLayer("https://services.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}", {
  attribution: "Tiles &copy; Esri | Fires: NASA FIRMS | Wind: Open-Meteo", maxZoom: 12,
}).addTo(map);
L.tileLayer("https://services.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Reference/MapServer/tile/{z}/{y}/{x}", { maxZoom: 12, pane: "shadowPane" }).addTo(map);
const trailLayer = L.layerGroup().addTo(map);
const fireLayer = L.layerGroup().addTo(map);
const puffLayer = L.layerGroup().addTo(map);
const recLayer = L.layerGroup().addTo(map);
let puffs = [];

fetch("data/latest.json", { cache: "no-store" }).then((r) => r.json()).then((d) => {
  data = d;
  nowTs = Date.parse(d.generated_at) / 1000;
  sel = d.receptors[0].id;
  drawStatic();
  $("ask").hidden = !d.ask_url;
  render();
  setTime(24);
  if (new URLSearchParams(location.search).get("lang") === "hi") document.querySelector('[data-lang="hi"]').click();
});

function drawStatic() {
  for (const tr of data.trajectories) {
    L.polyline(tr.map((p) => [p[1], p[2]]), { color: "#b9c2d0", weight: 1, opacity: 0.12, interactive: false }).addTo(trailLayer);
    puffs.push({ tr, m: L.circleMarker([tr[0][1], tr[0][2]], { radius: 3, stroke: false, fillColor: "#c9d1dd", fillOpacity: 0, interactive: false }).addTo(puffLayer) });
  }
  for (const r of data.receptors) {
    const c = L.circleMarker([r.lat, r.lon], { radius: 7, color: "#0f1115", weight: 2, fillColor: LEVEL_COLOR[r.level], fillOpacity: 1 })
      .addTo(recLayer).on("click", () => { sel = r.id; render(); });
    c.bindTooltip(r.name, { direction: "right", className: "rlabel", offset: [6, 0] });
    r._marker = c;
  }
}

function drawFires(ts) {
  fireLayer.clearLayers();
  for (const [lat, lon, frp, ft] of data.fires) {
    if (ft > ts) continue;
    const age = (ts - ft) / 3600;
    L.circleMarker([lat, lon], {
      radius: 2 + Math.min(Math.sqrt(frp), 8), stroke: false, fillColor: "#ff7a1a",
      fillOpacity: Math.max(0.25, 0.95 - age / 60), interactive: false,
    }).addTo(fireLayer);
  }
}

function setTime(h) {
  $("slider").value = h;
  const ts = nowTs + (h - 24) * 3600;
  for (const p of puffs) {
    const tr = p.tr;
    if (ts < tr[0][0] || ts > tr[tr.length - 1][0]) { p.m.setStyle({ fillOpacity: 0 }); continue; }
    let i = 0;
    while (i < tr.length - 2 && tr[i + 1][0] < ts) i++;
    const a = tr[i], b = tr[i + 1] || a, f = b[0] === a[0] ? 0 : (ts - a[0]) / (b[0] - a[0]);
    p.m.setLatLng([a[1] + (b[1] - a[1]) * f, a[2] + (b[2] - a[2]) * f]).setStyle({ fillOpacity: 0.55 });
  }
  drawFires(ts);
  const rel = h - 24;
  $("clock").innerHTML = `${fmt(new Date(ts * 1000).toISOString())}<em>${rel === 0 ? t("now") : (rel > 0 ? "+" : "") + rel + "h"}</em>`;
}

let timer = null;
$("slider").addEventListener("input", (e) => setTime(+e.target.value));
$("play").addEventListener("click", () => {
  if (timer) { clearInterval(timer); timer = null; $("play").textContent = "▶"; return; }
  $("play").textContent = "❚❚";
  timer = setInterval(() => setTime((+$("slider").value + 1) % 73), 220);
});

document.querySelectorAll(".lang button").forEach((b) => b.addEventListener("click", () => {
  lang = b.dataset.lang;
  document.querySelectorAll(".lang button").forEach((x) => x.classList.toggle("on", x === b));
  document.body.classList.toggle("hi", lang === "hi");
  document.documentElement.lang = lang;
  render();
  setTime(+$("slider").value);
}));

function render() {
  document.querySelectorAll("[data-i18n]").forEach((el) => { el.textContent = t(el.dataset.i18n); });
  const s = data.summary;
  $("updated").textContent = `${t("updated")} ${fmt(data.generated_at)} IST · NASA FIRMS + Open-Meteo`;
  $("s-fires").textContent = s.fires;
  $("s-frp").textContent = Math.round(s.total_frp).toLocaleString("en-IN");
  $("s-hot").textContent = data.receptors.filter((r) => r.level === "high" || r.level === "severe").length;

  const name = (r) => (lang === "hi" ? r.name_hi : r.name);
  $("area").innerHTML = data.receptors.slice().sort((a, b) => a.name.localeCompare(b.name))
    .map((r) => `<option value="${r.id}" ${r.id === sel ? "selected" : ""}>${name(r)}</option>`).join("");
  const r = data.receptors.find((x) => x.id === sel);
  $("lvl").className = `badge lv-${r.level}`;
  $("lvl").textContent = t(r.level);
  $("when").textContent = r.arrival ? `${t("arrives")} ${fmt(r.arrival)} · ${t("peak")} ${fmt(r.peak)}` : t("none");
  const msg = lang === "hi" ? r.message_hi : r.message_en;
  $("msg").textContent = msg;
  $("srcs").innerHTML = r.top_sources.length
    ? `${t("from")}:` + r.top_sources.map((x) => `<div>${x.district} · ${x.share}%</div><div class="bar" style="width:${x.share}%"></div>`).join("")
    : "";
  const shareText = `SmokeTrace · ${name(r)}: ${t(r.level)}${r.arrival ? ` (${t("arrives")} ${fmt(r.arrival)})` : ""}\n${msg}\n${location.href}`;
  $("share").href = "https://wa.me/?text=" + encodeURIComponent(shareText);

  $("list").innerHTML = data.receptors.map((x) => `<li data-id="${x.id}">
      <span class="pip" style="background:${LEVEL_COLOR[x.level]}"></span>
      <span class="nm">${name(x)}</span>
      <span class="t">${x.arrival ? fmt(x.arrival) : "—"}</span></li>`).join("");
  $("list").querySelectorAll("li").forEach((li) => li.addEventListener("click", () => {
    sel = li.dataset.id; render();
    const rr = data.receptors.find((x) => x.id === sel); map.setView([rr.lat, rr.lon], 9);
  }));
  for (const x of data.receptors) {
    x._marker.setRadius(x.id === sel ? 10 : 7);
    x._marker.getTooltip().setContent(name(x));
    if (x.id === sel) x._marker.openTooltip(); else x._marker.closeTooltip();
  }

  const top = data.districts.slice(0, 8), max = top[0] ? top[0].frp : 1;
  $("districts").innerHTML = top.map((d) => `<li><span>${d.district}</span>
      <span class="b" style="width:${(d.frp / max) * 100}%"></span><span class="n">${d.fires} ${t("fireCount")}</span></li>`).join("");

  drawPm();
}
$("area").addEventListener("change", (e) => { sel = e.target.value; render(); });

function drawPm() {
  const pts = data.delhi_pm25.filter((p) => p.pm25 != null);
  if (!pts.length) { $("pm").textContent = "—"; return; }
  const W = 340, H = 90, P = 18, max = Math.max(...pts.map((p) => p.pm25)) * 1.1;
  const t0 = Date.parse(pts[0].t), t1 = Date.parse(pts[pts.length - 1].t);
  const x = (ts) => P + ((ts - t0) / (t1 - t0)) * (W - P * 2);
  const y = (v) => H - P - (v / max) * (H - P * 2);
  const line = pts.map((p, i) => `${i ? "L" : "M"}${x(Date.parse(p.t)).toFixed(1)},${y(p.pm25).toFixed(1)}`).join("");
  const nx = x(nowTs * 1000);
  const peak = pts.reduce((a, b) => (b.pm25 > a.pm25 ? b : a));
  $("pm").innerHTML = `<svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none">
    <line x1="${P}" x2="${W - P}" y1="${y(60)}" y2="${y(60)}" stroke="#e6b422" stroke-dasharray="3 3" opacity=".5"/>
    <text x="${W - P}" y="${y(60) - 3}" fill="#8b93a1" font-size="9" text-anchor="end">60 (NAAQS 24h)</text>
    <path d="${line}" fill="none" stroke="#ff7a1a" stroke-width="2"/>
    <line x1="${nx}" x2="${nx}" y1="${P / 2}" y2="${H - P}" stroke="#8b93a1" stroke-dasharray="2 3"/>
    <text x="${nx + 3}" y="${P}" fill="#8b93a1" font-size="9">${t("now")}</text>
    <circle cx="${x(Date.parse(peak.t))}" cy="${y(peak.pm25)}" r="3" fill="#ff7a1a"/>
    <text x="${x(Date.parse(peak.t))}" y="${y(peak.pm25) - 6}" fill="#e8eaee" font-size="10" text-anchor="middle">${Math.round(peak.pm25)}</text>
  </svg>`;
}

document.querySelectorAll(".chips button").forEach((b) => b.addEventListener("click", () => {
  $("q").value = b.textContent;
  $("askform").requestSubmit();
}));
$("askform").addEventListener("submit", async (e) => {
  e.preventDefault();
  const question = $("q").value.trim();
  if (!question || !data.ask_url) return;
  const btn = e.target.querySelector("button");
  btn.disabled = true;
  $("answer").className = "wait";
  $("answer").textContent = t("thinking");
  try {
    const r = await fetch(data.ask_url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ question, lang }) });
    const j = await r.json();
    if (!r.ok) throw new Error(j.error);
    $("answer").className = "";
    $("answer").textContent = j.answer;
  } catch {
    $("answer").className = "";
    $("answer").textContent = t("askErr");
  } finally {
    btn.disabled = false;
  }
});
