const nodemailer = require('nodemailer');
const prisma = require('../prismaClient');

const sendReminderEmail = async (req, res) => {
  const { groupId, userId } = req.params;
  const { amount } = req.body;
  const senderId = req.user.userId;

  try {
    // Fetch sender and receiver details
    const sender = await prisma.user.findUnique({ where: { id: senderId } });
    const receiver = await prisma.user.findUnique({ where: { id: parseInt(userId) } });
    const group = await prisma.group.findUnique({ where: { id: parseInt(groupId) } });

    if (!receiver || !group) {
      return res.status(404).json({ error: 'User or Group not found' });
    }

    if (!receiver.email) {
      return res.status(400).json({ error: 'Target user does not have an email address configured.' });
    }

    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
      }
    });

    const emailHtml = `
      <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 600px; margin: 0 auto; background-color: #f7f7f7; padding: 20px; border-radius: 8px;">
        <div style="background-color: #fff; padding: 40px; border-radius: 16px; border: 2px solid #111; box-shadow: 4px 4px 0px #111; text-align: center;">
          <h1 style="color: #ff652f; margin-bottom: 10px; font-size: 28px; text-transform: uppercase; font-weight: 900; letter-spacing: 1px;">Balance Reminder</h1>
          
          <p style="font-size: 18px; color: #333; margin-top: 20px;">
            Hi <strong>${receiver.name}</strong>,
          </p>
          
          <p style="font-size: 16px; color: #555; line-height: 1.6;">
            This is a friendly reminder from <strong>${sender.name}</strong> regarding your pending balance in the group <strong>"${group.name}"</strong>.
          </p>
          
          <div style="margin: 30px 0; padding: 20px; background-color: #fdfdf5; border: 2px dashed #5f9ea0; border-radius: 12px;">
            <p style="margin: 0; font-size: 14px; color: #666; text-transform: uppercase; font-weight: bold;">Amount Owed</p>
            <p style="margin: 5px 0 0; font-size: 32px; color: #111; font-weight: 900;">₹${parseFloat(amount).toFixed(2)}</p>
          </div>

          <p style="font-size: 15px; color: #666; margin-bottom: 30px;">
            Please try to settle up at your earliest convenience to keep things running smoothly!
          </p>
          
          <a href="http://localhost:5173/group/${groupId}" style="display: inline-block; background-color: #5bc5a7; color: #fff; padding: 12px 24px; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 16px; border: 2px solid #52b196;">
            Settle Up Now
          </a>
        </div>
        
        <p style="text-align: center; color: #999; font-size: 12px; margin-top: 20px;">
          Sent securely via FlateMate ✨<br>
          If you've already paid, please ignore this email.
        </p>
      </div>
    `;

    const mailOptions = {
      from: `"FlateMate Reminders" <${process.env.EMAIL_USER}>`,
      to: receiver.email,
      subject: `Friendly reminder from ${sender.name} - FlateMate`,
      html: emailHtml
    };

    await transporter.sendMail(mailOptions);

    // Save reminder record in database
    await prisma.reminder.create({
      data: {
        groupId: parseInt(groupId),
        senderId: senderId,
        receiverId: parseInt(userId),
        amount: parseFloat(amount)
      }
    });

    res.status(200).json({ message: 'Reminder email sent successfully' });

  } catch (error) {
    console.error('Error sending reminder email:', error);
    res.status(500).json({ error: 'Failed to send reminder email.' });
  }
};

module.exports = {
  sendReminderEmail
};
