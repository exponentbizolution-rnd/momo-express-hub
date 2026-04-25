import { getMtnCredentials } from "../_shared/mtn-credentials.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const creds = await getMtnCredentials();
    const primaryKey = creds.MTN_MOMO_PRIMARY_KEY;
    const targetEnv = Deno.env.get("MTN_TARGET_ENVIRONMENT") || "zambia";
    const apiUser = creds.MTN_API_USER;
    const apiKey = creds.MTN_API_KEY;

    const results: Record<string, unknown> = {
      success: false,
      environment: "production",
      secretsConfigured: {
        primaryKey: !!primaryKey,
        targetEnv: !!Deno.env.get("MTN_TARGET_ENVIRONMENT"),
        apiUser: !!apiUser,
        apiKey: !!apiKey,
      },
    };

    if (!primaryKey || !apiUser || !apiKey) {
      return new Response(
        JSON.stringify({
          ...results,
          tokenError: "Missing required secrets (MTN_MOMO_PRIMARY_KEY, MTN_API_USER, MTN_API_KEY)",
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const baseUrl = "https://proxy.momoapi.mtn.com";

    // Test 1: Token generation
    const tokenStart = Date.now();
    const credentials = btoa(`${apiUser}:${apiKey}`);

    const tokenRes = await fetch(`${baseUrl}/disbursement/token/`, {
      method: "POST",
      headers: {
        Authorization: `Basic ${credentials}`,
        "Ocp-Apim-Subscription-Key": primaryKey,
      },
    });

    results.tokenLatency = Date.now() - tokenStart;

    if (!tokenRes.ok) {
      const errText = await tokenRes.text();
      results.tokenError = `Token request failed: ${tokenRes.status} - ${errText}`;
      return new Response(JSON.stringify(results), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const tokenData = await tokenRes.json();
    const accessToken = tokenData.access_token;
    results.accessToken = accessToken;
    results.tokenType = tokenData.token_type;
    results.tokenExpiresIn = tokenData.expires_in;

    // Test 2: Balance API
    const balanceStart = Date.now();
    const balanceRes = await fetch(
      `${baseUrl}/disbursement/v1_0/account/balance`,
      {
        method: "GET",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "X-Target-Environment": targetEnv,
          "Ocp-Apim-Subscription-Key": primaryKey,
        },
      }
    );

    results.balanceLatency = Date.now() - balanceStart;

    if (!balanceRes.ok) {
      const errText = await balanceRes.text();
      results.balanceError = `Balance request failed: ${balanceRes.status} - ${errText}`;
      results.success = true; // Token worked at least
      return new Response(JSON.stringify(results), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const balanceData = await balanceRes.json();
    results.balance = balanceData;
    results.success = true;

    return new Response(JSON.stringify(results), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
