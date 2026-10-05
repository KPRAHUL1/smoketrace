const LEVEL_COLOR = { low: "#3fb37f", moderate: "#e6b422", high: "#f06a2b", severe: "#d63a5a" };
const STALE_HOURS = 6;
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
    loading: "Loading the latest fire and wind data…", loadErr: "Couldn't load the forecast. Check your connection.", retry: "Try again",
    stale: (h) => `This forecast is ${h} hours old. New data may be delayed.`,
    archived: (d) => `Viewing an archived forecast from ${d}.`, backLive: "Back to live",
    bArrives: (a, h, at) => `${a}: smoke arrives in ~${h} h (${at})`, bNow: (a) => `${a}: smoke arriving now`,
    bNone: (a) => `${a}: no farm-fire smoke expected in the next 48 h`, bPeak: "peak",
    tlTitle: "Smoke expected, every 3 hours",
    prioTitle: "Priority fires for Delhi-NCR", prioSub: "Fire clusters sending the most smoke toward Delhi-NCR. Click one to see its path.",
    prioRow: (p) => `${p.fires} fires · reaches ${p.areas.length} area${p.areas.length === 1 ? "" : "s"}`,
    ofSmoke: "of NCR smoke", focusing: (p) => `Showing smoke from #${p} only`, showAll: "Show all", noPrio: "No fire clusters are sending smoke toward Delhi-NCR right now.",
    run: "Forecast run", live: "Live (latest)",
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
    loading: "आग और हवा का ताज़ा डेटा लोड हो रहा है…", loadErr: "पूर्वानुमान लोड नहीं हो सका। अपना इंटरनेट जाँचें।", retry: "फिर कोशिश करें",
    stale: (h) => `यह पूर्वानुमान ${h} घंटे पुराना है। नया डेटा आने में देर हो सकती है।`,
    archived: (d) => `आप ${d} का पुराना पूर्वानुमान देख रहे हैं।`, backLive: "लाइव पर लौटें",
    bArrives: (a, h, at) => `${a}: लगभग ${h} घंटे में धुआँ पहुँचेगा (${at})`, bNow: (a) => `${a}: धुआँ अभी पहुँच रहा है`,
    bNone: (a) => `${a}: अगले 48 घंटों में धुएँ की संभावना नहीं`, bPeak: "सबसे ज़्यादा",
    tlTitle: "अपेक्षित धुआँ, हर 3 घंटे",
    prioTitle: "दिल्ली-एनसीआर के लिए प्राथमिक आग", prioSub: "ये आग के समूह दिल्ली-एनसीआर की ओर सबसे ज़्यादा धुआँ भेज रहे हैं। रास्ता देखने के लिए क्लिक करें।",
    prioRow: (p) => `${p.fires} आग · ${p.areas.length} क्षेत्रों तक`,
    ofSmoke: "एनसीआर धुएँ का", focusing: (p) => `केवल #${p} का धुआँ दिखाया जा रहा है`, showAll: "सब दिखाएँ", noPrio: "अभी कोई आग दिल्ली-एनसीआर की ओर धुआँ नहीं भेज रही है।",
    run: "पूर्वानुमान", live: "लाइव (ताज़ा)",
  },
};
let lang = "en", data, nowTs, sel, focus = null, isLive = true, history = [], loadedFile = "latest.json", pendingFile = "latest.json";
const $ = (id) => document.getElementById(id);
const t = (k, ...a) => (typeof T[lang][k] === "function" ? T[lang][k](...a) : T[lang][k]);
const name = (r) => (lang === "hi" ? r.name_hi : r.name);

const fmt = (iso) => new Date(iso).toLocaleString(lang === "hi" ? "hi-IN" : "en-IN",
  { timeZone: "Asia/Kolkata", weekday: "short", hour: "numeric", minute: "2-digit" });
const fmtDay = (iso) => new Date(iso).toLocaleString(lang === "hi" ? "hi-IN" : "en-IN",
  { timeZone: "Asia/Kolkata", day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });

