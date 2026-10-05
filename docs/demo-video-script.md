# SmokeTrace: 3-minute demo video script

Record on a day with plenty of fires. Before recording, run `python engine/smoketrace.py` and save a copy of `web/data/latest.json` as a backup.

| Time | On screen | Say |
|---|---|---|
| 0:00–0:20 | Delhi smog photo or news clip, then the app's map | "Every October, Delhi's air turns toxic, and part of it is smoke from crop fires hundreds of kilometres away. Satellites see every one of those fires. But no parent or school principal gets told: *the smoke reaches your area tomorrow at 7 pm.* SmokeTrace does that." |
| 0:20–0:50 | Zoom on the orange fire dots in Punjab; hover a few | "These are real fires from the last 48 hours, detected by NASA's VIIRS satellite. Today there are *N* fires putting out *X* megawatts. SmokeTrace pulls them automatically every three hours." |
| 0:50–1:25 | Press ▶ and let the smoke particles drift toward Delhi | "For every fire cluster we take the wind forecast at about 750 metres, where smoke actually travels, and project its path 48 hours ahead. Watch it move across Haryana toward Delhi." *If the source bars show Pakistani districts (marked "(PK)"), add: "Smoke doesn't stop at borders."* |
| 1:25–1:50 | Pick "Noida" in *Your area*; point at the banner, then the 48-hour bars; toggle to हिं; tap *Share on WhatsApp* | "Pick your area and the answer is at the top: the level, when the smoke arrives and when it peaks. The bars show the next 48 hours. It works in Hindi too, and one tap sends it to the school's WhatsApp group." |
| 1:50–2:15 | Scroll to *Priority fires*; click #1 so only its smoke paths stay lit | "Read the same model in reverse and it becomes a tool for authorities. These are the fire clusters sending the most smoke toward Delhi right now. If enforcement can reach only a few villages today, start here." |
| 2:15–2:35 | Type in *Ask SmokeTrace*: "Is Saturday's sports day in Noida safe?" | "Or just ask. This agent is built with the Strands Agents SDK on Amazon Bedrock. It checks the live forecast through tools before it answers, so it never makes up a number." |
| 2:35–2:50 | Architecture diagram from the README | "Under the hood: EventBridge triggers a Lambda every three hours. It writes the forecast to S3, CloudFront serves it over HTTPS, and SNS sends email alerts when an area goes high or severe. It's all serverless and runs on the Free Tier." |
| 2:50–3:00 | Back to the map, playing | "It's an early warning, not a measurement, and we say so on the page. But a day's notice is enough to move a match indoors. SmokeTrace." |

**Tips**
- Record at 1080p and zoom the browser to 110–125% so the text is readable.
- Keep the mouse still while you talk. Leave the map animation running during the architecture part if you can.
- If fires are quiet on recording day, use the *Forecast run* picker to replay the worst day so far. That's what the season history is for.
- Show the AWS console briefly (Lambda runs, CloudWatch logs) for 3–5 seconds. Judges score "Built on AWS".
