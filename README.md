# SmokeTrace

**A 48-hour forecast of farm-fire smoke reaching Delhi-NCR, by neighbourhood, in English and Hindi.**

Every October–November, crop-residue fires in Punjab and Haryana (and across the border in Pakistani Punjab) send smoke into Delhi. Satellites see every fire within hours, and wind forecasts say where the air will go. But nobody turns that into a plain answer for a school principal or a parent: *"Smoke from fires near Sangrur will reach North Delhi tomorrow evening. Move sports indoors."*

SmokeTrace does that.

## How it works

1. **Fires:** every 3 hours it pulls NASA FIRMS VIIRS active-fire detections (375 m resolution, last 48 h) for the Punjab–Haryana–west UP belt.
2. **Clustering:** it groups the fires into 0.1° cells, weighted by Fire Radiative Power (MW), and tags each cell with its nearest district.
3. **Wind:** it fetches hourly 925 hPa winds (about 750 m up, where smoke travels during the day) from Open-Meteo on a 0.5° grid.
4. **Trajectories:** it tracks forward paths from each cluster's detection time to 48 h ahead. Three particles per cluster (wind direction ±12°) model the plume spreading out.
5. **Arrival:** it watches 10 receptor points across Delhi-NCR. A particle within 20 km counts as arrived and adds its share of fire power to that area's smoke index. That gives an alert level, an arrival time, a peak time and the top source districts.
6. **Alerts:** it publishes an SNS alert in English and Hindi when any area reaches *high* or *severe*. People can also share their area's status on WhatsApp straight from the page.
7. **Cross-check:** it shows the CAMS PM2.5 forecast for Delhi next to the trajectories, as an independent model.
8. **Ask SmokeTrace:** a [Strands Agents](https://strandsagents.com) agent on Amazon Bedrock answers questions like *"Is Saturday's school sports day in Noida safe?"* in English or Hindi. It uses four tools over the live forecast (`list_areas`, `area_forecast`, `fire_activity`, `delhi_pm25_forecast`), so it never makes up numbers.

## AWS architecture

```
EventBridge (rate 3h) ──> Lambda: engine/smoketrace.handler ──> S3 data/latest.json ─┐
                                  └──> SNS ──> email/SMS (high/severe only)            ├─> CloudFront (HTTPS) ──> browser
                                                            S3 static site (web/) ─────┘          │
                          Lambda Function URL: agent/ask.handler (Strands + Bedrock) <───────────┘ "Ask SmokeTrace"
```

| Piece | AWS service | Why |
|---|---|---|
| Scheduled model run | EventBridge + Lambda | Satellite data refreshes every few hours, so there's nothing to keep running between updates |
| Forecast + site | S3 + CloudFront | Static files, HTTPS, Indian edge locations |
| Alerts | SNS | Email/SMS fan-out on high/severe |
| Q&A agent | Strands Agents SDK (AWS open source) + Bedrock | Plain-language answers grounded in tool calls |

All of it is in `template.yaml` (AWS SAM). The engine uses only the Python standard library. The agent needs only `strands-agents`.

## Run locally

```bash
python engine/smoketrace.py          # fetches live data, writes web/data/latest.json, prints the alert table
cd web && python -m http.server 8000 # open http://localhost:8000  (?lang=hi for Hindi)

pip install strands-agents           # optional: the agent, needs AWS credentials with Bedrock access
python agent/ask.py "Is it safe for a cricket match in Noida tomorrow evening?"
```

## Deploy to AWS (Free Tier)

Prerequisites: [AWS CLI](https://aws.amazon.com/cli/) + [SAM CLI](https://docs.aws.amazon.com/serverless-application-model/latest/developerguide/install-sam-cli.html), `aws configure` done, and Bedrock model access for an Anthropic Claude model enabled in the console. `us-east-1` is the simplest region for Bedrock.

```bash
sam build
sam deploy --guided --parameter-overrides AlertEmail=you@example.com ModelId=<bedrock-model-or-inference-profile-id>
# outputs: AppURL, BucketName, IngestFunctionName
aws s3 sync web s3://<BucketName> --exclude "data/*"
aws lambda invoke --function-name <IngestFunctionName> out.json   # first run now instead of waiting 3h
```

Open `AppURL`. The "Ask SmokeTrace" box appears once the first run has written the agent URL into `latest.json`. Confirm the SNS email to receive alerts.

**Cost note:** the agent's Function URL is public so the page can call it. Questions are capped at 500 characters, but every call is billed by Bedrock. Set an AWS Budget alert, and delete the stack (`sam delete`) after judging.

## Honest limits

- These are trajectory **estimates**, not a chemical transport model. The index is relative fire power, not µg/m³.
- Fires under cloud, or very short-lived ones, can be missed by the satellite. FIRMS data runs about 3 h behind.
- 925 hPa is one level. Night-time inversions trap smoke lower, which the model doesn't capture.
- Alert thresholds (40 / 150 / 400 MW-equivalent) are first guesses. They should be calibrated against CPCB PM2.5 readings.

## Data sources

- NASA FIRMS, VIIRS S-NPP NRT active fires (no key needed for the regional CSV)
- Open-Meteo forecast API (925 hPa wind) and Air Quality API (CAMS PM2.5)
- Basemap © Esri
