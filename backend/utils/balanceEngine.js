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
 * @param {Array} expenses - List of expense objects (must include participants array).
 * @param {Array} members - List of group member objects {userId, user: {name}}.
 * @returns {Array} List of member balances: { userId, name, totalPaid, totalOwed, netBalance }
 */
function calculateGroupBalances(expenses, members) {
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
 * Calculates detailed breakdown of expenses for a specific user.
 * @param {Array} expenses - List of expense objects (must include participants and payer details).
 * @param {String} userId - The user ID to calculate for.
 * @returns {Object} { totalPaid, totalOwed, netBalance, breakdown: [...] }
 */
function calculateUserBreakdown(expenses, userId) {
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

  return {
    userId,
    totalPaid: Number(totalPaid.toFixed(2)),
    totalOwed: Number(totalOwed.toFixed(2)),
    netBalance: Number((totalPaid - totalOwed).toFixed(2)),
    breakdown
  };
}

module.exports = {
  calculateGroupBalances,
  calculateUserBreakdown,
  calculateOwedAmount
};
