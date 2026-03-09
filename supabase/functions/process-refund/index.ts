import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

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

async function requestRefund(
  token: string,
  config: MtnConfig,
  transaction: { id: string; amount: number; mtn_transaction_id: string; recipient_name: string },
): Promise<string> {
  const refundReferenceId = crypto.randomUUID();

  const res = await fetch(`${config.disbursementUrl}/v1_0/refund`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "X-Reference-Id": refundReferenceId,
      "X-Target-Environment": config.targetEnvironment,
      "Ocp-Apim-Subscription-Key": config.primaryKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      amount: transaction.amount.toString(),
      currency: config.currency,
      externalId: transaction.id,
      payerMessage: `Refund for ${transaction.recipient_name}`,
      payeeNote: `Refund for transaction ${transaction.id}`,
      referenceIdToRefund: transaction.mtn_transaction_id,
    }),
  });

  if (!res.ok && res.status !== 202) {
    throw new Error(`Refund request failed: ${res.status} ${await res.text()}`);
  }

  return refundReferenceId;
}

async function checkRefundStatus(
  token: string,
  config: MtnConfig,
  refundReferenceId: string,
): Promise<{ status: string; reason?: string }> {
  const res = await fetch(`${config.disbursementUrl}/v1_0/refund/${refundReferenceId}`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${token}`,
      "X-Target-Environment": config.targetEnvironment,
      "Ocp-Apim-Subscription-Key": config.primaryKey,
    },
  });

  if (!res.ok) {
    throw new Error(`Refund status check failed: ${res.status} ${await res.text()}`);
  }

  const data = await res.json();
  return { status: data.status, reason: data.reason?.message };
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { transactionId, requestedBy, requestedRole } = await req.json();
    if (!transactionId) throw new Error("transactionId is required");

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !serviceRoleKey) throw new Error("Backend credentials missing");

    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const { data: transaction, error: txError } = await supabase
      .from("transactions")
      .select("id, amount, status, mtn_transaction_id, recipient_name")
      .eq("id", transactionId)
      .single();

    if (txError || !transaction) throw new Error("Transaction not found");

    if (!["failed", "refund_failed"].includes(transaction.status)) {
      throw new Error("Only failed transactions can be refunded");
    }

    if (!transaction.mtn_transaction_id) {
      throw new Error("Cannot refund transaction without original transfer reference");
    }

    await supabase
      .from("transactions")
      .update({ status: "refund_processing", error_message: null })
      .eq("id", transaction.id);

    const config = getMtnConfig();
    const { apiUser, apiKey } = await getCredentials(config);
    const token = await getOAuthToken(config, apiUser, apiKey);

    const refundReferenceId = await requestRefund(token, config, {
      id: transaction.id,
      amount: Number(transaction.amount),
      mtn_transaction_id: transaction.mtn_transaction_id,
      recipient_name: transaction.recipient_name,
    });

    let finalStatus: "refunded" | "refund_failed" = "refund_failed";
    let errorMessage: string | null = "Refund status pending confirmation";

    for (let attempt = 0; attempt < 5; attempt++) {
      await sleep(2000);
      const statusResult = await checkRefundStatus(token, config, refundReferenceId);

      if (statusResult.status === "SUCCESSFUL") {
        finalStatus = "refunded";
        errorMessage = null;
        break;
      }

      if (statusResult.status === "FAILED") {
        finalStatus = "refund_failed";
        errorMessage = statusResult.reason || "Refund failed";
        break;
      }
    }

    await supabase
      .from("transactions")
      .update({
        status: finalStatus,
        error_message: errorMessage,
        processed_at: finalStatus === "refunded" ? new Date().toISOString() : null,
      })
      .eq("id", transaction.id);

    await supabase.from("audit_logs").insert({
      action: `${finalStatus === "refunded" ? "Refunded" : "Refund failed for"} transaction ${transaction.id}`,
      action_type: "refund",
      user_name: requestedBy || "Unknown",
      user_role: requestedRole || "approver",
      details: {
        refund_reference_id: refundReferenceId,
        original_transfer_reference: transaction.mtn_transaction_id,
        outcome: finalStatus,
        reason: errorMessage,
      },
    });

    return new Response(
      JSON.stringify({ success: finalStatus === "refunded", status: finalStatus, refundReferenceId, error: errorMessage }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
