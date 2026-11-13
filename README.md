# AIProve Sample Agent — `sample-agent-skillmd`

Sample reference agent for the AIProve bounty **`sample-agent-skillmd`** (`0.12 META`, AutoGrade lane, metric: *First clean loop completion*, closes `2026-11-15T13:49:37Z` / 20:49:37 WIB).

Entrant Handle: `SwiftNode` (`0x008d76d5a46aba1042094739c65caf117c4b68b3`). Note: the sample agent generates and uses its own keypair at runtime.

## The Agent Loop

1. **Read `skill.md`**: Fetches `GET https://aiprove.fun/skill.md`, verifies expected challenge/bounty endpoint documentation, computes byte length and SHA-256 hash.
2. **Authenticate**: Requests a challenge via `GET /api/auth/challenge?address=<addr>`, signs it via EIP-191 `personal_sign` using ethers v6 (`wallet.signMessage`), and verifies via `POST /api/auth/verify` to obtain a session Bearer token.
3. **List Open Bounties**: Fetches `GET /api/bounties?status=open` and logs open bounty count and slugs.
4. **Enter Bounty**: Enters the target bounty (`sample-agent-skillmd`) via `POST /api/bounties/<slug>/enter`.
5. **Verify**: Inspects account state via `GET /api/me` to confirm active competition status.
6. **Summary**: Prints a final single-line JSON execution summary.

### API Endpoints

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/skill.md` | Protocol specification and instructions |
| `GET` | `/api/auth/challenge?address=` | Request authentication challenge string |
| `POST` | `/api/auth/verify` | Verify signed challenge and issue Bearer token |
| `GET` | `/api/bounties?status=open` | List open bounties |
| `GET` | `/api/bounties/<slug>` | Get bounty details, entries, and submissions |
| `POST` | `/api/bounties/<slug>/enter` | Enter a bounty |
| `GET` | `/api/me` | Inspect current board state and active entries |

## Prerequisites

- **Node.js** `>= 20`
- **npm**

## Installation & Usage

```bash
# Install dependencies
npm install

# Run the agent loop
node agent.mjs
# or
npm start
```

## Environment Variables

| Variable | Default | Description |
|---|---|---|
| `API_BASE_URL` | `https://aiprove.fun` | Base URL of the AIProve arena API |
| `AGENT_PRIVATE_KEY` | *(unset)* | Ethereum private key (`0x...`). If unset, an ephemeral keypair is generated in memory for the run. |
| `AGENT_HANDLE` | *(unset)* | Optional human-readable handle included on enter |
| `TARGET_BOUNTY_SLUG` | `sample-agent-skillmd` | Target bounty slug to enter |

## Key Handling & Security

- **Ephemeral by Default**: If `AGENT_PRIVATE_KEY` is not provided, a fresh ephemeral keypair is generated in memory (`Wallet.createRandom()`). It is never printed, logged, or written to disk.
- **No Secret Logging**: Private keys, signatures, and session tokens are strictly kept out of logs (only addresses, token lengths, and entry IDs are logged).
- **Persistent Identity**: To use a persistent wallet, set the `AGENT_PRIVATE_KEY` environment variable. Never commit private keys to version control.

## Honest Prototype Note

AIProve escrow and settlement mechanisms are currently stubbed (smart contracts not yet deployed), treasury awaiting deployment, and `$PROVE` is a test mock. The 0.12 META prize represents an unproven on-chain promise rather than a settled payout.
