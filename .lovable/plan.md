

## Problem

When a Payment Initiator uploads a CSV and creates a batch, the Payment Approver can see the batch in the Batches list and approve/reject it. However, two gaps exist:

1. **BatchDetail page has no approve/reject buttons** -- the approver must go back to the list to approve. They should be able to approve directly from the detail view after reviewing transactions.
2. **CSV content is not visible to the approver** -- the `csv_content` is stored in the database but never displayed, so the approver can't review the original uploaded file.

## Plan

### 1. Add approve/reject actions to BatchDetail page
- Add approve and reject buttons to the BatchDetail header when the batch is `pending` and the user has the approver/super_admin role
- Reuse the same mutation logic from Batches.tsx (wallet balance check, dual authorization, trigger disbursements)

### 2. Show original CSV content on BatchDetail
- Add a collapsible section below the summary cards that displays the raw CSV content stored in `batch.csv_content`
- Render it in a `<pre>` block or simple table so the approver can verify the original file before approving

### 3. Files to modify
- **`src/pages/BatchDetail.tsx`**: Add approve/reject buttons in the header area, add wallet balance query, add CSV viewer section

No database or RLS changes needed -- the existing policies already allow approvers to view batches/transactions and update batch status.

