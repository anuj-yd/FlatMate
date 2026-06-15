# Project Scope & Database Schema

This document outlines the database architecture of FlatMate and serves as the **Anomaly Log**, detailing every data problem our CSV Import Engine is designed to detect and how it handles them. 

---

## 1. Database Schema

Our database is built using **Prisma ORM** (PostgreSQL). The core models are:

- **User**: Represents a registered user who can log in (contains email, password, profile details).
- **Group**: Represents a shared flat or a trip group (e.g., "Goa Trip" or "Flat 404").
- **GroupMember**: A mapping table linking a `User` to a `Group`. It tracks when a user joined (`joinedAt`) and if/when they left (`leftAt`).
- **Guest**: Represents a person included in group expenses who hasn't created a registered account yet. Guests can later be converted into real Members.
- **Expense**: Records any bill or payment (e.g., "Electricity Bill - ₹1200"). It tracks the total `amount`, the `date`, the `description`, and who paid (`payerId`).
- **ExpenseParticipant**: Records how an expense is divided. It maps an `Expense` to multiple `Users` (and their respective `shareValue`).
- **Settlement**: Represents a direct repayment between two members (e.g., "John paid ₹500 to Bob"). This clears balances without being counted as a new shared expense.
- **ImportMemberResolution**: A temporary tracking table used during CSV imports to remember how a user mapped an unknown CSV name (e.g., mapping "Aisha (Guest)" to an existing User, or creating a new Guest).

---

## 2. Anomaly Log (CSV Data Problems & Handling)

When a user uploads a CSV file, data is often inconsistent, missing, or duplicated. Our engine categorizes these anomalies into 4 distinct Tiers:

### Tier 1: Formatting & Minor Issues (Auto-Fixed)
- **Whitespace & Casing:** Extra spaces or inconsistent casing in names and descriptions are automatically trimmed and normalized (e.g., `" john "` becomes `"John"`).
- **Currency Format:** Non-numeric characters in amount columns (like `"Rs 500"`, `"$500"`, or `"500/-"`) are stripped so only the raw numeric float (`500.00`) is extracted.
- **Missing Description:** If an expense lacks a description, the engine automatically assigns a default name based on the date: `"Expense on [Date]"`.

### Tier 2: Member Mapping & Unrecognized Names (Bulk Resolution)
- **New Names Found:** If the CSV contains names that don't match any `GroupMember` or `Guest` (e.g., `"Rohan"` is found, but only `"Rohan S."` exists in the DB).
  - **Handling:** The system pauses the import and asks the user to resolve the unknown name. The user can:
    1. **Map to Existing:** Link "Rohan" to the existing "Rohan S." user.
    2. **Create Guest:** Add "Rohan" as an unregistered guest.
    3. **Create Member:** Invite "Rohan" to the app via email.
  - The system remembers this choice for the rest of the CSV batch.

### Tier 3: Moderate Issues (Requires User Input)
- **Missing Payer:** The CSV lists an expense but the "Paid By" column is blank.
  - **Handling:** The UI flags the row and forces the user to manually select the payer from a dropdown before the import can proceed.
- **Settlement Logged as Expense:** A user logs "Repaid John" in the CSV.
  - **Handling:** The system detects keywords related to repayment. Instead of treating it as a shared group expense, it converts it into a `Settlement` to balance the ledger.

### Tier 4: Critical Duplication & Conflicts (The Duplication Engine)
This is the most complex tier, designed to catch double-entries and conflicting reports of the same event.

- **Exact Duplicates:** 
  - **Detection:** A row in the CSV has the *exact same* Date, Amount, and Description as either another row in the same CSV, or an existing expense in the database.
  - **Handling:** The UI flags this as a highly likely double-entry and provides deterministic choices:
    - `Keep One (This row)`
    - `Keep both`
    - `Skip both`
- **Conflicting Duplicates:** 
  - **Detection:** Two entries share the exact same Date, but have slightly different amounts, different payers, or slightly modified descriptions. The engine uses a combination of **Levenshtein Distance** (fuzzy string matching) on the description and **Keyword Parsing** in user notes (looking for phrases like *"wrong"*, *"duplicate"*, *"Aisha also logged this"*).
  - **Handling:** The UI displays the two conflicting rows side-by-side and asks the user to resolve the conflict:
    - `Select This Row` (Discards the other)
    - `Select Existing Row` (Discards this one)
    - `Keep both`
    - `Skip both`
- **Member After Leave:** 
  - **Detection:** An expense is logged for a date *after* the assigned payer or participant's `leftAt` date in the group.
  - **Handling:** The system flags the date discrepancy and requires the user to override or correct the date.
- **Negative Amount:** 
  - **Detection:** An amount is negative (`-500`).
  - **Handling:** The system asks the user to confirm if this should be treated as a "Refund" or if the negative sign was a typo.
