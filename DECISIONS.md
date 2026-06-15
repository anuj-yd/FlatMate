# Decision Log

This document serves as a record of the significant decisions we made while building the FlatMate app. We have documented the logic behind each decision and the alternatives we considered, so that our thought process is clear for the future.

---

### 1. CSV Import: Interactive Wizard vs. Direct Reject
*   **Options Considered:** 
    1. If the CSV has any errors, reject the entire file and show an error message.
    2. Import only the correct data and silently ignore the rows with errors.
    3. Build an Interactive Modal (Wizard) that highlights each error on the screen and allows the user to fix them right there.
*   **Decision Chosen:** Option 3 (Interactive Wizard).
*   **Why:** Users don't want the hassle of going back to their Excel/CSV file to fix minor typos again and again. The wizard points out exactly what's wrong (e.g., "This name is invalid" or "Payer is missing") and lets them resolve it instantly. This saves a lot of time and provides a much better User Experience (UX).

### 2. Handling Guests (How to manage expenses for non-members?)
*   **Options Considered:** 
    1. Throw an error if a new, unrecognized name appears in the CSV.
    2. Automatically distribute the unrecognized person's share among the rest of the group.
    3. Treat them as a "Guest", and provide an option right on the screen to convert them into a "Member" by entering their email address.
*   **Decision Chosen:** Option 3 (Convert to Member via Modal).
*   **Why:** People often bring guests on trips who don't have an account on the app yet. We wanted to allow users to add these guests to the group on-the-spot and send them an email invite. This naturally drives user growth for the app and ensures the expense logging process doesn't get blocked.

### 3. Duplicate Prevention (Stopping double entries)
*   **Options Considered:**
    1. Import everything as-is. (This would lead to double entries).
    2. If a matching entry is found, delete it automatically in the background. (Risky, because it might be a genuinely separate expense that just happened to have the same amount).
    3. Show both rows to the user on the screen and let them decide whether to "Skip", "Keep this only", or "Keep both".
*   **Decision Chosen:** Option 3.
*   **Why:** We cannot guess with financial data. It's entirely possible for two "Pizza - $50" bills to occur on the same day. Therefore, while we aggressively detect "Exact Duplicates", we leave the final decision to the user to ensure no valid bills are missed and no extra bills are added accidentally.

### 4. Background Processing for Emails
*   **Options Considered:**
    1. When a user clicks "Add Member", wait for the entire CSV import process to finish before sending the email.
    2. Hit the background API and send the email immediately as soon as the user enters the email and clicks "Add Member" in the popup.
*   **Decision Chosen:** Option 2.
*   **Why:** If there's going to be an error (like "Email already exists"), it's better to show it immediately inside the popup rather than surprising the user with a failure after they've spent time resolving 50 rows. This makes the UI feel much faster and more responsive. To handle the P2002 (Unique Constraint) error, we added a graceful fallback in a try-catch block so that concurrent requests don't crash the server.
