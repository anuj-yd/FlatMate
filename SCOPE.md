# Project Scope & Database Schema

This document explains the database structure of FlatMate and outlines all the common CSV anomalies (errors) our system is designed to handle. We have kept the language very simple for easy understanding.

## 1. Database Schema

Our database is built using **Prisma** (PostgreSQL). The main tables (models) are:

*   **User**: Anyone who can log in to the app (e.g., John, who has an email and password).
*   **Group**: A shared flat or a trip group (e.g., "Goa Trip" or "Flat 404").
*   **GroupMember**: This table links a User to a Group. If someone leaves the group, their `leftAt` date is saved here.
*   **Guest**: People who are included in group expenses but haven't created an account on the app yet. We add them directly from the CSV and can later convert them into Members.
*   **Expense**: Any bill or payment made by someone (e.g., "Pizza - $50"). It records who paid and who it needs to be split with.
*   **Settlement**: When one member pays another back (e.g., "John paid $50 to Bob"). We don't count this as an expense, but rather as clearing a balance.

---

## 2. Anomaly Log (Errors found in CSV files and how we handle them)

When a user uploads a CSV file, the data is often messy or incorrect. We have categorized these problems into 4 Tiers (levels):

### Tier 1: Minor Issues (Auto-Fixed)
*   **Extra spaces or Capital/Small letters in names:** (e.g., automatically fixing " john " to "John").
*   **Currency Format:** If someone writes "Rs 500" or "$500", we extract just the number "500".
*   **Missing Description:** If the bill has no name/description, we automatically assign it the name "Expense on [Date]".

### Tier 2: Easy Fixes (Bulk Resolution)
*   **New Names Found:** If the CSV contains a new name (e.g., 'Bob') that isn't in the group, the system asks: "Is Bob a part of the group, or is this just a nickname for an existing member?" We can then map it to an existing member across the whole file.

### Tier 3: Moderate Issues (Requires User Input)
*   **Missing Payer:** If the CSV doesn't mention who paid the bill, the system shows a popup asking "Who paid for this expense?"
*   **Settlement as Expense:** If someone wrote "Paid to John", the system understands this is not a shared expense, but a debt being repaid. We remove it from `Expense` and convert it into a `Settlement`.

### Tier 4: Critical Issues (Requires Careful Resolution)
*   **Guest in Split:** If a person is listed in a bill but doesn't have an account, we provide 3 options:
    1. Assign their share to someone else.
    2. Remove them from the bill and divide their share among the remaining people.
    3. **(New)** "Make Member" - Convert them to a real user instantly by entering their email address and sending them an invite.
*   **Member After Leave:** If a member left the group on the 10th, but a bill is added under their name on the 15th, the system will flag it.
*   **Duplicates (Double entries):** If a bill with the exact same date, amount, and people appears twice, the system marks it as an **Exact Duplicate** and gives the user an option to discard one to prevent double-billing.
*   **Negative Amount:** If the amount is negative (minus), the system asks if this is meant to be a "Refund".
