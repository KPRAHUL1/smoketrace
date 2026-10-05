"""SmokeTrace engine: live farm-fire hotspots -> forward smoke trajectories -> Delhi-NCR arrival alerts.

Stdlib only, so the same file runs locally and as an AWS Lambda without layers.
Data sources (no API keys):
  - NASA FIRMS VIIRS (Suomi-NPP) active fires, South Asia, last 48h
  - Open-Meteo 925 hPa winds (~750 m, inside the daytime boundary layer where smoke travels)
  - Open-Meteo CAMS PM2.5 forecast for Delhi (independent cross-check)
"""
import csv
import io
import json
import math
import os
import urllib.request
from datetime import datetime, timedelta, timezone

FIRMS_URL = "https://firms.modaps.eosdis.nasa.gov/data/active_fire/suomi-npp-viirs-c2/csv/SUOMI_VIIRS_C2_South_Asia_48h.csv"
WIND_URL = "https://api.open-meteo.com/v1/forecast"
AQ_URL = "https://air-quality-api.open-meteo.com/v1/air-quality"

# Source region: Punjab + Haryana + west UP farm belt
SRC_BBOX = (27.6, 32.6, 73.8, 78.2)  # lat_min, lat_max, lon_min, lon_max
# Wind grid covers source region and Delhi-NCR with margin
GRID_LAT = [27.0 + 0.5 * i for i in range(13)]  # 27.0 .. 33.0
GRID_LON = [72.5 + 0.5 * i for i in range(15)]  # 72.5 .. 79.5

CELL_DEG = 0.1          # fire clustering cell
FORECAST_H = 48         # how far ahead we project
RECEPTOR_KM = 20.0      # particle within this distance counts as "arrived"
SPREAD_DEG = (-12, 0, 12)  # wind-direction perturbations -> plume spread

RECEPTORS = [
    ("north-delhi", "North Delhi", "उत्तरी दिल्ली", 28.70, 77.15),
    ("central-delhi", "Central Delhi", "मध्य दिल्ली", 28.64, 77.22),
    ("south-delhi", "South Delhi", "दक्षिणी दिल्ली", 28.52, 77.21),
    ("east-delhi", "East Delhi", "पूर्वी दिल्ली", 28.63, 77.30),
    ("west-delhi", "West Delhi", "पश्चिमी दिल्ली", 28.65, 77.05),
    ("gurugram", "Gurugram", "गुरुग्राम", 28.46, 77.03),
    ("noida", "Noida", "नोएडा", 28.54, 77.39),
    ("ghaziabad", "Ghaziabad", "गाज़ियाबाद", 28.67, 77.44),
    ("faridabad", "Faridabad", "फ़रीदाबाद", 28.41, 77.32),
    ("sonipat", "Sonipat", "सोनीपत", 28.99, 77.02),
]

