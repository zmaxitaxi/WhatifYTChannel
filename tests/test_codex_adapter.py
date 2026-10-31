import json

import pytest

from aether.codex_adapter import (
    CodexAdapter,
    PlanningError,
    classify_failure,
    subscription_environment,
)


def fake_codex(tmp_path, raw_spec, *, invalid_first=False, pause=False):
    executable = tmp_path / "fake-codex"
    candidate = json.dumps(raw_spec)
    executable.write_text(f"""#!/usr/bin/env python3
import json, os, pathlib, sys, time
args = sys.argv[1:]
if args == ['--version']:
    print('codex-cli test')
elif args == ['login', 'status']:
    print('Logged in using ChatGPT')
elif args == ['exec', '--help']:
    print('--ignore-user-config --output-schema --ephemeral')
else:
    assert 'OPENAI_API_KEY' not in os.environ
    assert 'CODEX_API_KEY' not in os.environ
    assert '--ignore-user-config' in args
    assert args[args.index('--sandbox')+1] == 'read-only'
    prompt = sys.stdin.read()
    path = pathlib.Path(args[args.index('--output-last-message')+1])
    data = json.loads({candidate!r})
    if {invalid_first!r} and path.name == 'candidate-0.json':
        data['captions'][0]['end_frame'] = 1
    if {pause!r}: time.sleep(30)
    path.write_text(json.dumps(data))
    print(json.dumps({{'type':'turn.completed'}}))
""")
    executable.chmod(0o755)
    return str(executable)


def test_planner_preserves_inputs_and_repairs_invalid_candidate(
    tmp_path, raw_spec, spec, monkeypatch
):
    monkeypatch.setenv("OPENAI_API_KEY", "must-not-be-forwarded")
    monkeypatch.setenv("CODEX_API_KEY", "must-not-be-forwarded")
    executable = fake_codex(tmp_path, raw_spec, invalid_first=True)
    directory = tmp_path / "planning"
    planned = CodexAdapter(executable, model="test-model").plan(
        spec.topic, spec.evidence, raw_spec, directory
    )
    assert planned.evidence == spec.evidence
    assert (directory / "validation-0.json").is_file()
    assert (directory / "metadata-1.json").is_file()
    assert not (directory / "candidate-2.json").exists()


def test_planning_times_out_and_preserves_logs(tmp_path, raw_spec, spec):
    executable = fake_codex(tmp_path, raw_spec, pause=True)
    directory = tmp_path / "planning"
    with pytest.raises(PlanningError, match="timed out"):
        CodexAdapter(executable, timeout=0.1, model="test-model").plan(
            spec.topic, spec.evidence, raw_spec, directory
        )
    assert (directory / "events-0.jsonl").is_file()


def test_failure_classification_and_no_api_fallback(monkeypatch):
    monkeypatch.setenv("OPENAI_API_KEY", "test")
    assert "OPENAI_API_KEY" not in subscription_environment()
    assert classify_failure("usage limit reached") == "waiting_for_usage"
    assert classify_failure("authentication token expired") == "waiting_for_auth"
    assert classify_failure("connection reset") == "failed"