const map = L.map("map", { zoomControl: true, preferCanvas: true }).setView([29.9, 76.0], 7);
L.tileLayer("https://services.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}", {
  attribution: "Tiles &copy; Esri | Fires: NASA FIRMS | Wind: Open-Meteo", maxZoom: 12,
}).addTo(map);
L.tileLayer("https://services.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Reference/MapServer/tile/{z}/{y}/{x}", { maxZoom: 12, pane: "shadowPane" }).addTo(map);
const trailLayer = L.layerGroup().addTo(map);
const fireLayer = L.layerGroup().addTo(map);
const puffLayer = L.layerGroup().addTo(map);
const prioLayer = L.layerGroup().addTo(map);
const recLayer = L.layerGroup().addTo(map);
let puffs = [], trails = [];

// ---------- loading, error and archive states ----------

function showState(kind) {
  $("state").hidden = !kind;
  $("state").className = kind || "";
  $("stateMsg").textContent = kind === "error" ? t("loadErr") : t("loading");
  $("retry").hidden = kind !== "error";
  document.body.classList.toggle("nodata", !data);
  if (!data) $("updated").textContent = kind === "error" ? t("loadErr") : t("loading");
}

async function load(file) {
  pendingFile = file;
  showState("loading");
  try {
    const r = await fetch("data/" + file, { cache: "no-store" });
    if (!r.ok) throw new Error(r.status);
    const d = await r.json();
    if (!d.receptors || !d.trajectories) throw new Error("bad data");
    data = d;
  } catch {
    showState("error");
    return;
  }
  loadedFile = file;
  isLive = file === "latest.json";
  nowTs = Date.parse(data.generated_at) / 1000;
  if (!sel || !data.receptors.some((r) => r.id === sel)) sel = data.receptors[0].id;
  focus = null;
  drawStatic();
  $("ask").hidden = !(isLive && data.ask_url);
  render();
  setTime(24);
  showState(null);
}
$("retry").addEventListener("click", () => load(pendingFile));

async function loadHistory() {
  try {
    const r = await fetch("data/history/index.json", { cache: "no-store" });
    if (!r.ok) throw new Error(r.status);
    history = (await r.json()).slice().reverse();
  } catch {
    history = [];
  }
  renderRuns();
}

function renderRuns() {
  $("runbox").hidden = history.length < 2;
  $("run").innerHTML = `<option value="latest.json">${t("live")}</option>` + history.map((h) =>
    `<option value="${h.file}" ${h.file === loadedFile ? "selected" : ""}>${fmtDay(h.t)} · ${h.fires} ${t("fireCount")} · ${t(h.worst)}</option>`).join("");
}
$("run").addEventListener("change", (e) => load(e.target.value));

// ---------- map ----------

function drawStatic() {
  for (const g of [trailLayer, puffLayer, prioLayer, recLayer]) g.clearLayers();
  puffs = [];
  trails = [];
  for (const tr of data.trajectories) {
    const line = L.polyline(tr.p.map((p) => [p[1], p[2]]), { color: "#b9c2d0", weight: 1, opacity: 0.12, interactive: false }).addTo(trailLayer);
    trails.push({ s: tr.s, line });
    puffs.push({ s: tr.s, tr: tr.p, m: L.circleMarker([tr.p[0][1], tr.p[0][2]], { radius: 3, stroke: false, fillColor: "#c9d1dd", fillOpacity: 0, interactive: false }).addTo(puffLayer) });
  }
  (data.priority || []).slice(0, 5).forEach((p, i) => {
    L.marker([p.lat, p.lon], { icon: L.divIcon({ className: "prio-pin", html: `<span>${i + 1}</span>`, iconSize: [24, 24] }) })
      .addTo(prioLayer).on("click", () => setFocus(p.id));
  });
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
    if ((focus !== null && p.s !== focus) || ts < tr[0][0] || ts > tr[tr.length - 1][0]) { p.m.setStyle({ fillOpacity: 0 }); continue; }
    let i = 0;
    while (i < tr.length - 2 && tr[i + 1][0] < ts) i++;
    const a = tr[i], b = tr[i + 1] || a, f = b[0] === a[0] ? 0 : (ts - a[0]) / (b[0] - a[0]);
    p.m.setLatLng([a[1] + (b[1] - a[1]) * f, a[2] + (b[2] - a[2]) * f])
      .setStyle({ fillOpacity: 0.6, fillColor: focus !== null ? "#ffb070" : "#c9d1dd" });
  }
  drawFires(ts);
  const rel = h - 24;
  $("clock").innerHTML = `${fmt(new Date(ts * 1000).toISOString())}<em>${rel === 0 ? t("now") : (rel > 0 ? "+" : "") + rel + "h"}</em>`;
  document.querySelectorAll("#tl rect[data-h]").forEach((b) => b.classList.toggle("cur", rel >= +b.dataset.h && rel < +b.dataset.h + 3));
}

