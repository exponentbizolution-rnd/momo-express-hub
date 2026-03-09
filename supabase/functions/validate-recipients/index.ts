const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface MtnConfig {
  baseUrl: string;
  disbursementUrl: string;
  targetEnvironment: string;
  primaryKey: string;
  isProduction: boolean;
}

interface RecipientInput {
  row: number;
  phone: string;
}

interface ValidationResult {
  row: number;
  phone: string;
  valid: boolean | null;
  checked: boolean;
  reason?: string;
}

const MAX_VALIDATIONS = 250;

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

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function validatePhone(
  token: string,
  config: MtnConfig,
  phone: string,
): Promise<{ valid: boolean; reason?: string }> {
  const res = await fetch(
    `${config.disbursementUrl}/v1_0/accountholder/MSISDN/${encodeURIComponent(phone)}/basicuserinfo`,
    {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`,
        "X-Target-Environment": config.targetEnvironment,
        "Ocp-Apim-Subscription-Key": config.primaryKey,
      },
    },
  );

  if (res.ok) {
    const data = await res.json();
    if (data?.status && data.status !== "ACTIVE") {
      return { valid: false, reason: `Account status: ${data.status}` };
    }
    return { valid: true };
  }

  if (res.status === 404) {
    return { valid: false, reason: "Wallet account not found" };
  }

  if (res.status === 401) {
    throw new Error("Recipient validation authorization failed");
  }

  const errText = await res.text();
  return { valid: false, reason: `Validation failed: ${res.status} ${errText || "Unknown error"}` };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const payload = await req.json();
    const recipients = Array.isArray(payload?.recipients) ? payload.recipients as RecipientInput[] : [];

    if (recipients.length === 0) {
      return new Response(
        JSON.stringify({ success: true, results: [], truncated: false, validatedCount: 0, totalRequested: 0 }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const normalized = recipients
      .map((r) => ({ row: Number(r.row), phone: String(r.phone || "").replace(/\s/g, "") }))
      .filter((r) => Number.isFinite(r.row) && r.row > 0 && r.phone.length > 0);

    const uniquePhones = [...new Set(normalized.map((r) => r.phone))];
    const phonesToValidate = uniquePhones.slice(0, MAX_VALIDATIONS);
    const truncated = uniquePhones.length > MAX_VALIDATIONS;

    const config = getMtnConfig();
    const { apiUser, apiKey } = await getCredentials(config);
    const token = await getOAuthToken(config, apiUser, apiKey);

    const phoneResults = new Map<string, { valid: boolean; reason?: string }>();

    for (const phone of phonesToValidate) {
      const result = await validatePhone(token, config, phone);
      phoneResults.set(phone, result);
      await sleep(120);
    }

    const results: ValidationResult[] = normalized.map((recipient) => {
      const validation = phoneResults.get(recipient.phone);

      if (!validation) {
        return {
          row: recipient.row,
          phone: recipient.phone,
          valid: null,
          checked: false,
          reason: "Validation skipped due high record volume",
        };
      }

      return {
        row: recipient.row,
        phone: recipient.phone,
        valid: validation.valid,
        checked: true,
        reason: validation.reason,
      };
    });

    return new Response(
      JSON.stringify({
        success: true,
        results,
        truncated,
        validatedCount: phonesToValidate.length,
        totalRequested: uniquePhones.length,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
