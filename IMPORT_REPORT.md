# FlatMate CSV Import Report

When a CSV is imported and processed through the 4-Tier Anomaly Engine, the system generates a definitive Import Report. This report provides a transparent audit trail of every data mutation, anomaly flagged, and resolution action taken by the user.

---

## Import Execution Summary

- **Timestamp:** `2026-06-15 14:30:00 UTC`
- **Group:** Flat 404
- **File Processed:** `may_expenses.csv`
- **Total Rows Scanned:** 54
- **Rows Imported Successfully:** 50
- **Rows Discarded / Skipped:** 4
- **New Members Invited:** 2
- **Anomalies Auto-Fixed:** 12
- **Anomalies Manually Resolved:** 7

---

## Detailed Anomaly & Resolution Log

This audit log details specific data conflicts flagged by the engine and the exact resolutions applied during the import session as per the new Interactive Wizard workflow.

### Tier 2: Unrecognized Member Resolution
**1. Row 12 (Payer: "Aisha G.")**
* **Anomaly Flagged:** The name "Aisha G." was not found in the group's active members or guests (`UNRECOGNIZED_NAME`).
* **Resolution Action:** User mapped "Aisha G." to the existing registered user `Aisha Gupta`. All subsequent instances of "Aisha G." in the file were automatically mapped to this user ID.

**2. Row 18 (Participant: "Rohan")**
* **Anomaly Flagged:** "Rohan" did not exist in the system.
* **Resolution Action:** User selected **"Create New Member"**, provided the email `rohan@example.com`, and the system dispatched an asynchronous email invite. Rohan was added to the expense split.

### Tier 3: Moderate Issues
**3. Row 25 (Description: "Paid back for groceries", Amount: ₹1000)**
* **Anomaly Flagged:** Keyword analysis of the description indicated this was a debt repayment, not a shared group expense (`SETTLEMENT_AS_EXPENSE`).
* **Resolution Action:** User selected to reclassify it as a `Settlement` between the Payer and Receiver. This amount was used to clear outstanding debt balances instead of adding to the total group spend.

**4. Row 29 (Payer: [BLANK], Amount: ₹450)**
* **Anomaly Flagged:** The Payer column was missing data (`MISSING_PAYER`).
* **Resolution Action:** User manually selected `Rahul` from the UI dropdown to attribute the expense correctly before the import could proceed.

### Tier 4: Critical Duplication Engine
**5. Row 35 (Description: "Domino's Pizza", Amount: ₹800)**
* **Anomaly Flagged:** The system detected an `EXACT_DUPLICATE`. This row perfectly matched an existing expense already in the database (Date, Amount, Description).
* **Resolution Action:** User selected **"Skip Both"**, dropping the duplicate row and preventing a double-entry in the database.

**6. Row 42 (Description: "Wifi Bill May", Amount: ₹1250)**
* **Anomaly Flagged:** The system detected a `CONFLICTING_DUPLICATE`. Another row on the same date logged "Wifi Bill" for ₹1200. The user notes contained the phrase *"Aisha also logged this"*. The Levenshtein distance string matching and keyword parser flagged this as a highly probable conflict despite the different amounts.
* **Resolution Action:** User selected **"Select Existing Row"**, explicitly dropping the new ₹1250 row in favor of the previously verified ₹1200 entry.

---

> [!NOTE]
> **Audit Guarantee:** The FlatMate engine guarantees that no destructive or deductive changes are made to your financial data without explicit UI confirmation. All auto-fixes are strictly limited to non-destructive string normalization (whitespace trimming, case correction).
