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

  const targetEnvironment = isProduction
    ? Deno.env.get("MTN_TARGET_ENVIRONMENT") || "zambia"
    : "sandbox";

  const currency = isProduction ? "ZMW" : "EUR";

  return {
    baseUrl,
    disbursementUrl: `${baseUrl}/disbursement`,
    targetEnvironment,
    currency,
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

  // Sandbox: auto-provision
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
  if (!res.ok) throw new Error(`OAuth token failed: ${res.status} ${await res.text()}`);
  const data = await res.json();
  return data.access_token;
}

async function transferFunds(
  token: string,
  config: MtnConfig,
  txn: { mobile_number: string; amount: number; id: string; recipient_name: string }
): Promise<{ referenceId: string }> {
  const referenceId = crypto.randomUUID();
  const callbackUrl = Deno.env.get("MTN_CALLBACK_URL");

  const headers: Record<string, string> = {
    Authorization: `Bearer ${token}`,
    "X-Reference-Id": referenceId,
    "X-Target-Environment": config.targetEnvironment,
    "Ocp-Apim-Subscription-Key": config.primaryKey,
    "Content-Type": "application/json",
  };
  if (callbackUrl && config.isProduction) {
    headers["X-Callback-Url"] = callbackUrl;
  }

  const res = await fetch(`${config.disbursementUrl}/v1_0/transfer`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      amount: txn.amount.toString(),
      currency: config.currency,
      externalId: txn.id,
      payee: { partyIdType: "MSISDN", partyId: txn.mobile_number },
      payerMessage: `Payment to ${txn.recipient_name}`,
      payeeNote: `Disbursement ${txn.id}`,
    }),
  });

  if (!res.ok && res.status !== 202) {
    const errText = await res.text();
    throw new Error(`Transfer failed: ${res.status} ${errText}`);
  }

  return { referenceId };
}

async function checkTransferStatus(
  token: string,
  config: MtnConfig,
  referenceId: string
): Promise<{ status: string; reason?: string }> {
  const res = await fetch(`${config.disbursementUrl}/v1_0/transfer/${referenceId}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      "X-Target-Environment": config.targetEnvironment,
      "Ocp-Apim-Subscription-Key": config.primaryKey,
    },
  });
  if (!res.ok) throw new Error(`Status check failed: ${res.status}`);
  const data = await res.json();
  return { status: data.status, reason: data.reason?.message };
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function dbUpdate(
  supabase: ReturnType<typeof createClient>,
  table: string,
  data: Record<string, unknown>,
  matchColumn: string,
  matchValue: string,
  context: string
) {
  const { error } = await supabase.from(table).update(data).eq(matchColumn, matchValue);
  if (error) {
    console.error(`[DB UPDATE FAILED] ${context}:`, JSON.stringify(error));
    throw new Error(`DB update failed (${context}): ${error.message}`);
  }
  console.log(`[DB UPDATE OK] ${context}`);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { batchId } = await req.json();
    if (!batchId) throw new Error("batchId is required");

    const config = getMtnConfig();
    console.log(`Running in ${config.isProduction ? "PRODUCTION" : "SANDBOX"} mode`);
    console.log(`Target: ${config.targetEnvironment}, Currency: ${config.currency}`);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get credentials (auto-provision for sandbox, read secrets for production)
    console.log(config.isProduction ? "Reading production credentials..." : "Provisioning sandbox API User...");
    const { apiUser, apiKey } = await getCredentials(config);

    // Get OAuth token
    console.log("Getting OAuth token...");
    const token = await getOAuthToken(config, apiUser, apiKey);
    console.log("OAuth token obtained");

    // Update batch status to processing
    await dbUpdate(supabase, "batches", { status: "processing" }, "id", batchId, `batch ${batchId} -> processing`);

    // Get all pending transactions for this batch
    const { data: transactions, error: txError } = await supabase
      .from("transactions")
      .select("*")
      .eq("batch_id", batchId)
      .eq("status", "pending");

    if (txError) throw txError;
    if (!transactions || transactions.length === 0) {
      console.log("No pending transactions found");
      return new Response(JSON.stringify({ success: true, message: "No pending transactions" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`Found ${transactions.length} pending transactions`);

    let successCount = 0;
    let failCount = 0;

    for (const txn of transactions) {
      try {
        console.log(`[Txn ${txn.id}] Processing -> ${txn.mobile_number}, amount: ${txn.amount}`);
        await dbUpdate(supabase, "transactions", { status: "processing" }, "id", txn.id, `txn ${txn.id} -> processing`);

        const { referenceId } = await transferFunds(token, config, txn);
        console.log(`[Txn ${txn.id}] Transfer initiated, ref: ${referenceId}`);

        let finalStatus = "pending";
        let reason: string | undefined;
        for (let attempt = 0; attempt < 5; attempt++) {
          await sleep(2000);
          const statusResult = await checkTransferStatus(token, config, referenceId);
          console.log(`[Txn ${txn.id}] Status check ${attempt + 1}/5: ${statusResult.status}`);
          if (statusResult.status === "SUCCESSFUL") {
            finalStatus = "completed";
            break;
          } else if (statusResult.status === "FAILED") {
            finalStatus = "failed";
            reason = statusResult.reason;
            break;
          }
        }

        if (finalStatus === "completed") {
          await dbUpdate(supabase, "transactions", {
            status: "completed",
            mtn_transaction_id: referenceId,
            processed_at: new Date().toISOString(),
          }, "id", txn.id, `txn ${txn.id} -> completed`);
          successCount++;
        } else {
          await dbUpdate(supabase, "transactions", {
            status: "failed",
            mtn_transaction_id: referenceId,
            error_message: reason || `Transfer status: ${finalStatus}`,
            retry_count: txn.retry_count + 1,
          }, "id", txn.id, `txn ${txn.id} -> failed`);
          failCount++;
        }

        await sleep(100);
      } catch (txnError) {
        const errMsg = txnError instanceof Error ? txnError.message : "Unknown error";
        console.error(`[Txn ${txn.id}] ERROR:`, errMsg);
        try {
          await dbUpdate(supabase, "transactions", {
            status: "failed",
            error_message: errMsg,
            retry_count: txn.retry_count + 1,
          }, "id", txn.id, `txn ${txn.id} -> failed (recovery)`);
        } catch (updateErr) {
          console.error(`[Txn ${txn.id}] Failed to update after error:`, updateErr);
        }
        failCount++;
      }
    }

    const batchStatus = failCount === 0 ? "completed" : successCount === 0 ? "failed" : "partially_completed";
    await dbUpdate(supabase, "batches", { status: batchStatus }, "id", batchId, `batch ${batchId} -> ${batchStatus}`);

    await supabase.from("audit_logs").insert({
      action: `Processed disbursements (${config.isProduction ? "PRODUCTION" : "SANDBOX"}) for batch ${batchId}: ${successCount} success, ${failCount} failed`,
      action_type: "disburse",
      user_name: "System",
      user_role: "system",
    });

    console.log(`Batch ${batchId} complete: ${successCount} success, ${failCount} failed`);

    return new Response(
      JSON.stringify({ success: true, processed: transactions.length, successCount, failCount, status: batchStatus }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Disbursement error:", error);
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
