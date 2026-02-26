

## Analysis

The database currently has **zero batches**. The RLS policies are correctly configured — `Authenticated users can view batches` with `USING (true)` means approvers CAN see all batches. The code in `Batches.tsx` queries all batches without any role-based filtering.

**Root cause**: No batches have been successfully uploaded yet. The system is working correctly — there's simply no data to display.

## Plan

No backend or RLS changes needed. Two small UI improvements:

### 1. Update empty state message for approvers (`src/pages/Batches.tsx`)
- When `canApprove` is true and there are no batches, show: "No pending batches. Batches uploaded by initiators will appear here for your review."
- When the user is an initiator, keep the current message about uploading a CSV.

### 2. Verify upload works by checking `BulkUpload.tsx` 
- The upload code looks correct. If the initiator is getting a silent error, it could be a `batch_number` trigger issue or a role mismatch. No code change needed unless testing reveals an error.

**To test**: Log in as the initiator, upload a CSV, confirm the batch appears in the database, then log in as the approver and confirm it appears on the Batches page.

