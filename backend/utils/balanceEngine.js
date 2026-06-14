/**
 * Balance Engine Utility Functions
 * Pure functions to calculate balances and breakdowns.
 */

/**
 * Helper to calculate how much a specific participant owes for a given expense.
 */
function calculateOwedAmount(expense, participant) {
  if (!participant) return 0;
  
  const amount = parseFloat(expense.amount);
  
  if (expense.splitType === 'EQUAL') {
    const participantCount = expense.participants.length;
    return participantCount > 0 ? amount / participantCount : 0;
  } else if (expense.splitType === 'EXACT') {
    return parseFloat(participant.shareValue);
  } else if (expense.splitType === 'PERCENTAGE') {
    const percentage = parseFloat(participant.shareValue);
    return amount * (percentage / 100);
  }
  return 0;
}

/**
 * Calculates net balances for all members in a group.
 * @param {Array} expenses - List of expense objects.
 * @param {Array} settlements - List of settlement objects.
 * @param {Array} members - List of group member objects.
 * @returns {Array} List of member balances.
 */
function calculateGroupBalances(expenses, settlements = [], members) {
  const balances = {};

  // Initialize balances for all members
  members.forEach(m => {
    balances[m.userId] = {
      userId: m.userId,
      name: m.user.name,
      totalPaid: 0,
      totalOwed: 0,
      netBalance: 0
    };
  });

  // Process all expenses
  expenses.forEach(expense => {
    const amount = parseFloat(expense.amount);
    
    // Add to totalPaid for the payer
    if (balances[expense.payerId]) {
      balances[expense.payerId].totalPaid += amount;
    }

    // Add to totalOwed for each participant
    expense.participants.forEach(p => {
      if (balances[p.userId]) {
        const owedAmount = calculateOwedAmount(expense, p);
        balances[p.userId].totalOwed += owedAmount;
      }
    });
  });

  // Process settlements
  settlements.forEach(settlement => {
    const amount = parseFloat(settlement.amount);
    
    // Payer's net balance increases (they paid off their debt, they are less in debt)
    if (balances[settlement.payerId]) {
      // By adding to totalPaid, their netBalance increases
      balances[settlement.payerId].totalPaid += amount;
    }

    // Receiver's net balance decreases (they received their money, they are owed less)
    if (balances[settlement.receiverId]) {
      // By adding to totalOwed, their netBalance decreases
      balances[settlement.receiverId].totalOwed += amount;
    }
  });

  // Calculate net balance and return as array
  return Object.values(balances).map(b => {
    // Round to 2 decimal places to avoid floating point issues
    b.totalPaid = Number(b.totalPaid.toFixed(2));
    b.totalOwed = Number(b.totalOwed.toFixed(2));
    b.netBalance = Number((b.totalPaid - b.totalOwed).toFixed(2));
    return b;
  });
}

/**
 * Calculates detailed breakdown of expenses and settlements for a specific user.
 * @param {Array} expenses - List of expense objects.
 * @param {Array} settlements - List of settlement objects.
 * @param {String} userId - The user ID to calculate for.
 * @returns {Object} { totalPaid, totalOwed, netBalance, breakdown: [...] }
 */
function calculateUserBreakdown(expenses, settlements = [], userId) {
  let totalPaid = 0;
  let totalOwed = 0;
  const breakdown = [];

  expenses.forEach(expense => {
    const isPayer = expense.payerId === userId;
    const participant = expense.participants.find(p => p.userId === userId);
    
    if (isPayer || participant) {
      const amount = parseFloat(expense.amount);
      let userShare = 0;
      let impact = 0;

      if (participant) {
        userShare = calculateOwedAmount(expense, participant);
        totalOwed += userShare;
      }

      if (isPayer) {
        totalPaid += amount;
        impact = amount - userShare; // If they paid, impact is positive (minus what they owe themselves)
      } else {
        impact = -userShare; // If they didn't pay, impact is negative (they owe this)
      }

      breakdown.push({
        expenseId: expense.id,
        description: expense.description,
        amount: amount,
        payer: expense.payer ? expense.payer.name : 'Unknown',
        userShare: Number(userShare.toFixed(2)),
        impact: Number(impact.toFixed(2)),
        date: expense.expenseDate
      });
    }
  });

  settlements.forEach(settlement => {
    const isPayer = settlement.payerId === userId;
    const isReceiver = settlement.receiverId === userId;
    
    if (isPayer || isReceiver) {
      const amount = parseFloat(settlement.amount);
      let impact = 0;

      if (isPayer) {
        totalPaid += amount;
        impact = amount; // Paying off debt increases their balance
      }

      if (isReceiver) {
        totalOwed += amount;
        impact = -amount; // Receiving money decreases their balance
      }

      breakdown.push({
        type: 'SETTLEMENT',
        id: settlement.id,
        description: `Settlement: ${isPayer ? `Paid ${settlement.receiver?.name}` : `Received from ${settlement.payer?.name}`}`,
        amount: amount,
        payer: settlement.payer ? settlement.payer.name : 'Unknown',
        userShare: isReceiver ? amount : 0,
        impact: Number(impact.toFixed(2)),
        date: settlement.settlementDate,
        notes: settlement.notes
      });
    }
  });

  // Sort breakdown by date ascending
  breakdown.sort((a, b) => new Date(a.date) - new Date(b.date));

  return {
    userId,
    totalPaid: Number(totalPaid.toFixed(2)),
    totalOwed: Number(totalOwed.toFixed(2)),
    netBalance: Number((totalPaid - totalOwed).toFixed(2)),
    breakdown
  };
}

/**
 * Debt Simplification Algorithm
 * Takes all group balances and minimizes the number of transactions needed to settle all debts.
 * @param {Array} balances - Array of balance objects containing netBalance, userId, and name.
 * @returns {Array} List of repayment objects { from, to, amount }
 */
function calculateSuggestedRepayments(balances) {
  const debtors = [];
  const creditors = [];

  // Separate into debtors (negative balance) and creditors (positive balance)
  balances.forEach(b => {
    // We only care about users who are owed or owe money
    if (b.netBalance < -0.01) {
      debtors.push({ ...b, balance: Math.abs(b.netBalance) });
    } else if (b.netBalance > 0.01) {
      creditors.push({ ...b, balance: b.netBalance });
    }
  });

  // Sort by largest debts first for better optimization
  debtors.sort((a, b) => b.balance - a.balance);
  creditors.sort((a, b) => b.balance - a.balance);

  const repayments = [];
  let d = 0; // debtor index
  let c = 0; // creditor index

  while (d < debtors.length && c < creditors.length) {
    const debtor = debtors[d];
    const creditor = creditors[c];

    const amount = Math.min(debtor.balance, creditor.balance);
    
    // Create transaction
    if (amount > 0.01) {
      repayments.push({
        from: { userId: debtor.userId, name: debtor.name },
        to: { userId: creditor.userId, name: creditor.name },
        amount: Number(amount.toFixed(2))
      });
    }

    // Update balances
    debtor.balance -= amount;
    creditor.balance -= amount;

    // Move to next if balance is settled
    if (debtor.balance < 0.01) d++;
    if (creditor.balance < 0.01) c++;
  }

  return repayments;
}

module.exports = {
  calculateGroupBalances,
  calculateUserBreakdown,
  calculateOwedAmount,
  calculateSuggestedRepayments
};
