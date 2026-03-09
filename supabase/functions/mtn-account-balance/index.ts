

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface MtnConfig {
  baseUrl: string;
  disbursementUrl: string;
  targetEnvironment: string;
  currency: string;
  primaryKey: string;
  isProduction: boolean;
}

function getMtnConfig(): MtnConfig {
  const isProduction = Deno.env.get("MTN_ENVIRONMENT") === "production";
  const primaryKey = Deno.env.get("MTN_MOMO_PRIMARY_KEY");
  if (!primaryKey) throw new Error("MTN_MOMO_PRIMARY_KEY not configured");

  const baseUrl = isProduction
    ? "https://momodeveloper.mtn.com"
    : "https://sandbox.momodeveloper.mtn.com";

  return {
    baseUrl,
    disbursementUrl: `${baseUrl}/disbursement`,
    targetEnvironment: isProduction ? Deno.env.get("MTN_TARGET_ENVIRONMENT") || "zambia" : "sandbox",
    currency: isProduction ? "ZMW" : "EUR",
    primaryKey,
    isProduction,
  };
}

async function getCredentials(config: MtnConfig): Promise<{ apiUser: string; apiKey: string }> {
  if (config.isProduction) {
    const apiUser = Deno.env.get("MTN_API_USER");
    const apiKey = Deno.env.get("MTN_API_KEY");
    if (!apiUser || !apiKey) {
      throw new Error("Production requires MTN_API_USER and MTN_API_KEY secrets");
    }
    return { apiUser, apiKey };
  }

  const apiUser = crypto.randomUUID();
  const callbackHost = Deno.env.get("MTN_CALLBACK_URL") || "https://callback.example.com";

  const createRes = await fetch(`${config.baseUrl}/v1_0/apiuser`, {
    method: "POST",
    headers: {
      "X-Reference-Id": apiUser,
      "Ocp-Apim-Subscription-Key": config.primaryKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ providerCallbackHost: callbackHost }),
  });

  if (!createRes.ok && createRes.status !== 201) {
    throw new Error(`Create API user failed: ${createRes.status} ${await createRes.text()}`);
  }

  const keyRes = await fetch(`${config.baseUrl}/v1_0/apiuser/${apiUser}/apikey`, {
    method: "POST",
    headers: { "Ocp-Apim-Subscription-Key": config.primaryKey },
  });

  if (!keyRes.ok && keyRes.status !== 201) {
    throw new Error(`Generate API key failed: ${keyRes.status} ${await keyRes.text()}`);
  }

  const keyData = await keyRes.json();
  return { apiUser, apiKey: keyData.apiKey };
}

async function getOAuthToken(config: MtnConfig, apiUser: string, apiKey: string): Promise<string> {
  const credentials = btoa(`${apiUser}:${apiKey}`);
  const res = await fetch(`${config.disbursementUrl}/token/`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${credentials}`,
      "Ocp-Apim-Subscription-Key": config.primaryKey,
    },
  });

  if (!res.ok) {
    throw new Error(`OAuth token failed: ${res.status} ${await res.text()}`);
  }

  const data = await res.json();
  return data.access_token;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // Ensure requester is authenticated
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Missing Authorization header");

    const config = getMtnConfig();
    const { apiUser, apiKey } = await getCredentials(config);
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
