# Decision Log (Humne kya faisle liye aur kyun liye?)

Yeh document un sabhi zaroori decisions ka record hai jo humne FlatMate app banate waqt liye the. Humne har decision ke peeche ka logic aur options yahan likhe hain taaki future me samajhne me aasaani ho.

---

### 1. CSV Import: Interactive Wizard vs. Direct Reject
*   **Options Considered:** 
    1. Agar CSV me koi galati ho, toh poori file reject kar do aur user ko error dikha do.
    2. Sirf sahi data import kar lo aur galat data ko silently chhod do.
    3. Ek Interactive Modal (Wizard) banao jo user ko ek-ek galati dikhaye aur wahin theek karne ka option de.
*   **Decision Chosen:** Option 3 (Interactive Wizard).
*   **Kyun? (Why):** Users nahi chahte ki unhe baar-baar Excel/CSV file me jaakar choti-choti galatiyan theek karni pade. Wizard unko samne screen par hi batata hai ki "Ye naam galat hai" ya "Isme payer missing hai". Isse time bachta hai aur user experience (UX) bahut achha hota hai.

### 2. Guests Handling (Naye logo ka kharcha kaise manage karein?)
*   **Options Considered:** 
    1. CSV me agar naya naam aaye, toh simply error de do.
    2. Us naye insaan ka kharcha baaki sab logo me baant do.
    3. Us naye insaan ko "Guest" bana do, aur wahi screen se direct email daal kar "Member" me convert karne ka feature do.
*   **Decision Chosen:** Option 3 (Convert to Member via Modal).
*   **Kyun? (Why):** Aksar log trip par aate hain aur unka account nahi hota. Hume chahiye tha ki user unhe on-the-spot group me add kar sake aur unhe email chala jaye. Isse humari app par naye users (growth) automatically badhenge. Aur transaction bhi rukega nahi.

### 3. Duplicate Prevention (Double entry rokna)
*   **Options Considered:**
    1. CSV me jaise rows aayein, sab import kar lo. (Duplicate entry ho jayegi).
    2. Agar same entry mile, toh background me khud hi delete kar do. (Lekin ho sakta hai wo alag kharcha ho jo same amount ka ho).
    3. User ko dono rows screen par dikhao aur unhe decide karne do ki "Skip" karna hai, "Keep this" karna hai, ya "Keep both" karna hai.
*   **Decision Chosen:** Option 3.
*   **Kyun? (Why):** Financial data ke sath hum khud guess nahi kar sakte. Ek hi din me 2 baar "Pizza - ₹500" aa sakta hai. Isliye hum Exact Duplicate pakadte zaroor hain, par faisla user ke haath me chhodte hain taaki koi bhi valid bill miss na ho jaye aur na hi koi extra bill add ho.

### 4. Background Processing for Emails
*   **Options Considered:**
    1. Jab user "Add Member" click kare, toh poore CSV import process ke khatam hone ka wait karein aur fir email bhejein.
    2. "Add Member" popup me email enter karte hi turant background API hit karein aur email bhej dein.
*   **Decision Chosen:** Option 2.
*   **Kyun? (Why):** Agar koi error aana hoga (jaise "Email already exists"), toh wo turant wahin popup me dikh jayega. User ko end me 50 rows import karne ke baad error nahi aayega. Isse UI aur fast feel hoti hai. P2002 (Unique Constraint) error ko handle karne ke liye humne try-catch me graceful fallback lagaya hai taaki concurrency crash na ho.
