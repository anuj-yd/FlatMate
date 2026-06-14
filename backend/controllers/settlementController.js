const prisma = require('../prismaClient');

const createSettlement = async (req, res) => {
  try {
    const { groupId } = req.params;
    const { payerId, receiverId, amount, settlementDate, notes } = req.body;
    const userId = req.user.userId;

    if (!payerId || !receiverId || !amount) {
      return res.status(400).json({ error: 'payerId, receiverId, and amount are required' });
    }

    if (payerId === receiverId) {
      return res.status(400).json({ error: 'Payer and receiver cannot be the same person' });
    }

    if (parseFloat(amount) <= 0) {
      return res.status(400).json({ error: 'Amount must be greater than zero' });
    }

    const date = settlementDate ? new Date(settlementDate) : new Date();
    if (date > new Date()) {
      return res.status(400).json({ error: 'Settlement date cannot be in the future' });
    }

    // Check if both payer and receiver are in the group (and active)
    const members = await prisma.groupMember.findMany({
      where: {
        groupId: parseInt(groupId),
        userId: { in: [parseInt(payerId), parseInt(receiverId)] }
      }
    });

    const hasPayer = members.some(m => m.userId === parseInt(payerId));
    const hasReceiver = members.some(m => m.userId === parseInt(receiverId));

    if (!hasPayer || !hasReceiver) {
      return res.status(400).json({ error: 'Both payer and receiver must be members of the group' });
    }

    for (const member of members) {
      const joinDateStr = new Date(member.joinedAt).toISOString().split('T')[0];
      const settleDateStr = date.toISOString().split('T')[0];
      
      if (member.leftAt) {
        const leftDateStr = new Date(member.leftAt).toISOString().split('T')[0];
        if (leftDateStr < settleDateStr) {
          return res.status(400).json({ error: 'Payer and receiver must be active members on the settlement date' });
        }
      }
      
      if (joinDateStr > settleDateStr) {
        return res.status(400).json({ error: 'Payer and receiver must have joined before the settlement date' });
      }
    }

    const settlement = await prisma.settlement.create({
      data: {
        groupId: parseInt(groupId),
        payerId: parseInt(payerId),
        receiverId: parseInt(receiverId),
        amount: parseFloat(amount),
        settlementDate: date,
        notes: notes || null,
        createdBy: userId
      },
      include: {
        payer: { select: { name: true, email: true } },
        receiver: { select: { name: true, email: true } }
      }
    });

    res.status(201).json(settlement);
  } catch (error) {
    console.error('Create settlement error:', error);
    res.status(500).json({ error: 'Failed to create settlement' });
  }
};

const getSettlements = async (req, res) => {
  try {
    const { groupId } = req.params;
    const settlements = await prisma.settlement.findMany({
      where: { groupId: parseInt(groupId) },
      include: {
        payer: { select: { id: true, name: true, email: true } },
        receiver: { select: { id: true, name: true, email: true } },
        creator: { select: { id: true, name: true } }
      },
      orderBy: { settlementDate: 'desc' }
    });
    res.json(settlements);
  } catch (error) {
    console.error('Get settlements error:', error);
    res.status(500).json({ error: 'Failed to get settlements' });
  }
};

const getSettlementById = async (req, res) => {
  try {
    const { settlementId } = req.params;
    const settlement = await prisma.settlement.findUnique({
      where: { id: parseInt(settlementId) },
      include: {
        payer: { select: { id: true, name: true } },
        receiver: { select: { id: true, name: true } }
      }
    });
    if (!settlement) {
      return res.status(404).json({ error: 'Settlement not found' });
    }
    res.json(settlement);
  } catch (error) {
    console.error('Get settlement error:', error);
    res.status(500).json({ error: 'Failed to get settlement' });
  }
};

const updateSettlement = async (req, res) => {
  try {
    const { settlementId } = req.params;
    const { payerId, receiverId, amount, settlementDate, notes } = req.body;

    const existingSettlement = await prisma.settlement.findUnique({
      where: { id: parseInt(settlementId) }
    });

    if (!existingSettlement) {
      return res.status(404).json({ error: 'Settlement not found' });
    }

    if (payerId === receiverId) {
      return res.status(400).json({ error: 'Payer and receiver cannot be the same person' });
    }
    if (amount !== undefined && parseFloat(amount) <= 0) {
      return res.status(400).json({ error: 'Amount must be greater than zero' });
    }

    const date = settlementDate ? new Date(settlementDate) : existingSettlement.settlementDate;
    if (date > new Date()) {
      return res.status(400).json({ error: 'Settlement date cannot be in the future' });
    }

    // Assuming payer and receiver membership validation similar to create
    // Simplification for editing: just verify they exist in group
    const pid = payerId || existingSettlement.payerId;
    const rid = receiverId || existingSettlement.receiverId;
    const members = await prisma.groupMember.findMany({
      where: {
        groupId: existingSettlement.groupId,
        userId: { in: [parseInt(pid), parseInt(rid)] }
      }
    });

    const hasPayer = members.some(m => m.userId === parseInt(pid));
    const hasReceiver = members.some(m => m.userId === parseInt(rid));

    if ((!hasPayer || !hasReceiver) && pid !== rid) {
      return res.status(400).json({ error: 'Both payer and receiver must be members of the group' });
    }

    const updatedSettlement = await prisma.settlement.update({
      where: { id: parseInt(settlementId) },
      data: {
        payerId: payerId ? parseInt(payerId) : undefined,
        receiverId: receiverId ? parseInt(receiverId) : undefined,
        amount: amount !== undefined ? parseFloat(amount) : undefined,
        settlementDate: date,
        notes: notes !== undefined ? notes : undefined
      },
      include: {
        payer: { select: { name: true } },
        receiver: { select: { name: true } }
      }
    });

    res.json(updatedSettlement);
  } catch (error) {
    console.error('Update settlement error:', error);
    res.status(500).json({ error: 'Failed to update settlement' });
  }
};

const deleteSettlement = async (req, res) => {
  try {
    const { settlementId } = req.params;
    await prisma.settlement.delete({
      where: { id: parseInt(settlementId) }
    });
    res.json({ message: 'Settlement deleted successfully' });
  } catch (error) {
    console.error('Delete settlement error:', error);
    res.status(500).json({ error: 'Failed to delete settlement' });
  }
};

module.exports = {
  createSettlement,
  getSettlements,
  getSettlementById,
  updateSettlement,
  deleteSettlement
};
