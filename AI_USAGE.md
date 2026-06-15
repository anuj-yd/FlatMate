# AI Usage & Prompt Log

This document details the AI tools utilized during the development of FlatMate, the key prompts used to guide the architecture, and a transparent log of instances where the AI generated incorrect code, how those errors were detected, and the subsequent corrections.

---

## 1. AI Tools Used
- **Antigravity AI (Google DeepMind):** Used as the primary agentic pair-programmer for full-stack feature implementation, debugging, and deployment configuration.
- **Vite/React HMR (AI-Assisted Debugging):** Leveraged AI to interpret complex React runtime errors and build-time warnings.

---

## 2. Key Prompts Used
1. *"Create a robust 4-Tier CSV Anomaly Detection engine in Express that can flag missing payers, map unknown guest names to existing users, and prevent duplicate financial entries."*
2. *"Update the React InteractiveCSVWizard component to handle 'EXACT_DUPLICATE' and 'CONFLICTING_DUPLICATE' anomalies with deterministic user choices (Keep Both, Skip Both, Select Existing)."*
3. *"Write a database cleanup script to remove 12 duplicate expenses that were previously injected into the PostgreSQL database, grouping them by date, amount, description, and payer."*

---

## 3. Instances of AI Errors & Corrections

While the AI significantly accelerated development, it occasionally generated code with contextual blind spots. Below are three concrete cases where the AI produced incorrect outputs, how they were caught, and what was changed.

### Case 1: Incorrect Prisma Initialization in Background Script
* **What the AI did wrong:** When asked to write a database cleanup script (`cleanDB.js`), the AI initially instantiated Prisma directly using `const prisma = new PrismaClient()`. 
* **How it was caught:** Upon executing the script locally via `node cleanDB.js`, the terminal threw a `PrismaClientKnownRequestError: DatabaseAccessDenied` error.
* **What was changed:** We realized the script was running outside the Express app's lifecycle and lacked environment variables. The code was modified to inject `require('dotenv').config()` at the top of the script and import the centrally configured `prismaClient.js` instance that utilized the `@prisma/adapter-pg` driver.

### Case 2: Hallucinating Prisma Schema Field Names
* **What the AI did wrong:** In the duplicate detection loop, the AI assumed standard naming conventions and attempted to access `exp.date` and `exp.paid_by`.
* **How it was caught:** The cleanup script crashed with a `TypeError: Cannot read properties of undefined (reading 'toISOString')` because `exp.date` evaluated to undefined.
* **What was changed:** We manually inspected the `schema.prisma` file and discovered the correct fields were `expenseDate` and `payerId`. The AI was instructed to replace `exp.date` with `exp.expenseDate` and `exp.paid_by` with `exp.payerId`, which resolved the crash.

### Case 3: React Hook Violations & State Cascades
* **What the AI did wrong:** While building the `InteractiveCSVWizard.jsx` UI for resolving anomalies, the AI generated a `useEffect` block that called `setState` synchronously to initialize the issue list.
* **How it was caught:** We ran the frontend linter (`npm run lint`), which caught the violation: `Error: Calling setState synchronously within an effect can trigger cascading renders.`
* **What was changed:** We refactored the component lifecycle to initialize state securely without triggering an infinite re-render loop, and removed unused placeholder variables (`assignedTo`) that the AI had generated but never hooked up to the UI.

---
*Document produced as per the Assignment Task requirements.*
