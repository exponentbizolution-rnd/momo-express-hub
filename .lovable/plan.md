

## Findings: Data Inconsistency Detected

Looking at the network responses, there is a clear problem:

- **Batch B-2841** has `status: "completed"` -- suggesting the edge function ran
- **All 3 transactions** are stuck at `status: "processing"` -- meaning the edge function updated them to "processing" but never completed or failed them
- The dashboard queries for `status=eq.success` (transactions) which returns 0 results, because transaction statuses use "completed" not "success"

This means the disbursement edge function likely hit an error mid-processing (after marking transactions as "processing" but before updating their final status).

## Plan

### 1. Fix stuck transaction data
Run a database migration to reset the 3 stuck "processing" transactions back to "pending" so they can be re-processed:
```sql
UPDATE transactions SET status = 'pending' WHERE batch_id = 'f0d010b4-a50d-4a1d-9e98-062c045b47ed' AND status = 'processing';
UPDATE batches SET status = 'pending', approved_by = NULL, approver_user_id = NULL, approved_at = NULL WHERE id = 'f0d010b4-a50d-4a1d-9e98-062c045b47ed';
```

### 2. Fix Dashboard status mismatch
The Dashboard queries for `status=eq.success` but transactions use `status = "completed"`. Update the dashboard query to match the actual status values used by the edge function.

### 3. Add edge function error logging
Add more granular console logging in the `process-disbursements` edge function to capture exactly where failures occur during the MTN API calls.

### 4. Re-test the flow
After fixes, log in as the approver (Daliso) and approve batch B-2841 to trigger disbursements and verify transactions transition through `pending -> processing -> completed/failed`.

---

### Technical Details

**Dashboard fix** (`src/pages/Dashboard.tsx`): Change the transaction count query from `status=eq.success` to `status=eq.completed` to match the actual status values written by the edge function.

**Edge function**: The current function provisions a new MTN API user each time, gets an OAuth token, then processes sequentially. Errors during the MTN sandbox API calls (token, transfer, or status check) cause transactions to remain stuck in "processing". Adding a try/catch around the status update after errors will prevent this.

