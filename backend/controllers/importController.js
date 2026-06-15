const csvParser = require('csv-parser');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const prisma = require('../prismaClient');
const bcrypt = require('bcrypt');
const { normaliseName } = require('../services/nameNormaliser');

const parseDate = (dateStr) => {
  if (!dateStr) return null;
  // Handle A02: "Mar-14" format
  if (/^[A-Za-z]{3}-\d{2}$/.test(dateStr)) {
    const parts = dateStr.split('-');
    const monthMap = { jan:0, feb:1, mar:2, apr:3, may:4, jun:5, jul:6, aug:7, sep:8, oct:9, nov:10, dec:11 };
    const month = monthMap[parts[0].toLowerCase()];
    if (month !== undefined) {
      return new Date(2026, month, parseInt(parts[1]));
    }
  }
  
  // DD-MM-YYYY
  if (/^\d{2}-\d{2}-\d{4}$/.test(dateStr)) {
    const parts = dateStr.split('-');
    return new Date(parseInt(parts[2]), parseInt(parts[1]) - 1, parseInt(parts[0]));
  }
  
  return new Date(dateStr);
};

const getLevenshteinDistance = (a, b) => {
  const matrix = [];
  for (let i = 0; i <= b.length; i++) { matrix[i] = [i]; }
  for (let j = 0; j <= a.length; j++) { matrix[0][j] = j; }
  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(matrix[i - 1][j - 1] + 1, Math.min(matrix[i][j - 1] + 1, matrix[i - 1][j] + 1));
      }
    }
  }
  return matrix[b.length][a.length];
};

const fuzzyMatchMember = (nameStr, groupMembers) => {
  if (!nameStr) return null;
  let normalized = nameStr.toLowerCase().trim();
  
  // Exact lowercase match
  let exact = groupMembers.find(m => m.user.name.toLowerCase() === normalized);
  if (exact) return exact;

  // Fuzzy match
  let bestMatch = null;
  let minDistance = 100;
  for (const m of groupMembers) {
    const dist = getLevenshteinDistance(normalized, m.user.name.toLowerCase());
    if (dist < minDistance) {
      minDistance = dist;
      bestMatch = m;
    }
  }
  // A03, A04: if distance is small (e.g. <= 2) we auto-fix
  if (minDistance <= 2) return bestMatch;
  return null; // A08: Unknown Member
};

// Tier 0: Member Resolution Init
const initImportSession = async (req, res) => {
  const file = req.file;
  if (!file) return res.status(400).json({ error: 'No CSV file uploaded' });

  try {
    const groupId = parseInt(req.params.groupId);
    const sessionId = crypto.randomUUID();
    
    // Move the uploaded file to a known location based on sessionId
    const tempPath = path.join(__dirname, '..', 'uploads', `${sessionId}.csv`);
    fs.renameSync(file.path, tempPath);

    const csvNames = new Set();
    const stream = fs.createReadStream(tempPath).pipe(csvParser());

    for await (const row of stream) {
      // Normalize headers
      const normalizedRow = {};
      for (const key of Object.keys(row)) {
        normalizedRow[key.toLowerCase().trim()] = row[key];
      }

      const paidBy = String(normalizedRow.paid_by || '').trim();
      const splitWith = String(normalizedRow.split_with || '').trim();

      if (paidBy) csvNames.add(paidBy);
      
      if (splitWith) {
        const parts = splitWith.split(';');
        for (const p of parts) {
          if (p.trim()) csvNames.add(p.trim());
        }
      }
    }

    const group = await prisma.group.findUnique({
      where: { id: groupId },
      include: { members: { include: { user: true } }, guests: true }
    });

    const canonicalMembers = group ? group.members.map(m => ({ id: m.userId, name: m.user.name })) : [];
    const autoResolutions = {};

    for (const name of csvNames) {
      const result = normaliseName(name, canonicalMembers);
      if (result.status === 'exact') {
        autoResolutions[name] = { resolutionType: 'MAP_EXISTING', resolvedUserId: result.userId, isAutoResolved: true };
      }
    }

    res.json({
      sessionId,
      csvMembers: Array.from(csvNames),
      existingGroupMembers: group ? group.members : [],
      existingGuests: group ? group.guests : [],
      autoResolutions
    });

  } catch (error) {
    console.error('Error initializing import:', error);
    res.status(500).json({ error: 'Failed to parse CSV members' });
  }
};

