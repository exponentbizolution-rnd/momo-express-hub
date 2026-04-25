import { getMtnCredentials } from "../_shared/mtn-credentials.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

async function getMtnConfig() {
  const creds = await getMtnCredentials();
  const primaryKey = creds.MTN_MOMO_PRIMARY_KEY;
  if (!primaryKey) throw new Error("MTN_MOMO_PRIMARY_KEY not configured");

  const baseUrl = "https://proxy.momoapi.mtn.com";
  return {
    baseUrl,
    disbursementUrl: `${baseUrl}/disbursement`,
    targetEnvironment: Deno.env.get("MTN_TARGET_ENVIRONMENT") || "zambia",
    currency: "ZMW",
    primaryKey,
  };
}

async function getCredentials(): Promise<{ apiUser: string; apiKey: string }> {
  const creds = await getMtnCredentials();
  const apiUser = creds.MTN_API_USER;
  const apiKey = creds.MTN_API_KEY;
  if (!apiUser || !apiKey) {
    throw new Error("MTN_API_USER and MTN_API_KEY secrets are required");
  }
  return { apiUser, apiKey };
}

async function getOAuthToken(config: Awaited<ReturnType<typeof getMtnConfig>>, apiUser: string, apiKey: string): Promise<string> {
  const credentials = btoa(`${apiUser}:${apiKey}`);
  const res = await fetch(`${config.disbursementUrl}/token/`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${credentials}`,
      "Ocp-Apim-Subscription-Key": config.primaryKey,
    },
  });
  if (!res.ok) throw new Error(`OAuth token failed: ${res.status} ${await res.text()}`);
  const data = await res.json();
  return data.access_token;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Missing Authorization header");

    const config = await getMtnConfig();
    const { apiUser, apiKey } = await getCredentials();
    const token = await getOAuthToken(config, apiUser, apiKey);

    const res = await fetch(`${config.disbursementUrl}/v1_0/account/balance`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`,
        "X-Target-Environment": config.targetEnvironment,
        "Ocp-Apim-Subscription-Key": config.primaryKey,
      },
    });

    if (!res.ok) {
      throw new Error(`Balance lookup failed: ${res.status} ${await res.text()}`);
    }

    const data = await res.json();
    const availableBalance = Number.parseFloat(data.availableBalance || "0");

    return new Response(
      JSON.stringify({
        success: true,
        availableBalance,
        currency: data.currency || config.currency,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : "Unknown error" }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