# Approximate district HQ coordinates, used to name where a fire cluster is.
DISTRICTS = [
    ("Amritsar", "Punjab", 31.63, 74.87), ("Tarn Taran", "Punjab", 31.45, 74.93),
    ("Gurdaspur", "Punjab", 32.04, 75.40), ("Jalandhar", "Punjab", 31.33, 75.58),
    ("Kapurthala", "Punjab", 31.38, 75.38), ("Hoshiarpur", "Punjab", 31.53, 75.91),
    ("Ludhiana", "Punjab", 30.90, 75.85), ("Moga", "Punjab", 30.82, 75.17),
    ("Firozpur", "Punjab", 30.93, 74.61), ("Fazilka", "Punjab", 30.40, 74.03),
    ("Muktsar", "Punjab", 30.47, 74.52), ("Faridkot", "Punjab", 30.67, 74.76),
    ("Bathinda", "Punjab", 30.21, 74.95), ("Mansa", "Punjab", 29.99, 75.40),
    ("Barnala", "Punjab", 30.38, 75.55), ("Sangrur", "Punjab", 30.25, 75.84),
    ("Patiala", "Punjab", 30.34, 76.39), ("Fatehgarh Sahib", "Punjab", 30.65, 76.39),
    ("Rupnagar", "Punjab", 30.97, 76.53), ("SAS Nagar", "Punjab", 30.70, 76.72),
    ("Ambala", "Haryana", 30.38, 76.78), ("Yamunanagar", "Haryana", 30.13, 77.27),
    ("Kurukshetra", "Haryana", 29.97, 76.85), ("Kaithal", "Haryana", 29.80, 76.40),
    ("Karnal", "Haryana", 29.69, 76.99), ("Panipat", "Haryana", 29.39, 76.97),
    ("Jind", "Haryana", 29.32, 76.32), ("Fatehabad", "Haryana", 29.52, 75.45),
    ("Sirsa", "Haryana", 29.53, 75.03), ("Hisar", "Haryana", 29.15, 75.72),
    ("Sonipat", "Haryana", 28.99, 77.02), ("Rohtak", "Haryana", 28.89, 76.61),
    ("Bhiwani", "Haryana", 28.79, 76.13), ("Saharanpur", "Uttar Pradesh", 29.97, 77.55),
    ("Muzaffarnagar", "Uttar Pradesh", 29.47, 77.70), ("Meerut", "Uttar Pradesh", 28.98, 77.71),
    ("Sri Ganganagar", "Rajasthan", 29.91, 73.88), ("Hanumangarh", "Rajasthan", 29.58, 74.33),
    # Pakistani Punjab: smoke crosses the border, so name it rather than mislabel it as an Indian district
    ("Lahore (PK)", "Punjab, Pakistan", 31.55, 74.34), ("Kasur (PK)", "Punjab, Pakistan", 31.12, 74.45),
    ("Sheikhupura (PK)", "Punjab, Pakistan", 31.71, 73.98), ("Gujranwala (PK)", "Punjab, Pakistan", 32.16, 74.19),
    ("Sialkot (PK)", "Punjab, Pakistan", 32.49, 74.53), ("Narowal (PK)", "Punjab, Pakistan", 32.10, 74.87),
    ("Okara (PK)", "Punjab, Pakistan", 30.81, 73.45), ("Pakpattan (PK)", "Punjab, Pakistan", 30.34, 73.39),
    ("Bahawalnagar (PK)", "Punjab, Pakistan", 29.99, 73.25),
]


def _get(url, params=None, timeout=60):
    if params:
        url = url + "?" + "&".join(f"{k}={v}" for k, v in params.items())
    req = urllib.request.Request(url, headers={"User-Agent": "SmokeTrace/1.0"})
    with urllib.request.urlopen(req, timeout=timeout) as r:
        return r.read().decode("utf-8")


def km(lat1, lon1, lat2, lon2):
    p = math.pi / 180
    a = (math.sin((lat2 - lat1) * p / 2) ** 2
         + math.cos(lat1 * p) * math.cos(lat2 * p) * math.sin((lon2 - lon1) * p / 2) ** 2)
    return 12742 * math.asin(math.sqrt(a))


# Approximate India-Pakistan border (lat, lon), north to south, through the source region.
# Nearest-HQ matching alone mislabels border fires (e.g. Attari -> Lahore), so pick the side first.
BORDER = [(32.6, 75.35), (32.05, 75.0), (31.85, 74.8), (31.6, 74.57), (31.3, 74.6), (31.0, 74.55),
          (30.7, 74.25), (30.4, 73.9), (30.0, 73.55), (29.5, 73.3), (27.0, 71.5)]


def in_pakistan(lat, lon):
    for (la1, lo1), (la2, lo2) in zip(BORDER, BORDER[1:]):
        if la2 <= lat <= la1:
            return lon < lo2 + (lo1 - lo2) * (lat - la2) / (la1 - la2)
    return lat > BORDER[0][0] and lon < BORDER[0][1]


