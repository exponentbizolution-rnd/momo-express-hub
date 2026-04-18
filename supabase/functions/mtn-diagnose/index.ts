const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const diagnostics: Record<string, unknown> = {
    timestamp: new Date().toISOString(),
  };

  try {
    const primaryKey = Deno.env.get("MTN_MOMO_PRIMARY_KEY") || "";
    const secondaryKey = Deno.env.get("MTN_MOMO_SECONDARY_KEY") || "";
    const targetEnv = Deno.env.get("MTN_TARGET_ENVIRONMENT") || "";
    const apiUser = Deno.env.get("MTN_API_USER") || "";
    const apiKey = Deno.env.get("MTN_API_KEY") || "";

    const mask = (v: string) =>
      v ? `${v.slice(0, 4)}…${v.slice(-4)} (len=${v.length})` : "(missing)";

    diagnostics.secrets = {
      MTN_MOMO_PRIMARY_KEY: mask(primaryKey),
      MTN_MOMO_SECONDARY_KEY: mask(secondaryKey),
      MTN_TARGET_ENVIRONMENT: targetEnv || "(missing)",
      MTN_API_USER: mask(apiUser),
      MTN_API_KEY: mask(apiKey),
    };

    if (!primaryKey || !apiUser || !apiKey) {
      diagnostics.error =
        "Missing required secrets. Need MTN_MOMO_PRIMARY_KEY, MTN_API_USER, MTN_API_KEY.";
      return new Response(JSON.stringify(diagnostics), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const baseUrl = "https://proxy.momoapi.mtn.com";
    const tokenUrl = `${baseUrl}/disbursement/token/`;
    const credentials = btoa(`${apiUser}:${apiKey}`);

    // Step 1: Validate that the API User exists & is provisioned for this subscription key
    const apiUserUrl = `${baseUrl}/v1_0/apiuser/${apiUser}`;
    const apiUserHeaders = {
      "Ocp-Apim-Subscription-Key": primaryKey,
    };

    diagnostics.step1_apiUserCheck = {
      method: "GET",
      url: apiUserUrl,
      headers: { "Ocp-Apim-Subscription-Key": mask(primaryKey) },
    };

    try {
      const t0 = Date.now();
      const apiUserRes = await fetch(apiUserUrl, {
        method: "GET",
        headers: apiUserHeaders,
      });
      const apiUserText = await apiUserRes.text();
      (diagnostics.step1_apiUserCheck as Record<string, unknown>).response = {
        status: apiUserRes.status,
        statusText: apiUserRes.statusText,
        latencyMs: Date.now() - t0,
        headers: Object.fromEntries(apiUserRes.headers.entries()),
        body: apiUserText,
      };
    } catch (e) {
      (diagnostics.step1_apiUserCheck as Record<string, unknown>).fetchError =
        e instanceof Error ? e.message : String(e);
    }

    // Step 2: Token request — primary key
    diagnostics.step2_tokenPrimary = {
      method: "POST",
      url: tokenUrl,
      headers: {
        Authorization: `Basic ${apiUser.slice(0, 4)}…:${"*".repeat(8)} (base64-encoded)`,
        "Ocp-Apim-Subscription-Key": mask(primaryKey),
      },
      body: "(empty)",
    };

    try {
      const t0 = Date.now();
      const tokenRes = await fetch(tokenUrl, {
        method: "POST",
        headers: {
          Authorization: `Basic ${credentials}`,
          "Ocp-Apim-Subscription-Key": primaryKey,
        },
      });
      const tokenText = await tokenRes.text();
      (diagnostics.step2_tokenPrimary as Record<string, unknown>).response = {
        status: tokenRes.status,
        statusText: tokenRes.statusText,
        latencyMs: Date.now() - t0,
        headers: Object.fromEntries(tokenRes.headers.entries()),
        body: tokenText,
      };

      // Step 3: If token worked, try balance with each candidate X-Target-Environment
      if (tokenRes.ok) {
        const tokenData = JSON.parse(tokenText);
        const accessToken = tokenData.access_token;
        const candidates = Array.from(
          new Set([targetEnv, "mtnzambia", "mtnzm", "zambia", "production"].filter(Boolean))
        );

        const balanceResults: Record<string, unknown>[] = [];
        for (const env of candidates) {
          const balanceUrl = `${baseUrl}/disbursement/v1_0/account/balance`;
          const t1 = Date.now();
          try {
            const balanceRes = await fetch(balanceUrl, {
              method: "GET",
              headers: {
                Authorization: `Bearer ${accessToken}`,
                "X-Target-Environment": env,
                "Ocp-Apim-Subscription-Key": primaryKey,
              },
            });
            const balanceText = await balanceRes.text();
            balanceResults.push({
              targetEnvironment: env,
              status: balanceRes.status,
              latencyMs: Date.now() - t1,
              body: balanceText,
            });
          } catch (e) {
            balanceResults.push({
              targetEnvironment: env,
              fetchError: e instanceof Error ? e.message : String(e),
            });
          }
        }
        diagnostics.step3_balanceProbes = balanceResults;
      }
    } catch (e) {
      (diagnostics.step2_tokenPrimary as Record<string, unknown>).fetchError =
        e instanceof Error ? e.message : String(e);
    }

    // Step 4: Token request — secondary key (if different)
    if (secondaryKey && secondaryKey !== primaryKey) {
      diagnostics.step4_tokenSecondary = {
        method: "POST",
        url: tokenUrl,
        headers: {
          Authorization: `Basic ${apiUser.slice(0, 4)}…:${"*".repeat(8)}`,
          "Ocp-Apim-Subscription-Key": mask(secondaryKey),
        },
      };
      try {
        const t0 = Date.now();
        const tokenRes2 = await fetch(tokenUrl, {
          method: "POST",
          headers: {
            Authorization: `Basic ${credentials}`,
            "Ocp-Apim-Subscription-Key": secondaryKey,
          },
        });
        const tokenText2 = await tokenRes2.text();
        (diagnostics.step4_tokenSecondary as Record<string, unknown>).response = {
          status: tokenRes2.status,
          statusText: tokenRes2.statusText,
          latencyMs: Date.now() - t0,
          headers: Object.fromEntries(tokenRes2.headers.entries()),
          body: tokenText2,
        };
      } catch (e) {
        (diagnostics.step4_tokenSecondary as Record<string, unknown>).fetchError =
          e instanceof Error ? e.message : String(e);
      }
    }

    return new Response(JSON.stringify(diagnostics, null, 2), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    diagnostics.fatalError =
      error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify(diagnostics), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