function setFocus(id) {
  focus = focus === id ? null : id;
  for (const tr of trails) {
    const on = focus === null || tr.s === focus;
    tr.line.setStyle(focus === null
      ? { color: "#b9c2d0", weight: 1, opacity: 0.12 }
      : { color: on ? "#ff9a4a" : "#b9c2d0", weight: on ? 2 : 1, opacity: on ? 0.75 : 0.03 });
  }
  if (focus !== null) {
    const lines = trails.filter((tr) => tr.s === focus).map((tr) => tr.line);
    map.fitBounds(L.featureGroup(lines).getBounds().pad(0.15));
  }
  renderFocus();
  setTime(+$("slider").value);
}
$("clearFocus").addEventListener("click", () => setFocus(focus));

function renderFocus() {
  const rank = (data.priority || []).findIndex((p) => p.id === focus);
  $("focusChip").hidden = focus === null;
  if (focus !== null) $("focusMsg").textContent = t("focusing", rank + 1);
  document.querySelectorAll("#priority li").forEach((li) => li.classList.toggle("on", +li.dataset.id === focus));
}

let timer = null;
function stop() { clearInterval(timer); timer = null; $("play").textContent = "▶"; }
$("slider").addEventListener("input", (e) => setTime(+e.target.value));
$("play").addEventListener("click", () => {
  if (timer) return stop();
  $("play").textContent = "❚❚";
  timer = setInterval(() => setTime((+$("slider").value + 1) % 73), 220);
});

document.querySelectorAll(".lang button").forEach((b) => b.addEventListener("click", () => {
  lang = b.dataset.lang;
  document.querySelectorAll(".lang button").forEach((x) => x.classList.toggle("on", x === b));
  document.body.classList.toggle("hi", lang === "hi");
  document.documentElement.lang = lang;
  if (!data) return showState($("state").className || null);
  render();
  renderRuns();
  setTime(+$("slider").value);
}));

// ---------- panel ----------

function render() {
  document.querySelectorAll("[data-i18n]").forEach((el) => { el.textContent = t(el.dataset.i18n); });
  const s = data.summary;
  $("updated").textContent = `${t("updated")} ${fmt(data.generated_at)} IST · NASA FIRMS + Open-Meteo`;
  $("s-fires").textContent = s.fires;
  $("s-frp").textContent = Math.round(s.total_frp).toLocaleString("en-IN");
  $("s-hot").textContent = data.receptors.filter((r) => r.level === "high" || r.level === "severe").length;

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

  renderBanner(r);
  renderTimeline(r);
  renderPriority();
  renderFocus();
  drawPm();
}
$("area").addEventListener("change", (e) => { sel = e.target.value; render(); });

