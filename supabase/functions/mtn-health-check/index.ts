import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const primaryKey = Deno.env.get("MTN_MOMO_PRIMARY_KEY");
    const targetEnv = Deno.env.get("MTN_TARGET_ENVIRONMENT") || "sandbox";

    const results: {
      success: boolean;
      environment: string;
      secretsConfigured: { primaryKey: boolean; targetEnv: boolean };
      tokenLatency?: number;
      balanceLatency?: number;
      balance?: { availableBalance: string; currency: string };
      tokenError?: string;
      balanceError?: string;
    } = {
      success: false,
      environment: targetEnv,
      secretsConfigured: {
        primaryKey: !!primaryKey,
        targetEnv: !!Deno.env.get("MTN_TARGET_ENVIRONMENT"),
      },
    };

    if (!primaryKey) {
      return new Response(
        JSON.stringify({
          ...results,
          tokenError: "MTN_MOMO_PRIMARY_KEY not configured",
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Generate API User and Key for sandbox
    const apiUser = crypto.randomUUID();
    const baseUrl =
      targetEnv === "sandbox"
        ? "https://sandbox.momodeveloper.mtn.com"
        : "https://momodeveloper.mtn.com";

    // For sandbox: create API user
    if (targetEnv === "sandbox") {
      await fetch(`${baseUrl}/v1_0/apiuser`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Reference-Id": apiUser,
          "Ocp-Apim-Subscription-Key": primaryKey,
        },
        body: JSON.stringify({ providerCallbackHost: "https://example.com" }),
      });

      await fetch(`${baseUrl}/v1_0/apiuser/${apiUser}/apikey`, {
        method: "POST",
        headers: {
          "Ocp-Apim-Subscription-Key": primaryKey,
        },
      });
    }

    // Get API key
    const apiKeyRes = await fetch(
      `${baseUrl}/v1_0/apiuser/${apiUser}/apikey`,
      {
        method: "POST",
        headers: {
          "Ocp-Apim-Subscription-Key": primaryKey,
        },
      }
    );
    const apiKeyData = await apiKeyRes.json();
    const apiKey = apiKeyData.apiKey;

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
        error: error.message,
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
