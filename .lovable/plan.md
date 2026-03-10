

## Problem

The phone validation regex (`/^260\d{9}$/`) and phone parsing only strip whitespace. If the CSV contains numbers with `+260...`, leading zeros (`0975...`), or other common formats, all records fail validation.

## Plan

**File: `src/pages/BulkUpload.tsx`**

1. **Normalize phone numbers during parsing** (around line 131): After trimming and removing whitespace, also:
   - Strip leading `+` (so `+260975123456` becomes `260975123456`)
   - Convert local format `09...` or `097...` (10 digits starting with 0) to `260...` by replacing leading `0` with `260`
   - Strip any dashes or parentheses

2. The `validatePhone` function on line 31 stays as-is -- the normalization happens before it runs.

### Technical detail

```
// Current (line 131):
const phone = (raw["Mobile Number"] || "").trim().replace(/\s/g, "");

// New:
let phone = (raw["Mobile Number"] || "").trim().replace(/[\s\-\(\)]/g, "");
if (phone.startsWith("+")) phone = phone.slice(1);
if (/^0\d{9}$/.test(phone)) phone = "260" + phone.slice(1);
```

This handles `+260975123456`, `0975123456`, `260 975 123 456`, and `260-975-123-456` -- all normalize to `260975123456`.

