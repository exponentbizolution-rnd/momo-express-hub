

## Root Cause

The edge function and the database have mismatched allowed values:

1. **Transactions table**: The check constraint allows `'success'` but the edge function writes `'completed'` -- every successful MTN transfer gets rejected by the DB.
2. **Audit logs table**: The check constraint doesn't include `'disburse'` as an action type, so the audit log insert also fails.

The MTN sandbox API calls are actually succeeding -- the transfers go through and return `SUCCESSFUL`. But the DB rejects the status updates, causing all transactions to fall into the error recovery path and get marked as `failed`.

## Plan

### 1. Database migration
Update the check constraints to accept the values the edge function uses:

- **transactions**: Replace `'success'` with `'completed'` and add `'partially_completed'` to match the edge function's status values
- **audit_logs**: Add `'disburse'` to the allowed `action_type` values

### 2. Reset stuck test data
Reset the batch and transactions back to `pending` so they can be re-processed with the fixed constraints.

### 3. Re-test
Approve the batch again to trigger disbursements -- this time the DB will accept the status updates.

No edge function changes needed -- the function logic is correct, it's the DB constraints that are too restrictive.

