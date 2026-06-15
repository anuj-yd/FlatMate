# Decision Log

This document serves as a record of the significant technical and product decisions we made while building the FlatMate app. We have documented the logic behind each decision and the alternatives we considered, demonstrating our engineering thought process as per the Assignment Task requirements.

---

### 1. CSV Import: Interactive Wizard vs. Direct Reject
*   **Options Considered:** 
    1. Reject the entire file if any validation errors occur.
    2. Import only valid data and silently discard rows with errors.
    3. Build an Interactive Modal (Wizard) to highlight each error and allow in-place resolution.
*   **Decision:** Option 3 (Interactive Wizard).
*   **Why:** Providing a seamless UX is critical. Users despise modifying their raw CSV/Excel files repeatedly. The Wizard provides contextual resolution (e.g., "Payer is missing") saving the user significant time and effort.

### 2. Handling Unrecognized Names (Guests vs. Members)
*   **Options Considered:** 
    1. Throw a hard validation error if a name doesn't exist in the DB.
    2. Treat all unknown names as strict string labels without accounts.
    3. Introduce a "Guest" entity and provide an option to map them to an existing user, keep them as a Guest, or instantly convert them to a "Member" via email invite.
*   **Decision:** Option 3 (Guest Mapping & Member Conversion).
*   **Why:** Flatmates frequently log expenses involving unregistered friends. Allowing users to resolve this in-flight (via `MAP_EXISTING`, `CREATE_GUEST`, or `CREATE_NEW_MEMBER`) prevents workflow blocking and organically drives app growth through immediate email invitations.

### 3. Duplicate Prevention: Deterministic Choice vs. Silent Pruning
*   **Options Considered:**
    1. Blindly import everything (leads to database pollution).
    2. Automatically delete exact matches in the background (risky for identical but valid separate transactions).
    3. Prompt the user with clear, deterministic choices for every detected duplicate.
*   **Decision:** Option 3 (Deterministic User Choice).
*   **Why:** Financial data requires high fidelity. It's entirely possible for two identical `₹500` grocery bills to exist on the same day. While we aggressively detect duplicates, we delegate the final state mutation to the user (`Keep One`, `Keep both`, `Skip both`), ensuring zero silent data loss.

### 4. Advanced Conflict Resolution (Fuzzy Matching & Keyword Parsing)
*   **Options Considered:**
    1. Only flag exact 1:1 matches for duplicates.
    2. Implement an advanced conflict engine using Levenshtein distance for fuzzy matching and keyword parsing (e.g., "wrong", "also logged") in the user notes column.
*   **Decision:** Option 2.
*   **Why:** Users often log the same expense with slight variations (e.g., "Aisha says ₹2400 she paid. Rohan says ₹2450 he paid. Note: Rohan says Aisha also logged this"). Simple exact matching would fail here. By utilizing fuzzy string matching and heuristic keyword detection, the system intelligently flags "Conflicting Duplicates" that would otherwise bypass basic filters, preventing significant accounting errors.

### 5. Asynchronous Email Processing during Imports
*   **Options Considered:**
    1. Queue all "Invite Member" emails and dispatch them only after the entire CSV import completes.
    2. Dispatch emails immediately via a background API call the moment the user confirms a "Make Member" action in the Wizard.
*   **Decision:** Option 2.
*   **Why:** Immediate dispatch provides instantaneous feedback. If an email address is already registered (triggering a Prisma Unique Constraint `P2002`), it's better to catch and display it immediately in the popup context rather than failing silently or surprisingly at the end of a 50-row import. This required implementing resilient `try-catch` blocks to prevent concurrent requests from crashing the Express server.
