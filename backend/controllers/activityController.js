const prisma = require('../prismaClient');
const { calculateOwedAmount } = require('../utils/balanceEngine');

const getActivityFeed = async (req, res) => {
  const userId = parseInt(req.user.userId);

  try {
    // 1. Get all groups the user belongs to
    const groupMembers = await prisma.groupMember.findMany({
      where: { userId },
      select: { groupId: true }
    });
    
    const groupIds = groupMembers.map(gm => gm.groupId);

    if (groupIds.length === 0) {
      return res.json([]);
    }

    // 2. Fetch Expenses
    const expenses = await prisma.expense.findMany({
      where: { groupId: { in: groupIds } },
      include: {
        group: { select: { name: true } },
        payer: { select: { id: true, name: true } },
        creator: { select: { id: true, name: true } },
        participants: true
      },
      orderBy: { createdAt: 'desc' },
      take: 30
    });

    // 3. Fetch Settlements
    const settlements = await prisma.settlement.findMany({
      where: { groupId: { in: groupIds } },
      include: {
        group: { select: { name: true } },
        payer: { select: { id: true, name: true } },
        receiver: { select: { id: true, name: true } }
      },
      orderBy: { createdAt: 'desc' },
      take: 30
    });

    // 4. Fetch Groups
    const groups = await prisma.group.findMany({
      where: { id: { in: groupIds } },
      include: {
        creator: { select: { id: true, name: true } }
      },
      orderBy: { createdAt: 'desc' },
      take: 30
    });

    // 5. Combine and format
    const activities = [];

    // Process Expenses
    expenses.forEach(e => {
      let impactText = null;
      let impactType = 'neutral';
      let amountFormatted = '';

      const isPayer = e.payerId === userId;
      const participant = e.participants.find(p => p.userId === userId);
      
      if (participant || isPayer) {
        const amount = parseFloat(e.amount);
        let userShare = 0;
        
        if (participant) {
          userShare = calculateOwedAmount(e, participant);
        }

        if (isPayer) {
          const impact = amount - userShare;
          if (impact > 0) {
            impactType = 'positive';
            impactText = `You get back ${e.currency} ${impact.toFixed(2)}`;
          } else if (impact < 0) {
            impactType = 'negative';
            impactText = `You owe ${e.currency} ${Math.abs(impact).toFixed(2)}`;
          }
        } else if (participant) {
          if (userShare > 0) {
            impactType = 'negative';
            impactText = `You owe ${e.currency} ${userShare.toFixed(2)}`;
          }
        }
      }

      const creatorName = e.createdBy === userId ? 'You' : e.creator.name;
      
      activities.push({
        id: `exp_${e.id}`,
        type: 'expense',
        date: e.createdAt,
        title: `${creatorName} added "${e.description}" in "${e.group.name}".`,
        impactText,
        impactType,
        currency: e.currency
      });
    });

    // Process Settlements
    settlements.forEach(s => {
      let title = '';
      if (s.payerId === userId) {
        title = `You paid ${s.receiver.name} ₹${s.amount.toFixed(2)} in "${s.group.name}".`;
      } else if (s.receiverId === userId) {
        title = `${s.payer.name} paid you ₹${s.amount.toFixed(2)} in "${s.group.name}".`;
      } else {
        title = `${s.payer.name} paid ${s.receiver.name} ₹${s.amount.toFixed(2)} in "${s.group.name}".`;
      }

      activities.push({
        id: `set_${s.id}`,
        type: 'settlement',
        date: s.createdAt,
        title,
        impactText: null,
        impactType: 'neutral'
      });
    });

    // Process Groups
    groups.forEach(g => {
      const creatorName = g.createdBy === userId ? 'You' : g.creator.name;
      activities.push({
        id: `grp_${g.id}`,
        type: 'group',
        date: g.createdAt,
        title: `${creatorName} created the group "${g.name}".`,
        impactText: null,
        impactType: 'neutral'
      });
    });

    // Sort by date descending and limit to top 50
    activities.sort((a, b) => new Date(b.date) - new Date(a.date));
    
    res.json(activities.slice(0, 50));

  } catch (error) {
    console.error('Error fetching activity feed:', error);
    res.status(500).json({ error: 'Failed to fetch activity feed' });
  }
};

module.exports = {
  getActivityFeed
};
