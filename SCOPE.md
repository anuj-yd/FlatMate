# Project Scope & Database Schema

This document explains the database structure of FlatMate and all the common CSV errors (anomalies) our system handles. We have kept the language very simple.

## 1. Database Schema (Humara Database Kaisa Dikhta Hai)

Humara database **Prisma** (PostgreSQL) use karke banaya gaya hai. Isme main tables (models) ye hain:

*   **User**: Har wo insaan jo app me login kar sakta hai. (Jaise: Rahul, jiska email aur password hai).
*   **Group**: Ek flat ya trip ka group (Jaise: "Goa Trip" ya "Flat 404").
*   **GroupMember**: Ye table batati hai ki kaunsa User kis Group ka hissa hai. Agar kisi ne group chhod diya hai, toh uski `leftAt` date yahan save hoti hai.
*   **Guest**: Wo log jo group ke bills me toh hain, par unhone app par account nahi banaya hai. Hum inko directly CSV se add karte hain aur baad me Member me convert kar sakte hain.
*   **Expense**: Koi bhi kharcha jo kisi ne kiya ho (Jaise: "Pizza - ₹500"). Isme record hota hai ki kisne pay kiya aur kis-kis me split hoga.
*   **Settlement**: Jab ek member dusre ko paise wapas karta hai (Jaise: "Rahul paid 500 to Amit"). Isko hum expense nahi mante, balki balance clear karna mante hain.

---

## 2. Anomaly Log (CSV me kya galatiyan aati hain aur hum unhe kaise theek karte hain)

Jab user koi CSV file upload karta hai, toh usme kayi baar data kharab hota hai. Humne in sab problems ko 4 Tiers (levels) me baanta hai:

### Tier 1: Minor Issues (Chhoti Galatiyan - Auto Fix ho jati hain)
*   **Naam me extra space ya Capital/Small letters:** (Jaise " rahul " ko "Rahul" kar dena).
*   **Currency Format:** Agar kisi ne "Rs 500" ya "$500" likha hai, toh hum sirf number "500" extract kar lete hain.
*   **Missing Description:** Agar bill ka naam nahi likha, toh hum usko "Expense on [Date]" ka naam de dete hain.

### Tier 2: Easy Fixes (Bulk me solve hone wali problem)
*   **Naye Naam milna:** Agar CSV me koi naya naam hai (Jaise 'Raju') jo group me nahi hai, toh system puchta hai: "Kya Raju group ka hissa hai, ya ye kisi aur member ka hi dusra naam (nickname) hai?" Hum isko existing member ke sath map kar sakte hain.

### Tier 3: Moderate Issues (User se thoda input chahiye)
*   **Payer Missing (Kisne pay kiya?):** Agar CSV me payer ka naam nahi hai, toh system popup dikhata hai aur puchta hai ki "Ye paise kisne diye the?"
*   **Settlement as Expense (Paise wapas kiye, par kharcha dikha diya):** Agar kisi ne likha "Paid to Dev", toh system samajh jata hai ki ye kharcha nahi hai, balki udhaar chukaya gaya hai. Hum isko `Expense` se hata kar `Settlement` me convert kar dete hain.

### Tier 4: Critical Issues (Badi Galatiyan - Dhyan se theek karni padti hain)
*   **Guest in Split:** Agar kisi aise insaan ka naam kharche me hai jo account me nahi hai, toh hum 3 option dete hain: 
    1. Uska hissa kisi aur ko assign kar do.
    2. Usko hata do aur bill baaki logo me baant do.
    3. **(New)** Usko direct wahi se "Make Member" karke invite email bhej do!
*   **Member After Leave:** Agar kisi member ne 10 tareekh ko group chhod diya tha, par uske naam pe 15 tareekh ka bill daala gaya hai.
*   **Duplicates (Ek hi bill 2 baar):** Agar same date, same amount aur same logo ka bill 2 baar aa jaye, toh system usko **Exact Duplicate** mark karta hai aur ek ko discard (delete) karne ka option deta hai taaki double entry na ho.
*   **Negative Amount:** Agar amount negative (minus) me hai, toh system puchta hai ki kya ye koi "Refund" hai?
