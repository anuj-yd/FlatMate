const prisma = require('./prismaClient');

async function run() {
  const expenses = await prisma.expense.findMany({
    select: { id: true, description: true, amount: true, expenseDate: true }
  });
  
  console.log('Total expenses:', expenses.length);
  
  const grouped = {};
  expenses.forEach(e => {
    // group by description, amount, and date to avoid false positives
    const key = e.description + '_' + e.amount + '_' + e.expenseDate.toISOString();
    if (!grouped[key]) grouped[key] = [];
    grouped[key].push(e.id);
  });
  
  const toDelete = [];
  for (const key in grouped) {
    if (grouped[key].length > 1) {
      // Keep the first one, delete the rest
      toDelete.push(...grouped[key].slice(1));
    }
  }
  
  console.log('Duplicates to delete:', toDelete.length);
  
  if (toDelete.length > 0) {
    // Delete expense participants first due to foreign key
    await prisma.expenseParticipant.deleteMany({
      where: { expenseId: { in: toDelete } }
    });
    
    await prisma.expense.deleteMany({
      where: { id: { in: toDelete } }
    });
    
    console.log('Deleted duplicates!');
  }
}

run();
