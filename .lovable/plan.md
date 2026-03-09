

## Analysis: MTN MoMo API Coverage

### Currently Implemented
| Endpoint | Status |
|----------|--------|
| `POST /disbursement/token/` | ✅ OAuth token |
| `POST /disbursement/v1_0/transfer` | ✅ Disbursement |
| `GET /disbursement/v1_0/transfer/{referenceId}` | ✅ Status check |

### Available But Not Implemented

| Endpoint | Value |
|----------|-------|
| `GET /v1_0/account/balance` | **High** — Show available balance before approving batches |
| `GET /v1_0/accountholder/{type}/{id}/basicuserinfo` | **Medium** — Validate recipient exists before transfer |
| `POST /v1_0/refund` | **Medium** — Refund failed/disputed transactions |
| `POST /v1_0/deposit` | Low — Alternative to transfer (same purpose) |

---

## Recommended Additions

### 1. Account Balance Display (High Value)
- Add `GetAccountBalance` call to edge function
- Show balance on Dashboard or before batch approval
- Prevent approving batches that exceed available funds

### 2. Recipient Validation (Medium Value)
- Call `GetBasicUserinfo` during CSV upload
- Flag invalid/non-existent phone numbers before batch submission
- Reduces failed transactions

### 3. Refund Capability (Medium Value)
- New edge function for `Refund-V1`
- Add "Refund" button on failed transactions
- Track refund status separately

---

## Implementation Priority

1. **Account Balance** — Prevents over-disbursement, quick win
2. **Recipient Validation** — Reduces failures, improves UX
3. **Refunds** — Operational necessity for disputes

Would you like me to implement any of these features?

