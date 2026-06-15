# FlatMate CSV Import Report

Jab aap file import karte hain aur saari problems solve kar dete hain, toh system ek report generate karta hai (background me). Ye ek example hai ki ek Import Report kaisi dikhti hai aur usme kya-kya hota hai. Ye humein batata hai ki file ke sath exactly kya hua.

---

### Import Summary (Kitna data tha)
* **Total Rows Uploaded:** 24
* **Rows Imported Successfully:** 21
* **Rows Skipped / Deleted:** 3
* **Members Added via CSV:** 2 (Ramesh aur Suresh ko account invite bheja gaya)
* **Auto-Fixed Rows (Bina puche theek hui):** 5
* **Manually Resolved Rows (Jo aapne theek ki):** 4

---

### Detailed Anomaly Log (Konsi problem ko kaise theek kiya gaya)

Yahan un sabhi rows ki detail hoti hai jinme koi gadbadi (anomaly) thi, aur unhe kya action lekar theek kiya gaya:

1. **Row 5 (Amount: ₹0)**
   * **Problem:** CSV me is row ka amount 0 tha (ZERO_AMOUNT).
   * **Action Taken:** Aapne isko **"Skip this expense entirely"** (DELETE) choose kiya, kyunki 0 rupees ka koi kharcha nahi hota. Ye row import nahi hui.

2. **Row 8 (Dev paid Dev 500)**
   * **Problem:** Paise split hone ki jagah settlement likha tha (SETTLEMENT_AS_EXPENSE).
   * **Action Taken:** Ise **"Reclassified as Settlement"** (CONVERT_SETTLEMENT) kar diya gaya. Ab ye kharcha nahi, balki udhaar chukana mana jayega.

3. **Row 12 (Pizza - ₹600)**
   * **Problem:** Ye same bill pehle hi add ho chuka tha (EXACT_DUPLICATE).
   * **Action Taken:** Aapne **"Kept this row only"** (KEEP_THIS) click kiya, jisse system ne pehli wali galti ko mita kar is nayi sahi row ko import kar liya aur double kharcha add hone se bacha liya.

4. **Row 15 (Guest 'Priya' in Split)**
   * **Problem:** Priya ka naam bill me tha par uska account nahi tha (GUEST_IN_SPLIT).
   * **Action Taken:** Aapne **"Make Member"** (CONVERT_GUEST_TO_MEMBER) par click karke uska email `priya@gmail.com` daala. Usko invite bhej diya gaya aur wo proper member ban gayi.

5. **Row 19 (Dates: 05-06-2026)**
   * **Problem:** Date format clear nahi tha. Ye 5 June hai ya 6 May? (AMBIGUOUS_DATE).
   * **Action Taken:** Aapne UI me **"5 June"** select kiya, jisse date correctly set ho gayi.

---

*Is report ka maqsad (purpose) yeh hai ki transparency bani rahe aur aapko humesha pata ho ki aapke CSV ke data me koi bhi changing bina aapki marzi ya knowledge ke nahi hui hai.*
