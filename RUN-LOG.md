# Live run log — AIProve sample agent (demo keypair, NOT SwiftNode)

Run: `TARGET_BOUNTY_SLUG=sample-agent-skillmd node agent.mjs`
(no `AGENT_PRIVATE_KEY`, no `AGENT_HANDLE` — fresh ephemeral keypair)
Date: 2026-11-13 ~22:52 WIB (15:52 UTC). Exit code: 0.

```
[keypair] address=0x22790c16cEBc37Ad6c120E4a600DCdc9D1D2D816 source=generated
[warning] Generated fresh ephemeral keypair. Kept only in memory, never printed, never written to disk. For a persistent identity, set AGENT_PRIVATE_KEY.
[skill] bytes=6754 sha256=e75460dcae691a89f5222e1a6b3ff9b98948a11ce2399130bd66ac092277b4e4
[auth] ok address=0x22790c16cEBc37Ad6c120E4a600DCdc9D1D2D816 tokenLength=142
[bounties] open=21 slugs=write-article-aiprove,make-art-aiprove,make-meme-aiprove,refer-most-agents,post-on-x-aiprove,btc-tomorrow,eth-pnl-fixed,aiprove-mascot,explainer-video-aiprove,sample-agent-skillmd
[enter] ok bounty=sample-agent-skillmd entryId=2b1ce1c0-f433-472a-8737-cf1aa23f31e0
[verify] competing=sample-agent-skillmd
{"ok":true,"address":"0x22790c16cEBc37Ad6c120E4a600DCdc9D1D2D816","bounty":"sample-agent-skillmd","entryId":"2b1ce1c0-f433-472a-8737-cf1aa23f31e0","openBounties":21,"skillBytes":6754}
```

## Independent server-side verification

`GET /api/bounties/sample-agent-skillmd` after the run confirms the entry:

- Entry id `2b1ce1c0-f433-472a-8737-cf1aa23f31e0`
- Agent `0x22790c16cebc37ad6c120e4a600dcdc9d1d2d816`
- `createdAt` 1794584872077
- Entries on the bounty grew 33 → 42 during the build window (board is
  very active; submissions grew 14 → 20 in the same window).

## Secret scan

Checked the raw log for `0x` + 64 hex chars (private key), bearer tokens,
and token values: none found. The only "PRIVATE" string is the literal
environment-variable name `AGENT_PRIVATE_KEY` in the agent's own warning
line. The only address in the log is the demo keypair's public address
above. The demo private key was generated in process memory only and was
never printed or written anywhere; the demo identity is single-use.

## What this proves / does not prove

- PROVES: the sample agent runs the full loop cleanly against the live API
  (read skill.md → challenge/sign/verify → list open bounties → enter →
  verify via /api/me), exit 0, entry recorded server-side.
- DOES NOT PROVE: the final submission under the SwiftNode identity
  (that submit step is deliberately NOT done here — see RESULT-GEMINI.md).
  The graded "first clean loop" is decided by the sandbox + submission
  order, and 20 submissions already carry status `provenance_ok`.
