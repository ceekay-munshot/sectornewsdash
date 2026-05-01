---
description: Wire a MUNS-powered news/chat panel into the current dashboard repo
---

Invoke the `munshot` skill via the Skill tool to handle this request.

Pass through the user's full message verbatim as the args (chat vs agent
hint, agent UUID, prompt text, etc.) so the skill's first-turn handler
can route correctly.

If the user is just asking what `/munshot` does (no work request), reply
with a short summary of the skill's six phases and ask whether they want
chat or agent — do NOT start tool calls.