def nearest_district(lat, lon):
    pk = in_pakistan(lat, lon)
    return min((d for d in DISTRICTS if d[1].endswith("Pakistan") == pk), key=lambda d: km(lat, lon, d[2], d[3]))


# ---------- data fetch ----------

def fetch_fires():
    rows = csv.DictReader(io.StringIO(_get(FIRMS_URL)))
    la0, la1, lo0, lo1 = SRC_BBOX
    fires = []
    for r in rows:
        lat, lon = float(r["latitude"]), float(r["longitude"])
        if not (la0 <= lat <= la1 and lo0 <= lon <= lo1) or r["confidence"] == "low":
            continue
        t = datetime.strptime(r["acq_date"] + r["acq_time"].zfill(4), "%Y-%m-%d%H%M").replace(tzinfo=timezone.utc)
        fires.append({"lat": lat, "lon": lon, "frp": float(r["frp"] or 0), "t": t})
    return fires


def fetch_wind(start, hours):
    """Returns (t0, grid) where grid[h][i][j] = (u, v) in m/s, hourly from t0."""
    lats, lons = [], []
    for la in GRID_LAT:
        for lo in GRID_LON:
            lats.append(f"{la:.2f}")
            lons.append(f"{lo:.2f}")
    data = json.loads(_get(WIND_URL, {
        "latitude": ",".join(lats), "longitude": ",".join(lons),
        "hourly": "wind_speed_925hPa,wind_direction_925hPa",
        "wind_speed_unit": "ms", "timezone": "GMT",
        "start_hour": start.strftime("%Y-%m-%dT%H:00"),
        "end_hour": (start + timedelta(hours=hours)).strftime("%Y-%m-%dT%H:00"),
    }, timeout=120))
    t0 = datetime.fromisoformat(data[0]["hourly"]["time"][0]).replace(tzinfo=timezone.utc)
    n_h = len(data[0]["hourly"]["time"])
    grid = [[[None] * len(GRID_LON) for _ in GRID_LAT] for _ in range(n_h)]
    for k, loc in enumerate(data):
        i, j = divmod(k, len(GRID_LON))
        sp, dr = loc["hourly"]["wind_speed_925hPa"], loc["hourly"]["wind_direction_925hPa"]
        for h in range(n_h):
            s, d = sp[h] or 0.0, (dr[h] or 0.0) * math.pi / 180
            grid[h][i][j] = (-s * math.sin(d), -s * math.cos(d))  # meteorological "from" -> u,v
    return t0, grid


def fetch_delhi_pm25():
    try:
        d = json.loads(_get(AQ_URL, {"latitude": 28.63, "longitude": 77.22, "hourly": "pm2_5",
                                     "forecast_days": 3, "timezone": "GMT"}))
        return [{"t": t + "Z", "pm25": v} for t, v in zip(d["hourly"]["time"], d["hourly"]["pm2_5"])]
    except Exception:
        return []


# ---------- model ----------

def wind_at(grid, h, lat, lon):
    """Bilinear interpolation of (u, v) at hour index h."""
    fi = (lat - GRID_LAT[0]) / 0.5
    fj = (lon - GRID_LON[0]) / 0.5
    i = min(max(int(fi), 0), len(GRID_LAT) - 2)
    j = min(max(int(fj), 0), len(GRID_LON) - 2)
    di, dj = min(max(fi - i, 0), 1), min(max(fj - j, 0), 1)
    g = grid[min(max(h, 0), len(grid) - 1)]
    u = v = 0.0
    for a, b, w in ((i, j, (1 - di) * (1 - dj)), (i + 1, j, di * (1 - dj)),
                    (i, j + 1, (1 - di) * dj), (i + 1, j + 1, di * dj)):
        u += g[a][b][0] * w
        v += g[a][b][1] * w
    return u, v


