const prisma = require('../prismaClient');
const csvParser = require('csv-parser');
const fs = require('fs');

const uploadCsvExpenses = async (req, res) => {
  const { groupId } = req.params;
  const file = req.file;

  if (!file) {
    return res.status(400).json({ error: 'No CSV file uploaded' });
  }

  try {
    const group = await prisma.group.findUnique({
      where: { id: parseInt(groupId) },
      include: { members: { include: { user: true } } }
    });

    if (!group) {
      return res.status(404).json({ error: 'Group not found' });
    }

    const expenses = [];
    const errors = [];

    // Parse CSV
    fs.createReadStream(file.path)
      .pipe(csvParser())
      .on('data', (row) => {
        try {
          // Expected columns: Date, Description, Amount, Currency, PayerEmail, SplitType, Participant1Email, Participant1Share...
          // For simplicity, let's assume a basic format: Date, Description, Amount, Currency, PayerEmail, SplitType
          // And any column that has an email is treated as a participant with their share.
          
          if (!row.Description || !row.Amount || !row.PayerEmail) {
            throw new Error(`Missing required fields in row: ${JSON.stringify(row)}`);
          }

          const payerMember = group.members.find(m => m.user.email === row.PayerEmail && !m.leftAt);
          if (!payerMember) {
            throw new Error(`Payer ${row.PayerEmail} is not an active member in row: ${row.Description}`);
          }

          const splitType = row.SplitType || 'EQUAL';
          if (!['EQUAL', 'EXACT', 'PERCENTAGE'].includes(splitType)) {
            throw new Error(`Invalid SplitType ${row.SplitType} in row: ${row.Description}`);
          }

          const participants = [];
          
          // Find participant columns dynamically (e.g. participant emails as column headers)
          for (const key of Object.keys(row)) {
            if (['Date', 'Description', 'Amount', 'Currency', 'PayerEmail', 'SplitType'].includes(key)) continue;
            
            // Assume the column header is the email, and the value is their share (if EXACT/PERCENTAGE) or 'yes' (if EQUAL)
            if (row[key] && row[key].trim() !== '') {
              const participantMember = group.members.find(m => m.user.email === key);
              if (participantMember) {
                participants.push({
                  userId: participantMember.userId,
                  shareValue: splitType === 'EQUAL' ? null : parseFloat(row[key])
                });
              }
            }
          }

          if (participants.length === 0) {
            throw new Error(`No valid participants found for expense: ${row.Description}`);
          }

          expenses.push({
            description: row.Description,
            amount: parseFloat(row.Amount),
            currency: row.Currency || 'INR',
            expenseDate: row.Date ? new Date(row.Date) : new Date(),
            payerId: payerMember.userId,
            splitType: splitType,
            participants: participants
          });

        } catch (err) {
          errors.push(err.message);
        }
      })
      .on('end', async () => {
        // Clean up uploaded file
        fs.unlinkSync(file.path);

        if (errors.length > 0) {
          return res.status(400).json({ error: 'Errors occurred while parsing CSV', details: errors });
        }

        if (expenses.length === 0) {
          return res.status(400).json({ error: 'No valid expenses found in the CSV' });
        }

        // Save expenses to DB
        try {
          const createdExpenses = [];
          await prisma.$transaction(async (tx) => {
            for (const exp of expenses) {
              const { participants, ...expenseData } = exp;
              
              const newExpense = await tx.expense.create({
                data: {
                  ...expenseData,
                  groupId: parseInt(groupId),
                  createdBy: req.user.userId
                }
              });

              const participantData = participants.map(p => ({
                expenseId: newExpense.id,
                userId: p.userId,
                shareValue: p.shareValue
              }));

              await tx.expenseParticipant.createMany({ data: participantData });
              createdExpenses.push(newExpense);
            }
          });

          res.status(201).json({ message: `Successfully imported ${createdExpenses.length} expenses`, count: createdExpenses.length });
        } catch (dbError) {
          console.error('Database error during CSV import:', dbError);
          res.status(500).json({ error: 'Database error while saving expenses' });
        }
      });
  } catch (error) {
    console.error('CSV Upload Error:', error);
    if (file && fs.existsSync(file.path)) fs.unlinkSync(file.path);
    res.status(500).json({ error: 'Internal server error' });
  }
};

module.exports = {
  uploadCsvExpenses
};
