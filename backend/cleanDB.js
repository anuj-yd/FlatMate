require('dotenv').config();
const prisma = require('./prismaClient');

async function cleanDuplicates() {
  console.log('Starting cleanup of duplicate expenses...');
  try {
    const allExpenses = await prisma.expense.findMany();
    
    // Group by signature
    const signatureMap = new Map();
    const toDelete = [];
    
    for (const exp of allExpenses) {
      // Signature based on exact date, amount, description, and paidBy
      const dateStr = exp.expenseDate.toISOString().split('T')[0];
      const sig = `${dateStr}_${exp.amount.toString()}_${(exp.description||'').toLowerCase().trim()}_${exp.payerId}`;
      
      if (signatureMap.has(sig)) {
        // We already saw this exact expense, mark as duplicate
        toDelete.push(exp.id);
      } else {
        signatureMap.set(sig, exp.id);
      }
    }
    
    console.log(`Found ${toDelete.length} duplicate expenses to delete.`);
    
    if (toDelete.length > 0) {
      const deleteResult = await prisma.expense.deleteMany({
        where: { id: { in: toDelete } }
      });
      console.log(`Deleted ${deleteResult.count} duplicate expenses successfully.`);
    } else {
      console.log('No duplicates found!');
    }
    
  } catch (err) {
    console.error('Error during cleanup:', err);
  } finally {
    await prisma.$disconnect();
  }
}

cleanDuplicates();
