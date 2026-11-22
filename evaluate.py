"""Run paired, structured synthetic comprehension checks using Expected Parrot."""
import json
import sys

from edsl import QuestionFreeText, Scenario, ScenarioList, Survey

payload = json.load(sys.stdin)
questions = [
    QuestionFreeText(question_name="action", question_text=(
        "Notice: {{ scenario.notice }}\nYour situation: {{ scenario.facts }}\n"
        "What action should you take first? Reply exactly with one of: "
        "Upload the form, Request extension, Contact office, Unknown."
    )),
    QuestionFreeText(question_name="deadline", question_text=(
        "Notice: {{ scenario.notice }}\nYour situation: {{ scenario.facts }}\n"
        "What is the deadline date? Reply in YYYY-MM-DD or Unknown."
    )),
    QuestionFreeText(question_name="exception", question_text=(
        "Notice: {{ scenario.notice }}\nYour situation: {{ scenario.facts }}\n"
        "Which special condition applies? Reply exactly with one of: "
        "None, Approval required, Automatic extension, Skip closure, Unknown."
    )),
    QuestionFreeText(question_name="evidence", question_text=(
        "Notice: {{ scenario.notice }}\nYour situation: {{ scenario.facts }}\n"
        "Quote one exact sentence from the notice that supports your interpretation."
    )),
]
scenarios = ScenarioList([
    Scenario({"key": item["id"] + ":" + version, "notice": payload[version], "facts": item["facts"]})
    for item in payload["cases"] for version in ("original", "rewrite")
])
results = Survey(questions).by(scenarios).run()
for result in results:
    print("WINDOW_RESULT " + json.dumps({"key":result.scenario["key"], **result.answer}))
