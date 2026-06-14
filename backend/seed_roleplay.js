require('dotenv').config();
const prisma = require('./prismaClient');

async function updateMemberDates() {
  try {
    const members = await prisma.groupMember.findMany({
      include: { user: true }
    });

    for (const m of members) {
      let joinedAt = new Date('2026-01-01'); // Assume core members joined in Jan
      let leftAt = null;

      if (m.user.name === 'Meera') {
        leftAt = new Date('2026-03-31'); // Meera leaves end of March
      } else if (m.user.name === 'Sam') {
        joinedAt = new Date('2026-04-10'); // Sam joins mid-April
      }

      await prisma.groupMember.update({
        where: { id: m.id },
        data: { joinedAt, leftAt }
      });
      console.log(`Updated ${m.user.name}: joinedAt=${joinedAt.toDateString()}, leftAt=${leftAt ? leftAt.toDateString() : 'Active'}`);
    }
    console.log('Roleplay database successfully seeded with correct timeline!');
  } catch (error) {
    console.error('Error updating dates:', error);
  } finally {
    await prisma.$disconnect();
  }
}

updateMemberDates();
