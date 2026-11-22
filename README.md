# Window Test

Compare two versions of a fictional notice while holding three situations and the expected answers fixed. It shows differences in extracted actions, deadline dates, and exceptions, along with quoted evidence. Sample replay is deterministic and explicitly labelled. A live run uses synthetic respondents and cannot establish human comprehension.

## Rehearse on a Mac

```sh
npm ci
PORT=8081 npm run dev
```

Open http://127.0.0.1:8081 and click **Replay sample**. The comparison shows 5/9 matches on the original and 9/9 on the revision, with the changed deadline and exception visible in the individual rows. Edit either notice to prepare a live run. Sample replay refuses edited drafts. Keep the examples fictional.

## Enable live Expected Parrot evaluation

1. Sign in at [Expected Parrot](https://www.expectedparrot.com/) and copy a provider key into a private `.env`. Use Python 3.13 and install the EDSL dependency.

```sh
python3.13 -m venv .venv
.venv/bin/pip install -r requirements.txt
cp .env.example .env
```

2. In `.env`, set `EDSL_PYTHON=.venv/bin/python`, `EXPECTED_PARROT_API_KEY`, and an independent random `WINDOW_RUN_TOKEN`. Run the app again. Enter only the **run token** in the app. **Evaluate live** dispatches six scenario/version pairs. The code caps input size, allows a single in-flight run, and surfaces provider failures. Calls can consume credits. EDSL selects a default model. If the account asks for model access or key setup, complete that in Expected Parrot. Intent labels and dates are evaluated by exact normalized match, and cited evidence is checked against each notice.
3. To change the test, edit `study.json` in the source project and update the test cases and answer key together. The built-in sample answers are fixtures for the supplied grant only.

## TraceRoot

In [TraceRoot](https://traceroot.ai/), create a project and obtain its OTLP HTTP **traces endpoint** and required authentication headers. Set `TRACEROOT_OTLP_TRACES_URL` to the complete traces URL and `TRACEROOT_OTLP_HEADERS_JSON` to the headers object from the dashboard. The value in `.env.example` illustrates the format; use the header scheme your collector supplies. The server exports OTLP JSON. If your deployment supplies only a protobuf endpoint, route through an OpenTelemetry Collector that accepts OTLP JSON and forwards using your project's supported protocol. It emits a trace with six child spans after a successful live run. The trace shows scenario, notice version, score and evidence verification. The app reports the collector response and the trace ID. The sample replay does not export traces.

## ElevenLabs voice

Create a public **practice** ElevenAgents agent. Configure a no-parameter client tool called `read_revised_notice` with **Wait for response** enabled. Give the agent instructions to call it before answering, use only that version, ask for missing facts and defer unsupported answers to the program office. Paste the agent ID in Window Test, start voice, and ask “What if I’m missing a document?” Edit the revised notice and ask again. The tool returns the current draft for that browser session.

This is a practice project. Account-backed calls require user credentials and are separate from local simulated validation. Keep keys out of commits.