const getImportMembers = async (req, res) => {
  try {
    const { groupId, sessionId } = req.params;
    const tempPath = path.join(__dirname, '..', 'uploads', `${sessionId}.csv`);
    if (!fs.existsSync(tempPath)) return res.status(404).json({ error: 'Session not found or expired' });

    const csvNames = new Set();
    const stream = fs.createReadStream(tempPath).pipe(csvParser());

    for await (const row of stream) {
      const normalizedRow = {};
      for (const key of Object.keys(row)) {
        normalizedRow[key.toLowerCase().trim()] = row[key];
      }

      const paidBy = String(normalizedRow.paid_by || '').trim();
      const splitWith = String(normalizedRow.split_with || '').trim();

      if (paidBy) csvNames.add(paidBy);
      if (splitWith) {
        splitWith.split(';').forEach(p => { if (p.trim()) csvNames.add(p.trim()); });
      }
    }

    const group = await prisma.group.findUnique({
      where: { id: parseInt(groupId) },
      include: { 
        members: { include: { user: true } }, 
        guests: true,
        expenses: { include: { payer: true, participants: { include: { user: true } } } }
      }
    });

    res.json({
      csvMembers: Array.from(csvNames),
      existingGroupMembers: group ? group.members : [],
      existingGuests: group ? group.guests : []
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to get import members' });
  }
};

const resolveImportMembers = async (req, res) => {
  try {
    const { groupId, sessionId } = req.params;
    const { resolutions } = req.body;

    if (!resolutions || !Array.isArray(resolutions)) {
      return res.status(400).json({ error: 'Invalid resolutions array' });
    }

    const results = [];

    // Delete existing resolutions for this session to allow "retry"
    await prisma.importMemberResolution.deleteMany({
      where: { importSessionId: sessionId }
    });

    for (const resData of resolutions) {
      let resolvedUserId = null;
      let guestName = null;

      if (resData.resolutionType === 'MAP_EXISTING') {
        resolvedUserId = resData.resolvedUserId;
      } else if (resData.resolutionType === 'CREATE_NEW_MEMBER') {
        // Create new user and group member
        const email = `${resData.csvMemberName.replace(/[^a-zA-Z0-9]/g, '').toLowerCase()}_${Date.now()}@example.com`;
        const password = await bcrypt.hash('password123', 10);
        
        const newUser = await prisma.user.create({
          data: { name: resData.csvMemberName, email, password }
        });
        
        await prisma.groupMember.create({
          data: { groupId: parseInt(groupId), userId: newUser.id }
        });
        
        resolvedUserId = newUser.id;
      } else if (resData.resolutionType === 'CREATE_GUEST') {
        guestName = resData.csvMemberName;
        await prisma.guest.create({
          data: { name: guestName, groupId: parseInt(groupId) }
        });
      }

      const resolution = await prisma.importMemberResolution.create({
        data: {
          importSessionId: sessionId,
          csvMemberName: resData.csvMemberName,
          resolutionType: resData.resolutionType,
          resolvedUserId,
          guestName
        }
      });
      results.push(resolution);
    }

    res.json({ success: true, resolutions: results });
  } catch (error) {
    console.error('Error resolving members:', error);
    res.status(500).json({ error: 'Failed to resolve members' });
  }
};

const processImportSession = async (req, res) => {
  try {
    const { groupId, sessionId } = req.params;
    const tempPath = path.join(__dirname, '..', 'uploads', `${sessionId}.csv`);
    if (!fs.existsSync(tempPath)) return res.status(404).json({ error: 'Session not found' });

    let groupMembers = [];
    let existingGuests = [];
    let dbExpenses = [];
    if (groupId) {
      const group = await prisma.group.findUnique({ 
        where: { id: parseInt(groupId) }, 
        include: { 
          members: { include: { user: true } },
          guests: true,
          expenses: { include: { payer: true, participants: { include: { user: true } } } }
        } 
      });
      if (group) {
        groupMembers = group.members;
        existingGuests = group.guests || [];
        dbExpenses = (group.expenses || []).map(e => ({
          isDbRow: true,
          rowId: `db_${e.id}`,
          date: new Date(e.expenseDate).toISOString().split('T')[0],
          paid_by: e.payer.name,
          amount: e.amount.toString(),
          description: e.description,
          split_with: e.participants.map(p => p.user?.name || '').filter(Boolean).join(';')
        }));
      }
    }
    
    const canonicalMembers = groupMembers.map(m => ({ id: m.userId, name: m.user.name }));

    // Get resolutions for this session
    const resolutions = await prisma.importMemberResolution.findMany({
      where: { importSessionId: sessionId }
    });
    
    // Build a map of rawName -> resolvedName for easy lookup
    const resolutionMap = {};
    for (const r of resolutions) {
      if (r.resolutionType === 'MAP_EXISTING') {
        const resolvedUser = canonicalMembers.find(c => c.id === parseInt(r.resolvedUserId));
        if (resolvedUser) resolutionMap[r.csvMemberName] = resolvedUser.name;
      } else if (r.resolutionType === 'CREATE_NEW_MEMBER' || r.resolutionType === 'CREATE_GUEST') {
        resolutionMap[r.csvMemberName] = r.csvMemberName;
      }
    }

    const rows = [];
    const issues = [];
    const autoFixes = [];
    let rowId = 0;

    const stream = fs.createReadStream(tempPath).pipe(csvParser());

    for await (let row of stream) {
      rowId++;
      
      // Normalize headers if needed. Expected: date, description, paid_by, amount, currency, split_type, split_with, split_details, notes
      const normalizedRow = {};
      for (const key of Object.keys(row)) {
        normalizedRow[key.toLowerCase().trim()] = row[key];
      }
      row = normalizedRow;

      let date = row.date;
      let desc = String(row.description || '').trim();
      let paidBy = String(row.paid_by || '');
      let amountStr = String(row.amount || '');
      let currency = String(row.currency || '').trim().toUpperCase();
      let splitType = String(row.split_type || '').trim().toLowerCase();
      let splitWith = String(row.split_with || '').trim();
      let splitDetails = String(row.split_details || '').trim();
      let notes = String(row.notes || '').trim().toLowerCase();

      // ====== TIER 1: AUTO-FIXES ======
      
      // A01: COMMA_IN_AMOUNT
      if (amountStr.includes(',')) {
        const cleaned = amountStr.replace(/,/g, '');
        autoFixes.push({
          rowNumber: rowId,
          anomalyType: 'FORMAT_ERROR',
          tier: 1,
          description: `Stripped comma from amount.`,
          originalValue: amountStr,
          suggestedFix: cleaned,
          actionTaken: 'auto_fixed'
        });
        amountStr = cleaned;
      }

      // A05: SUBUNIT_PRECISION
      let amount = parseFloat(amountStr);
      if (!isNaN(amount) && amountStr.includes('.') && amountStr.split('.')[1].length > 2) {
        const rounded = Math.round(amount * 100) / 100;
        autoFixes.push({
          rowNumber: rowId,
          anomalyType: 'SUBUNIT_PRECISION',
          tier: 1,
          description: `Currency can't have 3 decimals. Rounded to 2dp.`,
          originalValue: amountStr,
          suggestedFix: rounded.toFixed(2),
          actionTaken: 'auto_fixed'
        });
        amount = rounded;
      }

      // A02: NONSTANDARD_DATE (e.g. "Mar-14" -> "14-03-2026")
      if (date && /^[A-Za-z]{3}-\d{2}$/.test(date)) {
        const parsed = parseDate(date);
        if (parsed) {
          const dd = String(parsed.getDate()).padStart(2, '0');
          const mm = String(parsed.getMonth() + 1).padStart(2, '0');
          const yyyy = parsed.getFullYear();
          const fixedDate = `${dd}-${mm}-${yyyy}`;
          autoFixes.push({
            rowNumber: rowId,
            anomalyType: 'NONSTANDARD_DATE',
            tier: 1,
            description: `Parsed non-standard date "${date}" unambiguously.`,
            originalValue: date,
            suggestedFix: fixedDate,
            actionTaken: 'auto_fixed'
          });
          date = fixedDate;
        }
      }
      const parsedDate = parseDate(date);

      // A03 & A04: NAME_CASE_MISMATCH & NAME_TRAILING_SPACE
      if (paidBy) {
        const normResult = normaliseName(paidBy, canonicalMembers);
        if (normResult.status === 'exact') {
          if (paidBy !== normResult.resolvedName) {
            autoFixes.push({
              rowNumber: rowId,
              anomalyType: 'NAME_CASE_MISMATCH',
              tier: 1,
              description: `paid_by "${paidBy}" matched to canonical member "${normResult.resolvedName}" after normalisation.`,
              originalValue: paidBy,
              suggestedFix: normResult.resolvedName,
              actionTaken: 'auto_fixed'
            });
          }
          paidBy = normResult.resolvedName;
        } else if (resolutionMap[paidBy]) {
          // If it was manually mapped in Tier 0
          paidBy = resolutionMap[paidBy];
        }
      }

      // A06: REDUNDANT_SPLIT_DETAILS
      if (splitType === 'equal' && splitDetails) {
        autoFixes.push({
          rowNumber: rowId,
          anomalyType: 'REDUNDANT_SPLIT_DETAILS',
          tier: 1,
          description: `Equal shares with explicit details. Ignored details.`,
          originalValue: splitDetails,
          suggestedFix: '',
          actionTaken: 'auto_fixed'
        });
        splitDetails = '';
      }

      // Update row with auto-fixes
      row.amount = amount;
      row.paid_by = paidBy;
      row.date = date;
      row.split_details = splitDetails;

      // ====== TIER 2: AUTO-DEFAULT ======
      // A07: MISSING_CURRENCY_DEFAULT
      if (!currency || currency === '' || currency === 'NAN') {
        currency = 'INR';
        row.currency = currency;
        issues.push({ id: `issue_${rowId}_${issues.length}`, rowId, type: 'MISSING_CURRENCY_DEFAULT', tier: 2, message: `Row ${rowId}: Defaulted missing currency to INR`, rowData: row });
      }

      // ====== TIER 3 & 4: BULK & INDIVIDUAL REVIEW ======
      let hasTier3or4 = false;

      // A08: UNKNOWN_MEMBER_NAME
      if (paidBy) {
        const exact = groupMembers.find(m => m.user.name === paidBy);
        if (!exact) {
          issues.push({ id: `issue_${rowId}_UNKNOWN_MEMBER_NAME`, rowId, type: 'UNKNOWN_MEMBER_NAME', tier: 3, message: `Row ${rowId}: Unknown payer name "${paidBy}"`, rowData: row });
          hasTier3or4 = true;
        }
      }

      // A09: FOREIGN_CURRENCY
      if (currency === 'USD') {
        issues.push({ id: `issue_${rowId}_FOREIGN_CURRENCY`, rowId, type: 'FOREIGN_CURRENCY', tier: 3, message: `Row ${rowId}: Foreign currency (USD) needs an exchange rate`, rowData: row });
        hasTier3or4 = true;
      }

      // A10: MISSING_PAYER
      if (!paidBy || paidBy === '' || paidBy === 'NAN') {
        issues.push({ id: `issue_${rowId}_MISSING_PAYER`, rowId, type: 'MISSING_PAYER', tier: 4, message: `Row ${rowId}: Missing payer`, rowData: row });
        hasTier3or4 = true;
      }

      // A11 & A21: SETTLEMENT_AS_EXPENSE / DEPOSIT_AS_EXPENSE
      if (desc.toLowerCase().includes('settlement') || notes.includes('settlement') || notes.includes('paid back') || desc.toLowerCase().includes('deposit') || notes.includes('deposit')) {
        const tType = desc.toLowerCase().includes('deposit') ? 'DEPOSIT_AS_EXPENSE' : 'SETTLEMENT_AS_EXPENSE';
        issues.push({ id: `issue_${rowId}_${tType}`, rowId, type: tType, tier: 4, message: `Row ${rowId}: This looks like a direct payment/deposit, not a shared expense.`, rowData: row });
        hasTier3or4 = true;
      }

      // A12 & A13: PERCENTAGE_NOT_100
      if (splitType === 'percentage' && splitDetails) {
        const parts = splitDetails.split(';');
        let sum = 0;
        for (const part of parts) {
          const match = part.match(/\d+/);
          if (match) sum += parseInt(match[0]);
        }
        if (sum !== 100) {
          issues.push({ id: `issue_${rowId}_PERCENTAGE_NOT_100`, rowId, type: 'PERCENTAGE_NOT_100', tier: 4, message: `Row ${rowId}: Percentages sum to ${sum}%, not 100%`, rowData: row });
          hasTier3or4 = true;
        }
      }

      // A14: GUEST_IN_SPLIT
      if (splitWith) {
        const participants = splitWith.split(';');
        const newParticipants = [];
        const unknownPeople = [];
        
        for (let p of participants) {
          p = p.trim();
          
          // Apply Tier 0 mappings
          const normResult = normaliseName(p, canonicalMembers);
          if (normResult.status === 'exact') {
            p = normResult.resolvedName;
          } else if (resolutionMap[p]) {
            p = resolutionMap[p];
          }
          
          newParticipants.push(p);

          // Check if they are a valid member OR a valid guest
          const isMember = groupMembers.find(m => m.user.name === p);
          const isGuest = existingGuests.find(g => g.name === p);

          if (!isMember && !isGuest) {
            unknownPeople.push(p);
          } else if (isGuest) {
            // It's a known guest. We can't keep guests in split_with because ExpenseParticipant needs a User ID.
            // So we flag them to be removed or handled.
            unknownPeople.push(p); 
          }
        }
        
        row.split_with = newParticipants.join(';');

        if (unknownPeople.length > 0 && !desc.toLowerCase().includes('guest')) {
          issues.push({ 
            id: `issue_${rowId}_GUEST_IN_SPLIT`, 
            rowId, 
            type: 'GUEST_IN_SPLIT', 
            tier: 4, 
            message: `Row ${rowId}: Guest/Unknown participant in split: ${unknownPeople.join(', ')}`, 
            rowData: row,
            unknownNames: unknownPeople
          });
          hasTier3or4 = true;
        }
      }

      // A17: NEGATIVE_AMOUNT
      if (amount < 0) {
        issues.push({ id: `issue_${rowId}_NEGATIVE_AMOUNT`, rowId, type: 'NEGATIVE_AMOUNT', tier: 4, message: `Row ${rowId}: Negative amount. Is this a refund?`, rowData: row });
        hasTier3or4 = true;
      }

      // A18: ZERO_AMOUNT
      if (amount === 0) {
        issues.push({ id: `issue_${rowId}_ZERO_AMOUNT`, rowId, type: 'ZERO_AMOUNT', tier: 4, message: `Row ${rowId}: Amount is 0. Provide actual amount or skip.`, rowData: row });
        hasTier3or4 = true;
      }

      // A19: AMBIGUOUS_DATE — any date where day <= 12 (could be MM-DD or DD-MM)
      if (date) {
        const parts = date.split('-');
        if (parts.length === 3) {
          const d = parseInt(parts[0]);
          const m = parseInt(parts[1]);
          if (d <= 12 && m <= 12 && d !== m) {
            // Both interpretations valid: dd-mm or mm-dd
            const interp1 = `${String(d).padStart(2,'0')}-${String(m).padStart(2,'0')}-${parts[2]}`; // DD-MM (standard)
            const interp2 = `${String(m).padStart(2,'0')}-${String(d).padStart(2,'0')}-${parts[2]}`; // if it was MM-DD
            issues.push({
              id: `issue_${rowId}_AMBIGUOUS_DATE`,
              rowId, type: 'AMBIGUOUS_DATE', tier: 4,
              message: `Row ${rowId}: Date "${date}" is ambiguous — is it ${d} ${new Date(2026, m-1, 1).toLocaleString('en',{month:'short'})} or ${m} ${new Date(2026, d-1, 1).toLocaleString('en',{month:'short'})}?`,
              rowData: row, interp1, interp2
            });
            hasTier3or4 = true;
          }
        }
      }

      // A20: MEMBER_AFTER_LEAVE
      if (splitWith && parsedDate) {
        const participants = splitWith.split(';');
        for (let p of participants) {
          p = p.trim();
          const member = groupMembers.find(m => m.user.name === p);
          if (member) {
            let isTimeTraveler = false;

            // Standard DB validation (Relies on Database state)
            if (member.leftAt && member.leftAt < parsedDate) isTimeTraveler = true;
            
            if (isTimeTraveler) {
              issues.push({
                id: `issue_${rowId}_MEMBER_AFTER_LEAVE_${p.replace(/\s+/g,'_')}`,
                rowId, type: 'MEMBER_AFTER_LEAVE', tier: 4,
                message: `Row ${rowId}: ${p} was not in the group on ${parsedDate.toDateString()}`,
                rowData: row,
                memberName: p
              });
              hasTier3or4 = true;
            }
          }
        }
      }

      // Duplicate Detection (A15 EXACT & A16 CONFLICTING)
      const dupCandidates = [...dbExpenses, ...rows].filter(r => {
        let rYear = null, rMonth = null, rDateStr = null;
        if (r.isDbRow) {
          const pd = new Date(r.date);
          rYear = pd.getUTCFullYear(); rMonth = pd.getUTCMonth(); rDateStr = pd.getUTCDate();
        } else {
          const pd = new Date(r.date);
          if (!isNaN(pd)) { rYear = pd.getFullYear(); rMonth = pd.getMonth(); rDateStr = pd.getDate(); }
        }
        
        return rYear !== null && parsedDate && !isNaN(parsedDate) && 
               rYear === parsedDate.getFullYear() && 
               rMonth === parsedDate.getMonth() && 
               rDateStr === parsedDate.getDate();
      });

      let dupCount = 0;
      for (const dup of dupCandidates) {
        // EXACT SAME PAYMENT: Same Amount, Same Description
        // (Even if payers differ, if Amount and Desc are identical, it's considered an Exact Duplicate by the user's rules)
        const isExactAmount = Math.abs(parseFloat(dup.amount) - parseFloat(amount)) < 0.01;
        const isExactDesc = (dup.description || '').toLowerCase().trim() === desc.toLowerCase().trim();

        if (isExactAmount && isExactDesc) {
          issues.push({ 
            id: `issue_${rowId}_EXACT_DUPLICATE_${dupCount++}`, 
            rowId, type: 'EXACT_DUPLICATE', tier: 4, 
            message: `Row ${rowId} is an EXACT match (Amount & Description) to ${dup.isDbRow ? 'an existing expense' : 'Row ' + dup.rowId}`, 
            rowData: row, pairId: dup.rowId, pairRowData: dup, isDbConflict: dup.isDbRow 
          });
          hasTier3or4 = true;
          continue;
        }

        // SLIGHTLY MODIFIED PAYMENT: Similar description OR keywords in notes
        const currentNotes = (row.notes || '').toLowerCase();
        const pairNotes = (dup.notes || '').toLowerCase();
        const keywordMatch = /duplicate|also logged|wrong|same as|already|double/.test(currentNotes) ||
                             /duplicate|also logged|wrong|same as|already|double/.test(pairNotes);

        const isSimilarDesc = getLevenshteinDistance((dup.description || '').toLowerCase(), desc.toLowerCase()) <= 7;

        if (isSimilarDesc || keywordMatch) {
          issues.push({ 
            id: `issue_${rowId}_CONFLICTING_DUPLICATE_${dupCount++}`, 
            rowId, type: 'CONFLICTING_DUPLICATE', tier: 4, 
            message: `Row ${rowId} might be the SAME payment as ${dup.isDbRow ? 'an existing expense' : 'Row ' + dup.rowId} (Different amount/payer but similar details or notes)`, 
            rowData: row, pairId: dup.rowId, pairRowData: dup, isDbConflict: dup.isDbRow 
          });
          hasTier3or4 = true;
        }
      }

      row.rowId = rowId;
      rows.push(row);
    }

    if (fs.existsSync(tempPath)) fs.unlinkSync(tempPath);

    res.json({
      fileName: `import_${sessionId}.csv`,
      totalRows: rowId,
      autoFixes,
      issues,
      groupMembersList: canonicalMembers,
      validRows: rows.filter(r => !issues.some(i => i.rowId === r.rowId && i.tier >= 3)),
      previewRows: rows.slice(0, 10)
    });

  } catch (error) {
    console.error('CSV Process Error:', error);
    res.status(500).json({ error: 'Internal server error while processing CSV' });
  }
};

function capitalize(s) {
  return s && s[0].toUpperCase() + s.slice(1);
}

module.exports = {
  initImportSession,
  getImportMembers,
  resolveImportMembers,
  processImportSession
};
