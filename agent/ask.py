"""SmokeTrace Ask: a Strands agent that answers plain-language questions using the latest smoke forecast.

Runs as a Lambda behind API Gateway (POST /ask {"question": "...", "lang": "en|hi"}),
or locally:  python agent/ask.py "Is it safe for a cricket match in Noida tomorrow evening?"
Model: Amazon Bedrock (set MODEL_ID to override the Strands default).
"""
import json
import os
import sys
from datetime import datetime, timezone

from strands import Agent, tool

LOCAL_DATA = os.path.join(os.path.dirname(__file__), "..", "web", "data", "latest.json")
_cache = {}


def load():
    if "d" not in _cache:
        if os.environ.get("BUCKET"):
            import boto3
            body = boto3.client("s3").get_object(Bucket=os.environ["BUCKET"], Key="data/latest.json")["Body"].read()
            _cache["d"] = json.loads(body)
        else:
            with open(LOCAL_DATA, encoding="utf-8") as f:
                _cache["d"] = json.load(f)
    return _cache["d"]


@tool
def list_areas() -> list:
    """List every Delhi-NCR area SmokeTrace forecasts, with its current smoke alert level."""
    return [{"id": r["id"], "name": r["name"], "level": r["level"]} for r in load()["receptors"]]


@tool
def area_forecast(area: str) -> dict:
    """Smoke forecast for one Delhi-NCR area for the next 48 hours: alert level, smoke arrival time,
    peak time (ISO, UTC), relative smoke index, top source districts and the official advice text.

    Args:
        area: Area name or id, e.g. "Noida", "south-delhi", "Gurugram".
    """
    q = area.lower().replace(" ", "-")
    for r in load()["receptors"]:
        if q in (r["id"], r["name"].lower().replace(" ", "-")) or q in r["id"]:
            return {k: r[k] for k in ("name", "level", "index", "arrival", "peak", "top_sources", "message_en", "message_hi")}
    return {"error": f"Unknown area '{area}'. Call list_areas to see valid areas."}


@tool
def fire_activity() -> dict:
    """Current farm-fire activity from NASA FIRMS satellite data: totals and the most active districts."""
    d = load()
    return {"summary": d["summary"], "top_districts": d["districts"][:10], "generated_at": d["generated_at"]}


@tool
def priority_fires() -> list:
    """Fire clusters ranked by how much of their smoke is projected to reach Delhi-NCR: district, number of fires,
    share of total NCR smoke (%), which areas it reaches and first arrival time (ISO, UTC)."""
    return load().get("priority", [])


@tool
def delhi_pm25_forecast() -> list:
    """Hourly PM2.5 forecast (µg/m³) for central Delhi from the CAMS model, sampled every 3 hours."""
    return load()["delhi_pm25"][::3]


SYSTEM = """You are SmokeTrace, an air-quality assistant for parents, schools and residents in Delhi-NCR.
You answer questions about farm-fire smoke using ONLY the tools, which hold the latest forecast.
Current time (UTC): {now}. Users live in India: always convert times to IST (UTC+5:30) and say them like "Tue 7 pm".
Rules:
- Always call tools before answering; never invent numbers.
- Give a clear recommendation first (e.g. "Move the match indoors" / "Fine to go ahead"), then one or two lines of reason.
- Mention the smoke source districts when smoke is expected.
- The smoke index is relative, not µg/m³. For actual pollution levels refer to the PM2.5 forecast; 60 µg/m³ is India's 24-hour standard.
- Be honest about uncertainty: forecasts are estimates from satellite fire data and wind models.
- Keep answers under 90 words. Reply in {lang_name}."""


def ask(question, lang="en"):
    kwargs = {"model": os.environ["MODEL_ID"]} if os.environ.get("MODEL_ID") else {}
    agent = Agent(
        system_prompt=SYSTEM.format(now=datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M"),
                                    lang_name="Hindi (Devanagari script)" if lang == "hi" else "English"),
        tools=[list_areas, area_forecast, fire_activity, priority_fires, delhi_pm25_forecast],
        callback_handler=None, **kwargs)
    return str(agent(question)).strip()


def handler(event, context):
    headers = {"Content-Type": "application/json"}
    try:
        body = json.loads(event.get("body") or "{}")
        q = (body.get("question") or "").strip()[:500]
        if not q:
            return {"statusCode": 400, "headers": headers, "body": json.dumps({"error": "question is required"})}
        return {"statusCode": 200, "headers": headers,
                "body": json.dumps({"answer": ask(q, body.get("lang", "en"))}, ensure_ascii=False)}
    except Exception as e:  # surface a clean error to the UI, full trace goes to CloudWatch
        print("ask failed:", repr(e))
        return {"statusCode": 500, "headers": headers, "body": json.dumps({"error": "Could not answer right now."})}


if __name__ == "__main__":
    print(ask(" ".join(sys.argv[1:]) or "Is it safe to hold a cricket match in Noida tomorrow evening?"))
