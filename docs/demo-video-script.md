# SmokeTrace: 3-minute demo video script

Record on a day with plenty of fires. Before recording, run `python engine/smoketrace.py` and save a copy of `web/data/latest.json` as a backup.

| Time | On screen | Say |
|---|---|---|
| 0:00–0:20 | Delhi smog photo or news clip, then the app's map | "Every October, Delhi's air turns toxic, and part of it is smoke from crop fires hundreds of kilometres away. Satellites see every one of those fires. But no parent or school principal gets told: *the smoke reaches your area tomorrow at 7 pm.* SmokeTrace does that." |
| 0:20–0:50 | Zoom on the orange fire dots in Punjab; hover a few | "These are real fires from the last 48 hours, detected by NASA's VIIRS satellite. Today there are *N* fires putting out *X* megawatts. SmokeTrace pulls them automatically every three hours." |
| 0:50–1:25 | Press ▶ and let the smoke particles drift toward Delhi | "For every fire cluster we take the wind forecast at about 750 metres, where smoke actually travels, and project its path 48 hours ahead. Watch it move across Haryana toward Delhi." *Point out smoke coming from Pakistani Punjab if it's visible: "Smoke doesn't stop at borders. Today a lot of it starts near Lahore."* |
| 1:25–1:55 | Pick "Noida" in *Your area*; show level, arrival time, source bars; toggle to हिं | "Pick your area and you get one clear answer: the alert level, when the smoke arrives, when it peaks, and which districts it's coming from. In English and in Hindi." |
| 1:55–2:15 | Tap *Share on WhatsApp*, show the message | "One tap sends it to the school or society WhatsApp group, which is where people in India actually get their information." |
| 2:15–2:35 | Type in *Ask SmokeTrace*: "Is Saturday's sports day in Noida safe?" | "Or just ask. This agent is built with the Strands Agents SDK on Amazon Bedrock. It checks the live forecast through tools before it answers, so it never makes up a number." |
| 2:35–2:50 | Architecture diagram from the README | "Under the hood: EventBridge triggers a Lambda every three hours. It writes the forecast to S3, CloudFront serves it over HTTPS, and SNS sends email alerts when an area goes high or severe. It's all serverless and runs on the Free Tier." |
| 2:50–3:00 | Back to the map, playing | "It's an early warning, not a measurement, and we say so on the page. But a day's notice is enough to move a match indoors. SmokeTrace." |

**Tips**
- Record at 1080p and zoom the browser to 110–125% so the text is readable.
- Keep the mouse still while you talk. Leave the map animation running during the architecture part if you can.
- Show the AWS console briefly (Lambda runs, CloudWatch logs) for 3–5 seconds. Judges score "Built on AWS".
