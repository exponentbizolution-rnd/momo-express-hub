import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const MTN_BASE_URL = "https://sandbox.momodeveloper.mtn.com";
const MTN_DISBURSEMENT_URL = `${MTN_BASE_URL}/disbursement`;

async function getOAuthToken(primaryKey: string, apiUser: string, apiKey: string): Promise<string> {
  const credentials = btoa(`${apiUser}:${apiKey}`);
  const res = await fetch(`${MTN_DISBURSEMENT_URL}/token/`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${credentials}`,
      "Ocp-Apim-Subscription-Key": primaryKey,
    },
  });
  if (!res.ok) throw new Error(`OAuth token failed: ${res.status} ${await res.text()}`);
  const data = await res.json();
  return data.access_token;
}

async function provisionApiUser(primaryKey: string): Promise<{ apiUser: string; apiKey: string }> {
  const apiUser = crypto.randomUUID();

  // Create API User
  const createRes = await fetch(`${MTN_BASE_URL}/v1_0/apiuser`, {
    method: "POST",
    headers: {
      "X-Reference-Id": apiUser,
      "Ocp-Apim-Subscription-Key": primaryKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ providerCallbackHost: "https://callback.example.com" }),
  });
  if (!createRes.ok && createRes.status !== 201) {
    throw new Error(`Create API user failed: ${createRes.status} ${await createRes.text()}`);
  }

  // Generate API Key
  const keyRes = await fetch(`${MTN_BASE_URL}/v1_0/apiuser/${apiUser}/apikey`, {
    method: "POST",
    headers: { "Ocp-Apim-Subscription-Key": primaryKey },
  });
  if (!keyRes.ok && keyRes.status !== 201) {
    throw new Error(`Generate API key failed: ${keyRes.status} ${await keyRes.text()}`);
  }
  const keyData = await keyRes.json();

  return { apiUser, apiKey: keyData.apiKey };
}

async function transferFunds(
  token: string,
  primaryKey: string,
  txn: { mobile_number: string; amount: number; id: string; recipient_name: string },
  targetEnvironment: string
): Promise<{ referenceId: string }> {
  const referenceId = crypto.randomUUID();

  const res = await fetch(`${MTN_DISBURSEMENT_URL}/v1_0/transfer`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "X-Reference-Id": referenceId,
      "X-Target-Environment": targetEnvironment,
      "Ocp-Apim-Subscription-Key": primaryKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      amount: txn.amount.toString(),
      currency: "ZMW",
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
  primaryKey: string,
  referenceId: string,
  targetEnvironment: string
): Promise<{ status: string; reason?: string }> {
  const res = await fetch(`${MTN_DISBURSEMENT_URL}/v1_0/transfer/${referenceId}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      "X-Target-Environment": targetEnvironment,
      "Ocp-Apim-Subscription-Key": primaryKey,
    },
  });
  if (!res.ok) throw new Error(`Status check failed: ${res.status}`);
  const data = await res.json();
  return { status: data.status, reason: data.reason?.message };
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { batchId } = await req.json();
    if (!batchId) throw new Error("batchId is required");

    const primaryKey = Deno.env.get("MTN_MOMO_PRIMARY_KEY");
    if (!primaryKey) throw new Error("MTN_MOMO_PRIMARY_KEY not configured");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const targetEnvironment = "sandbox";

    // Provision API User & Key on the fly (sandbox)
    console.log("Provisioning MTN API User...");
    const { apiUser, apiKey } = await provisionApiUser(primaryKey);
    console.log("API User provisioned:", apiUser);

    // Get OAuth token
    console.log("Getting OAuth token...");
    const token = await getOAuthToken(primaryKey, apiUser, apiKey);
    console.log("OAuth token obtained");

    // Update batch status to processing
    await supabase.from("batches").update({ status: "processing" }).eq("id", batchId);

    // Get all pending transactions for this batch
    const { data: transactions, error: txError } = await supabase
      .from("transactions")
      .select("*")
      .eq("batch_id", batchId)
      .eq("status", "pending");

    if (txError) throw txError;
    if (!transactions || transactions.length === 0) {
      throw new Error("No pending transactions found for this batch");
    }

    let successCount = 0;
    let failCount = 0;

    for (const txn of transactions) {
      try {
        // Update transaction to processing
        await supabase.from("transactions").update({ status: "processing" }).eq("id", txn.id);

        // Initiate transfer
        const { referenceId } = await transferFunds(token, primaryKey, txn, targetEnvironment);

        // Wait and check status (with retries)
        let finalStatus = "pending";
        let reason: string | undefined;
        for (let attempt = 0; attempt < 5; attempt++) {
          await sleep(2000);
          const statusResult = await checkTransferStatus(token, primaryKey, referenceId, targetEnvironment);
          if (statusResult.status === "SUCCESSFUL") {
            finalStatus = "completed";
            break;
          } else if (statusResult.status === "FAILED") {
            finalStatus = "failed";
            reason = statusResult.reason;
            break;
          }
          // Still pending, wait longer on next attempt
        }

        if (finalStatus === "completed") {
          await supabase
            .from("transactions")
            .update({
              status: "completed",
              mtn_transaction_id: referenceId,
              processed_at: new Date().toISOString(),
            })
            .eq("id", txn.id);
          successCount++;
        } else {
          await supabase
            .from("transactions")
            .update({
              status: "failed",
              mtn_transaction_id: referenceId,
              error_message: reason || `Transfer status: ${finalStatus}`,
              retry_count: txn.retry_count + 1,
            })
            .eq("id", txn.id);
          failCount++;
        }

        // Rate limiting: ~10 req/s
        await sleep(100);
      } catch (txnError) {
        console.error(`Transaction ${txn.id} failed:`, txnError);
        await supabase
          .from("transactions")
          .update({
            status: "failed",
            error_message: txnError instanceof Error ? txnError.message : "Unknown error",
            retry_count: txn.retry_count + 1,
          })
          .eq("id", txn.id);
        failCount++;
      }
    }

    // Update batch final status
    const batchStatus = failCount === 0 ? "completed" : successCount === 0 ? "failed" : "partially_completed";
    await supabase.from("batches").update({ status: batchStatus }).eq("id", batchId);

    // Audit log
    await supabase.from("audit_logs").insert({
      action: `Processed disbursements for batch ${batchId}: ${successCount} success, ${failCount} failed`,
      action_type: "disburse",
      user_name: "System",
      user_role: "system",
    });

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
