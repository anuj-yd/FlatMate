const prisma = require('../prismaClient');
const { calculateGroupBalances, calculateUserBreakdown } = require('../utils/balanceEngine');

/**
 * Get balances for all members in a group
 */
const getGroupBalances = async (req, res) => {
  const { groupId } = req.params;
  
  try {
    // 1. Fetch group members
    const groupMembers = await prisma.groupMember.findMany({
      where: { groupId: parseInt(groupId), leftAt: null },
      include: { user: { select: { name: true, email: true } } }
    });

    // 2. Fetch all expenses for this group
    const expenses = await prisma.expense.findMany({
      where: { groupId: parseInt(groupId) },
      include: {
        participants: true,
        payer: { select: { name: true } }
      }
    });

    // 3. Calculate balances using the engine
    const balances = calculateGroupBalances(expenses, groupMembers);

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
    const groupMember = await prisma.groupMember.findUnique({
      where: { groupId_userId: { groupId: parseInt(groupId), userId: parseInt(userId) } },
      include: { user: { select: { name: true } } }
    });

    if (!groupMember) {
      return res.status(404).json({ error: 'User not found in this group' });
    }

    // 2. Fetch all expenses for this group
    const expenses = await prisma.expense.findMany({
      where: { groupId: parseInt(groupId) },
      include: {
        participants: true,
        payer: { select: { name: true } }
      }
    });

    // 3. Calculate breakdown using the engine
    const breakdown = calculateUserBreakdown(expenses, parseInt(userId));

    res.status(200).json({ 
      user: groupMember.user.name,
      ...breakdown 
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
