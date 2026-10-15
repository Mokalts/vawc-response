# Backend tests

    cd backend
    .\venv\Scripts\python.exe -m pytest

Everything runs against a throwaway SQLite file. No test touches Neon, and the
environment is pinned in `conftest.py` before anything reads it, so a test
cannot quietly point at production.

Foreign keys are enforced, because SQLite ignores them unless asked and one of
the bugs covered here only appeared on Postgres.

What is covered, and why these and not others: every test below is a bug that
was live, not a hypothetical.

| File | Covers |
|---|---|
| `test_account_deletion.py` | Sessions dying on delete, the ID photo going with the account, recovery and its window, the officer's list past 30 days, permanent deletion and the record it leaves |
| `test_sms_delivery.py` | Number formats, the on/off switch, provider dispatch, which SIM sends, and the rule that the email always goes because an accepted SMS is not a delivered one |
| `test_id_verification.py` | Reading an ID without storing it, the sign-in gate in each of its states, and single-purpose tokens that cannot be used as sessions |
| `test_exposure.py` | What answers without a session, that a 500 does not describe itself, and that the API docs are closed when deployed |

`test_exposure.py` pins the list of public endpoints. If you add an endpoint and
forget its guard, that test fails and names it. If the endpoint is meant to be
public, add it to the list on purpose.

Not covered: the admin case flow, BPOs, endorsements, the monthly report, and
anything in the browser. Worth saying out loud rather than implying the suite is
complete.
