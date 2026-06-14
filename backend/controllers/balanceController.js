const prisma = require('../prismaClient');
const { calculateGroupBalances, calculateUserBreakdown, calculateSuggestedRepayments } = require('../utils/balanceEngine');

/**
 * Get balances for all members in a group
 */
const getGroupBalances = async (req, res) => {
  const { groupId } = req.params;
  
  try {
    // 1. Fetch settlements
    const settlements = await prisma.settlement.findMany({
      where: { groupId: parseInt(groupId) },
      include: {
        payer: { select: { name: true } },
        receiver: { select: { name: true } }
      }
    });

    // 2. Fetch group members
    const groupMembers = await prisma.groupMember.findMany({
      where: { groupId: parseInt(groupId), leftAt: null },
      include: { user: { select: { name: true, email: true } } }
    });

    // 3. Fetch all expenses for this group
    const expenses = await prisma.expense.findMany({
      where: { groupId: parseInt(groupId) },
      include: {
        participants: true,
        payer: { select: { name: true } }
      }
    });

    // 4. Calculate balances using the engine
    const balances = calculateGroupBalances(expenses, settlements, groupMembers);

    res.status(200).json({ members: balances });
  } catch (error) {
    console.error('Error calculating group balances:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

/**
 * Get detailed balance breakdown for a specific user in a group
 */
const getUserBalance = async (req, res) => {
  const { groupId, userId } = req.params;

  try {
    // 1. Check if user is in group
    const groupMember = await prisma.groupMember.findFirst({
      where: { groupId: parseInt(groupId), userId: parseInt(userId) },
      include: { user: { select: { name: true, email: true } } }
    });

    if (!groupMember) {
      return res.status(404).json({ error: 'User not found in this group' });
    }

    // 2. Fetch group
    const group = await prisma.group.findUnique({
      where: { id: parseInt(groupId) }
    });

    // 3. Fetch all expenses for this group
    const expenses = await prisma.expense.findMany({
      where: { groupId: parseInt(groupId) },
      include: {
        participants: true,
        payer: { select: { name: true } }
      }
    });

    // 4. Fetch settlements for this group
    const settlements = await prisma.settlement.findMany({
      where: { groupId: parseInt(groupId) },
      include: {
        payer: { select: { name: true } },
        receiver: { select: { name: true } }
      }
    });

    // 5. Fetch all group members (needed for group balances calculation)
    const allGroupMembers = await prisma.groupMember.findMany({
      where: { groupId: parseInt(groupId), leftAt: null },
      include: { user: { select: { name: true, email: true } } }
    });

    // 6. Calculate User Breakdown (Legacy info, optional to keep but good for robustness)
    const userBreakdown = calculateUserBreakdown(expenses, settlements, parseInt(userId));

    // 7. Calculate Suggested Repayments
    // First, get net balances for everyone
    const allBalances = calculateGroupBalances(expenses, settlements, allGroupMembers);
    
    // Generate full list of optimized repayments for the group
    const allRepayments = calculateSuggestedRepayments(allBalances);

    // Filter to only include repayments involving this specific user
    const userRepayments = allRepayments.filter(r => 
      r.from.userId === parseInt(userId) || r.to.userId === parseInt(userId)
    );

    res.status(200).json({ 
      ...userBreakdown,
      user: groupMember.user.name,
      userEmail: groupMember.user.email,
      groupName: group.name,
      repayments: userRepayments
    });
  } catch (error) {
    console.error('Error calculating user balance breakdown:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

module.exports = {
  getGroupBalances,
  getUserBalance
};