def cluster(fires):
    cells = {}
    for f in fires:
        key = (round(f["lat"] / CELL_DEG), round(f["lon"] / CELL_DEG))
        c = cells.setdefault(key, {"lat": 0, "lon": 0, "n": 0, "frp": 0.0, "t": f["t"]})
        c["lat"] += f["lat"]
        c["lon"] += f["lon"]
        c["n"] += 1
        c["frp"] += f["frp"]
        c["t"] = max(c["t"], f["t"])
    out = []
    for c in cells.values():
        c["lat"] /= c["n"]
        c["lon"] /= c["n"]
        d = nearest_district(c["lat"], c["lon"])
        c["district"], c["state"] = d[0], d[1]
        out.append(c)
    return out


def advect(src, t0, grid, now):
    """Hourly forward trajectories from a fire cluster's last detection until now + FORECAST_H."""
    end_h = int((now - t0).total_seconds() // 3600) + FORECAST_H
    start_h = int((src["t"] - t0).total_seconds() // 3600)
    paths = []
    for rot in SPREAD_DEG:
        cr, sr = math.cos(rot * math.pi / 180), math.sin(rot * math.pi / 180)
        lat, lon = src["lat"], src["lon"]
        pts = [(start_h, lat, lon)]
        for h in range(start_h, end_h):
            u, v = wind_at(grid, h, lat, lon)
            u, v = u * cr - v * sr, u * sr + v * cr
            lat += v * 3600 / 111_000
            lon += u * 3600 / (111_000 * math.cos(lat * math.pi / 180))
            pts.append((h + 1, lat, lon))
            if not (GRID_LAT[0] <= lat <= GRID_LAT[-1] and GRID_LON[0] <= lon <= GRID_LON[-1]):
                break
        paths.append(pts)
    return paths


def level(index):
    if index >= 400:
        return "severe"
    if index >= 150:
        return "high"
    if index >= 40:
        return "moderate"
    return "low"


MESSAGES = {
    "severe": ("Heavy farm-fire smoke expected. Move all outdoor activity indoors, keep windows shut, run purifiers; N95 if you must go out.",
               "खेतों की आग का घना धुआँ आने की संभावना है। सभी बाहरी गतिविधियाँ अंदर करें, खिड़कियाँ बंद रखें; बाहर जाएँ तो N95 मास्क पहनें।"),
    "high": ("Farm-fire smoke likely. Schools: shift PE and assemblies indoors. Children, elderly and asthma patients should limit time outside.",
             "खेतों की आग का धुआँ आने की संभावना है। स्कूल: खेल और प्रार्थना सभा अंदर करें। बच्चे, बुज़ुर्ग और अस्थमा रोगी बाहर कम निकलें।"),
    "moderate": ("Some farm-fire smoke may reach this area. Sensitive groups should watch symptoms and keep a mask handy.",
                 "कुछ धुआँ इस क्षेत्र तक पहुँच सकता है। संवेदनशील लोग लक्षणों पर ध्यान दें और मास्क साथ रखें।"),
    "low": ("Little or no farm-fire smoke expected in the next 48 hours.",
            "अगले 48 घंटों में खेतों की आग का धुआँ बहुत कम या नहीं आने की संभावना है।"),
}


def run(now=None):
    now = (now or datetime.now(timezone.utc)).replace(minute=0, second=0, microsecond=0)
    fires = fetch_fires()
    sources = cluster(fires)
    start = min([s["t"] for s in sources] + [now]).replace(minute=0, second=0, microsecond=0)
    t0, grid = fetch_wind(start, int((now - start).total_seconds() // 3600) + FORECAST_H + 1)
    now_h = int((now - t0).total_seconds() // 3600)

    rec = {r[0]: {"id": r[0], "name": r[1], "name_hi": r[2], "lat": r[3], "lon": r[4],
                  "index": 0.0, "first_h": None, "hourly": [0.0] * (FORECAST_H + 1), "sources": {}} for r in RECEPTORS}
    traj_out = []
    for si, s in enumerate(sources):
        s["impact"], s["areas"], s["first_h"] = 0.0, set(), None
        paths = advect(s, t0, grid, now)
        w = s["frp"] / len(paths)  # each particle carries a share of the cluster's fire power
        for pts in paths:
            hit = set()
            for h, la, lo in pts:
                if h < now_h:
                    continue  # smoke already passed; we only alert on what's still coming
                for r in RECEPTORS:
                    if r[0] in hit or km(la, lo, r[3], r[4]) > RECEPTOR_KM:
                        continue
                    hit.add(r[0])
                    R = rec[r[0]]
                    R["index"] += w
                    R["first_h"] = h if R["first_h"] is None else min(R["first_h"], h)
                    if h - now_h <= FORECAST_H:
                        R["hourly"][h - now_h] += w
                    R["sources"][s["district"]] = R["sources"].get(s["district"], 0) + w
                    # reverse view: how much of this cluster's smoke lands in NCR, and where
                    s["impact"] += w
                    s["areas"].add(r[1])
                    s["first_h"] = h if s["first_h"] is None else min(s["first_h"], h)
            traj_out.append({"s": si, "p": [[round((t0 + timedelta(hours=h)).timestamp()), round(la, 3), round(lo, 3)]
                                            for h, la, lo in pts[::2] + [pts[-1]]]})

    receptors = []
    for R in rec.values():
        lv = level(R["index"])
        peak_h = max(range(len(R["hourly"])), key=R["hourly"].__getitem__) if R["index"] else None
        top = sorted(R["sources"].items(), key=lambda kv: -kv[1])[:3]
        receptors.append({
            "id": R["id"], "name": R["name"], "name_hi": R["name_hi"], "lat": R["lat"], "lon": R["lon"],
            "index": round(R["index"], 1), "level": lv,
            "arrival": (t0 + timedelta(hours=R["first_h"])).isoformat() if R["first_h"] is not None else None,
            "peak": (now + timedelta(hours=peak_h)).isoformat() if peak_h is not None else None,
            "top_sources": [{"district": d, "share": round(v / R["index"] * 100)} for d, v in top],
            "hourly": [round(v, 1) for v in R["hourly"]],
            "message_en": MESSAGES[lv][0], "message_hi": MESSAGES[lv][1],
        })
    receptors.sort(key=lambda r: -r["index"])

    by_district = {}
    for s in sources:
        d = by_district.setdefault(s["district"], {"district": s["district"], "state": s["state"], "fires": 0, "frp": 0.0})
        d["fires"] += s["n"]
        d["frp"] = round(d["frp"] + s["frp"], 1)

    total_impact = sum(s["impact"] for s in sources) or 1
    priority = [{
        "id": i, "lat": round(s["lat"], 3), "lon": round(s["lon"], 3), "district": s["district"], "state": s["state"],
        "fires": s["n"], "frp": round(s["frp"], 1), "share": round(s["impact"] / total_impact * 100, 1),
        "areas": sorted(s["areas"]),
        "arrival": (t0 + timedelta(hours=s["first_h"])).isoformat() if s["first_h"] is not None else None,
    } for i, s in enumerate(sources) if s["impact"] > 0]
    priority.sort(key=lambda p: -p["share"])

    return {
        "generated_at": now.isoformat(),
        "model": {"wind_level": "925 hPa", "horizon_h": FORECAST_H, "receptor_km": RECEPTOR_KM,
                  "fire_source": "NASA FIRMS VIIRS S-NPP NRT (48h)", "wind_source": "Open-Meteo"},
        "summary": {"fires": len(fires), "clusters": len(sources), "total_frp": round(sum(f["frp"] for f in fires), 1)},
        "fires": [[round(f["lat"], 3), round(f["lon"], 3), f["frp"], round(f["t"].timestamp())] for f in fires],
        "districts": sorted(by_district.values(), key=lambda d: -d["frp"]),
        "receptors": receptors,
        "priority": priority[:10],
        "trajectories": traj_out,
        "delhi_pm25": fetch_delhi_pm25(),
    }


def alert_text(result):
    hot = [r for r in result["receptors"] if r["level"] in ("high", "severe")]
    if not hot:
        return None
    lines = [f"SmokeTrace alert ({result['generated_at'][:16]} UTC)"]
    for r in hot:
        src = ", ".join(s["district"] for s in r["top_sources"])
        lines.append(f"- {r['name']}: {r['level'].upper()}, smoke from ~{r['arrival'][:16]} UTC (sources: {src})")
    lines.append(hot[0]["message_en"])
    lines.append(hot[0]["message_hi"])
    return "\n".join(lines)


HISTORY_KEEP = 480  # 60 days of 3-hourly runs


def history_file(result):
    return "history/" + result["generated_at"][:13] + ".json"


def add_to_index(index, result):
    entry = {"file": history_file(result), "t": result["generated_at"], "fires": result["summary"]["fires"],
             "worst": result["receptors"][0]["level"], "worst_area": result["receptors"][0]["name"]}
    index = [e for e in index if e["file"] != entry["file"]] + [entry]
    return sorted(index, key=lambda e: e["t"])[-HISTORY_KEEP:]


def handler(event, context):
    """AWS Lambda entry: run model, publish latest.json to S3, alert via SNS on high/severe."""
    import boto3
    result = run()
    result["ask_url"] = os.environ.get("ASK_URL", "")
    s3, bucket = boto3.client("s3"), os.environ["BUCKET"]
    body = json.dumps(result).encode()
    s3.put_object(Bucket=bucket, Key="data/latest.json", Body=body,
                  ContentType="application/json", CacheControl="max-age=300")
    # season archive: an immutable snapshot per run + a small index the page uses for its date picker
    s3.put_object(Bucket=bucket, Key="data/" + history_file(result), Body=body,
                  ContentType="application/json", CacheControl="max-age=31536000")
    try:
        index = json.loads(s3.get_object(Bucket=bucket, Key="data/history/index.json")["Body"].read())
    except s3.exceptions.NoSuchKey:
        index = []
    s3.put_object(Bucket=bucket, Key="data/history/index.json", Body=json.dumps(add_to_index(index, result)).encode(),
                  ContentType="application/json", CacheControl="max-age=300")
    msg = alert_text(result)
    if msg and os.environ.get("TOPIC_ARN"):
        boto3.client("sns").publish(TopicArn=os.environ["TOPIC_ARN"], Subject="SmokeTrace: smoke heading to Delhi-NCR", Message=msg)
    return {"fires": result["summary"]["fires"], "alerted": bool(msg)}


if __name__ == "__main__":
    data_dir = os.path.join(os.path.dirname(__file__), "..", "web", "data")
    os.makedirs(os.path.join(data_dir, "history"), exist_ok=True)
    res = run()
    for name in ("latest.json", history_file(res)):
        with open(os.path.join(data_dir, name), "w", encoding="utf-8") as f:
            json.dump(res, f, ensure_ascii=False)
    idx_path = os.path.join(data_dir, "history", "index.json")
    index = json.load(open(idx_path, encoding="utf-8")) if os.path.exists(idx_path) else []
    with open(idx_path, "w", encoding="utf-8") as f:
        json.dump(add_to_index(index, res), f)
    print(json.dumps(res["summary"]), f"trajectories={len(res['trajectories'])}")
    for r in res["receptors"]:
        print(f"{r['name']:<14} {r['level']:<9} idx={r['index']:<8} arrival={r['arrival']} top={r['top_sources']}")
    print("\npriority fires:")
    for p in res["priority"][:5]:
        print(f"  {p['district']:<18} fires={p['fires']:<3} share={p['share']}% areas={len(p['areas'])}")
    print("\n" + (alert_text(res) or "no alert"))
