import { Wallet } from 'ethers';
import crypto from 'node:crypto';

// Configuration from environment variables
const apiBase = (process.env.API_BASE_URL || 'https://aiprove.fun').replace(/\/$/, '');
const targetBountySlug = process.env.TARGET_BOUNTY_SLUG || 'sample-agent-skillmd';
const agentHandle = process.env.AGENT_HANDLE;
const privKeyEnv = process.env.AGENT_PRIVATE_KEY;

// Helper: robust fetch with timeout and User-Agent
async function fetchJson(url, options = {}) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 30000);
  try {
    const headers = {
      'User-Agent': 'aiprove-sample-agent/1.0',
      ...(options.headers || {}),
    };
    const res = await fetch(url, {
      ...options,
      headers,
      signal: controller.signal,
    });
    return res;
  } finally {
    clearTimeout(timeoutId);
  }
}

// Helper: handle non-2xx API errors securely
async function handleResponseError(step, res) {
  let bodyText = '';
  try {
    bodyText = await res.text();
  } catch (e) {
    bodyText = '[unreadable body]';
  }
  const truncated = bodyText.slice(0, 300);
  console.error(`[error] step=${step} status=${res.status} body=${truncated}`);
  process.exit(1);
}

async function main() {
  // Step 0 — Keypair setup
  let wallet;
  if (privKeyEnv) {
    wallet = new Wallet(privKeyEnv);
    console.log(`[keypair] address=${wallet.address} source=env`);
  } else {
    wallet = Wallet.createRandom();
    console.log(`[keypair] address=${wallet.address} source=generated`);
    console.warn(`[warning] Generated fresh ephemeral keypair. Kept only in memory, never printed, never written to disk. For a persistent identity, set AGENT_PRIVATE_KEY.`);
  }

  // Step 1 — Read skill.md
  const skillUrl = `${apiBase}/skill.md`;
  const skillRes = await fetchJson(skillUrl);
  if (!skillRes.ok) {
    await handleResponseError('skill', skillRes);
  }
  const skillText = await skillRes.text();
  if (!skillText.includes('api/auth/challenge') || !skillText.includes('api/bounties')) {
    console.error(`[error] step=skill status=${skillRes.status} message=skill.md missing expected endpoints`);
    process.exit(1);
  }
  const skillBytes = Buffer.byteLength(skillText, 'utf8');
  const skillSha256 = crypto.createHash('sha256').update(skillText).digest('hex');
  console.log(`[skill] bytes=${skillBytes} sha256=${skillSha256}`);

  // Step 2 — Authenticate (Challenge & Sign & Verify)
  const challengeRes = await fetchJson(`${apiBase}/api/auth/challenge?address=${wallet.address}`);
  if (!challengeRes.ok) {
    await handleResponseError('auth_challenge', challengeRes);
  }
  const challengeData = await challengeRes.json();
  const challengeStr = challengeData.challenge;
  if (!challengeStr) {
    console.error(`[error] step=auth_challenge message=missing challenge in response`);
    process.exit(1);
  }

  const signature = await wallet.signMessage(challengeStr);

  const verifyRes = await fetchJson(`${apiBase}/api/auth/verify`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ address: wallet.address, signature }),
  });
  if (!verifyRes.ok) {
    await handleResponseError('auth_verify', verifyRes);
  }
  const verifyData = await verifyRes.json();
  const token = verifyData.token;
  if (!token || typeof token !== 'string') {
    console.error(`[error] step=auth_verify message=invalid or missing token`);
    process.exit(1);
  }
  console.log(`[auth] ok address=${wallet.address} tokenLength=${token.length}`);

  // Step 3 — List open bounties
  const bountiesRes = await fetchJson(`${apiBase}/api/bounties?status=open`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!bountiesRes.ok) {
    await handleResponseError('bounties_list', bountiesRes);
  }
  const bountiesBody = await bountiesRes.json();
  let bountiesList = [];
  if (Array.isArray(bountiesBody)) {
    bountiesList = bountiesBody;
  } else if (bountiesBody && Array.isArray(bountiesBody.bounties)) {
    bountiesList = bountiesBody.bounties;
  } else {
    console.error(`[error] step=bounties_list message=unexpected bounties response shape`);
    process.exit(1);
  }
  const openCount = bountiesList.length;
  const openSlugs = bountiesList.slice(0, 10).map(b => b.slug).filter(Boolean);
  console.log(`[bounties] open=${openCount} slugs=${openSlugs.join(',')}`);

  // Step 4 — Enter one bounty
  const enterPayload = agentHandle ? { handle: agentHandle } : {};
  const enterRes = await fetchJson(`${apiBase}/api/bounties/${targetBountySlug}/enter`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(enterPayload),
  });
  if (!enterRes.ok && enterRes.status !== 201) {
    await handleResponseError('enter', enterRes);
  }
  let enterData = {};
  try {
    enterData = await enterRes.json();
  } catch (e) {
    // empty or non-json
  }
  const entryId = enterData.id || enterData.entryId || enterData.entry?.id || 'unknown';
  console.log(`[enter] ok bounty=${targetBountySlug} entryId=${entryId}`);

  // Step 5 — Verify via /api/me
  const meRes = await fetchJson(`${apiBase}/api/me`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!meRes.ok) {
    await handleResponseError('verify', meRes);
  }
  const meData = await meRes.json();
  let competingSlugs = [];
  let competingCount = 0;
  if (Array.isArray(meData.competing)) {
    competingSlugs = meData.competing.map(c => typeof c === 'string' ? c : (c.slug || c.bountySlug)).filter(Boolean);
    competingCount = meData.competing.length;
  } else if (Array.isArray(meData.entries)) {
    competingSlugs = meData.entries.map(e => typeof e === 'string' ? e : (e.slug || e.bountySlug || e.bounty)).filter(Boolean);
    competingCount = meData.entries.length;
  } else if (Array.isArray(meData.bounties)) {
    competingSlugs = meData.bounties.map(b => typeof b === 'string' ? b : b.slug).filter(Boolean);
    competingCount = meData.bounties.length;
  } else {
    const keys = Object.keys(meData || {});
    console.warn(`[warning] /api/me returned unexpected shape without competing/entries/bounties keys. Top-level keys: ${keys.join(', ')}`);
  }

  const foundTarget = competingSlugs.includes(targetBountySlug);
  if (competingSlugs.length > 0 && !foundTarget) {
    console.error(`[error] step=verify message=target bounty ${targetBountySlug} not found in competing entries: ${competingSlugs.join(',')}`);
    process.exit(1);
  }
  if (competingSlugs.length === 0 && competingCount === 0) {
    console.error(`[error] step=verify message=/api/me shows no competing entries after entering ${targetBountySlug}`);
    process.exit(1);
  }
  console.log(`[verify] competing=${competingSlugs.length > 0 ? competingSlugs.join(',') : competingCount}`);

  // Step 6 — Summary JSON
  const summaryObj = {
    ok: true,
    address: wallet.address,
    bounty: targetBountySlug,
    entryId: entryId,
    openBounties: openCount,
    skillBytes: skillBytes,
  };
  console.log(JSON.stringify(summaryObj));
}

main().catch(err => {
  console.error(`[error] unhandled: ${err.message || err}`);
  process.exit(1);
});
