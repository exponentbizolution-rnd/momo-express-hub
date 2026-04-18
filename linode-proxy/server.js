import express from "express";

const app = express();
app.use(express.json({ limit: "1mb" }));

const PORT = process.env.PORT || 8787;
const PROXY_SECRET = process.env.LINODE_PROXY_SECRET;
const MTN_BASE_URL = "https://proxy.momoapi.mtn.com";

if (!PROXY_SECRET) {
  console.error("FATAL: LINODE_PROXY_SECRET env var is required");
  process.exit(1);
}

// Health check (no auth) — for nginx upstream + manual sanity check
app.get("/health", (_req, res) => {
  res.json({ ok: true, ts: new Date().toISOString() });
});

// Auth middleware for the transfer endpoint
function requireSecret(req, res, next) {
  const provided = req.header("x-proxy-secret");
  if (!provided || provided !== PROXY_SECRET) {
    console.warn(`[AUTH FAIL] from ${req.ip}`);
    return res.status(401).json({ error: "unauthorized" });
  }
  next();
}

/**
 * POST /mtn/transfer
 * Headers:
 *   x-proxy-secret: <shared secret>
 *   x-mtn-token: Bearer access token (obtained by edge function)
 *   x-mtn-reference-id: UUID for X-Reference-Id
 *   x-mtn-target-environment: e.g. mtnzambia
 *   x-mtn-subscription-key: MTN_MOMO_PRIMARY_KEY
 *   x-mtn-callback-url: optional
 * Body: MTN transfer payload (amount, currency, externalId, payee, payerMessage, payeeNote)
 *
 * Forwards to: POST {MTN_BASE_URL}/disbursement/v1_0/transfer
 */
app.post("/mtn/transfer", requireSecret, async (req, res) => {
  const token = req.header("x-mtn-token");
  const referenceId = req.header("x-mtn-reference-id");
  const targetEnv = req.header("x-mtn-target-environment");
  const subKey = req.header("x-mtn-subscription-key");
  const callbackUrl = req.header("x-mtn-callback-url");

  if (!token || !referenceId || !targetEnv || !subKey) {
    return res.status(400).json({
      error: "missing required headers",
      required: ["x-mtn-token", "x-mtn-reference-id", "x-mtn-target-environment", "x-mtn-subscription-key"],
    });
  }

  const headers = {
    Authorization: `Bearer ${token}`,
    "X-Reference-Id": referenceId,
    "X-Target-Environment": targetEnv,
    "Ocp-Apim-Subscription-Key": subKey,
    "Content-Type": "application/json",
  };
  if (callbackUrl) headers["X-Callback-Url"] = callbackUrl;

  try {
    console.log(`[TRANSFER] ref=${referenceId} -> MTN`);
    const mtnRes = await fetch(`${MTN_BASE_URL}/disbursement/v1_0/transfer`, {
      method: "POST",
      headers,
      body: JSON.stringify(req.body),
    });

    const text = await mtnRes.text();
    console.log(`[TRANSFER] ref=${referenceId} status=${mtnRes.status}`);

    res.status(mtnRes.status).json({
      mtnStatus: mtnRes.status,
      mtnBody: text,
      referenceId,
    });
  } catch (err) {
    console.error(`[TRANSFER ERROR] ref=${referenceId}:`, err);
    res.status(502).json({ error: "proxy fetch failed", message: String(err) });
  }
});

app.listen(PORT, () => {
  console.log(`MTN transfer proxy listening on :${PORT}`);
});
