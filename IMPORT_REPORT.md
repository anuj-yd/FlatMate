# FlatMate CSV Import Report

When you import a file and resolve all the issues, the system generates a report in the background. This is an example of what an Import Report looks like and the kind of information it contains. It tells us exactly what happened to the data in the file.

---

### Import Summary
* **Total Rows Uploaded:** 24
* **Rows Imported Successfully:** 21
* **Rows Skipped / Deleted:** 3
* **Members Added via CSV:** 2 (Account invites were sent to John and Sarah)
* **Auto-Fixed Rows (Resolved without asking):** 5
* **Manually Resolved Rows (Resolved by you):** 4

---

### Detailed Anomaly Log

This section details all the rows that had an issue (anomaly) and the exact action taken to fix them:

1. **Row 5 (Amount: $0)**
   * **Problem:** The amount for this row in the CSV was 0 (ZERO_AMOUNT).
   * **Action Taken:** You chose to **"Skip this expense entirely"** (DELETE) because an expense of 0 dollars doesn't make sense. This row was not imported.

2. **Row 8 (Dev paid Dev $500)**
   * **Problem:** A debt repayment was listed as a shared expense (SETTLEMENT_AS_EXPENSE).
   * **Action Taken:** It was **"Reclassified as Settlement"** (CONVERT_SETTLEMENT). It will no longer be treated as an expense, but as clearing a debt balance.

3. **Row 12 (Pizza - $60)**
   * **Problem:** This exact same bill was already added in another row (EXACT_DUPLICATE).
   * **Action Taken:** You clicked **"Kept this row only"** (KEEP_THIS), which prompted the system to delete the duplicate mistake and only import this correct row, preventing a double charge.

4. **Row 15 (Guest 'Sarah' in Split)**
   * **Problem:** Sarah was listed in the bill but didn't have a registered account (GUEST_IN_SPLIT).
   * **Action Taken:** You clicked **"Add Guest as Member"** (CONVERT_GUEST_TO_MEMBER) and entered her email `sarah@example.com`. An invite was sent to her, and she is now a proper member of the group.

5. **Row 19 (Date: 05-06-2026)**
   * **Problem:** The date format was unclear. Is it June 5th or May 6th? (AMBIGUOUS_DATE).
   * **Action Taken:** You manually selected **"5 June"** in the UI, ensuring the date was saved correctly.

---

*The purpose of this report is to maintain transparency. It ensures you always know that no changes were made to your CSV data without your direct consent or knowledge.*