function renderBanner(r) {
  const b = $("banner");
  b.style.setProperty("--lv", LEVEL_COLOR[r.level]);
  const hrs = r.arrival ? Math.round((Date.parse(r.arrival) / 1000 - nowTs) / 3600) : null;
  const text = r.arrival === null ? t("bNone", name(r))
    : hrs <= 0 ? t("bNow", name(r)) : t("bArrives", name(r), hrs, fmt(r.arrival));
  $("bLevel").textContent = t(r.level);
  $("bText").textContent = text + (r.peak && r.arrival ? ` · ${t("bPeak")} ${fmt(r.peak)}` : "");

  const ageH = Math.floor((Date.now() / 1000 - nowTs) / 3600);
  const note = !isLive ? t("archived", fmtDay(data.generated_at)) : ageH >= STALE_HOURS ? t("stale", ageH) : "";
  $("notice").hidden = !note;
  $("noticeMsg").textContent = note;
  $("backLive").hidden = isLive;
}
$("backLive").addEventListener("click", () => { $("run").value = "latest.json"; load("latest.json"); });

function renderTimeline(r) {
  const hourly = r.hourly || [];
  const bars = Array.from({ length: 16 }, (_, i) => hourly.slice(i * 3, i * 3 + 3).reduce((a, b) => a + b, 0));
  const W = 340, H = 80, P = 14, bw = (W - P * 2) / 16;
  const max = Math.max(40, ...bars);  // floor so trace amounts stay visibly small
  const peakI = bars.indexOf(Math.max(...bars));
  const col = LEVEL_COLOR[r.level];
  let svg = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${t("tlTitle")}">`;
  bars.forEach((v, i) => {
    const h = Math.max(v > 0 ? 3 : 1, (v / max) * (H - P * 2));
    svg += `<rect data-h="${i * 3}" x="${P + i * bw + 1}" y="${H - P - h}" width="${bw - 2}" height="${h}" rx="2"
      fill="${v > 0 ? col : "#2a303a"}"><title>+${i * 3}–${i * 3 + 3}h: ${v.toFixed(1)}</title></rect>`;
  });
  if (bars[peakI] > 0) svg += `<text x="${P + peakI * bw + bw / 2}" y="${H - P - (bars[peakI] / max) * (H - P * 2) - 4}" fill="#e8eaee" font-size="9" text-anchor="middle">${t("bPeak")}</text>`;
  [0, 12, 24, 36, 48].forEach((hh) => {
    svg += `<text x="${P + (hh / 3) * bw}" y="${H - 2}" fill="#8b93a1" font-size="9" text-anchor="${hh === 0 ? "start" : hh === 48 ? "end" : "middle"}">${hh === 0 ? t("now") : "+" + hh + "h"}</text>`;
  });
  $("tl").innerHTML = svg + "</svg>";
  $("tl").querySelectorAll("rect").forEach((b) => b.addEventListener("click", () => { stop(); setTime(24 + +b.dataset.h); }));
}

function renderPriority() {
  const pr = data.priority || [];
  $("priority").innerHTML = pr.length ? pr.slice(0, 5).map((p, i) => `<li data-id="${p.id}">
      <span class="rank">${i + 1}</span>
      <span class="pd"><b>${p.district}</b><small>${t("prioRow", p)}</small></span>
      <span class="ps"><b>${Math.round(p.share)}%</b><small>${t("ofSmoke")}</small></span></li>`).join("")
    : `<li class="empty">${t("noPrio")}</li>`;
  $("priority").querySelectorAll("li[data-id]").forEach((li) => li.addEventListener("click", () => setFocus(+li.dataset.id)));
}

function drawPm() {
  const pts = (data.delhi_pm25 || []).filter((p) => p.pm25 != null);
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

// ---------- ask ----------

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

// ---------- start ----------

if (new URLSearchParams(location.search).get("lang") === "hi") {
  lang = "hi";
  document.querySelectorAll(".lang button").forEach((x) => x.classList.toggle("on", x.dataset.lang === "hi"));
  document.body.classList.add("hi");
  document.documentElement.lang = "hi";
}
load("latest.json").then(loadHistory);
