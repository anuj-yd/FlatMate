require('dotenv').config();
const express = require('express');
const cors = require('cors');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const nodemailer = require('nodemailer');
const multer = require('multer');
const upload = multer({ dest: 'uploads/' });
const { getGroupBalances, getUserBalance } = require('./controllers/balanceController');
const { uploadCsvExpenses } = require('./controllers/csvController');
const authenticateToken = require('./middleware/auth');
const prisma = require('./prismaClient');

const app = express();

// Middlewares
app.use(cors());
app.use(express.json());

// Register API
app.post('/api/register', async (req, res) => {
    try {
        const { name, email, password } = req.body;

        if (!name || !email || !password) {
            return res.status(400).json({ error: 'All fields are required' });
        }

        // Validate duplicate email
        const existingUser = await prisma.user.findUnique({
            where: { email }
        });

        if (existingUser) {
            return res.status(409).json({ error: 'Email is already in use' });
        }

        // Hash the password
        const saltRounds = 10;
        const hashedPassword = await bcrypt.hash(password, saltRounds);

        // Create the user
        const newUser = await prisma.user.create({
            data: {
                name,
                email,
                password: hashedPassword
            }
        });

        // Omit password from response
        const { password: _, ...userWithoutPassword } = newUser;
        
        return res.status(201).json({ 
            message: 'User registered successfully', 
            user: userWithoutPassword 
        });

    } catch (error) {
        console.error('Registration error:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
});

// Login API
app.post('/api/login', async (req, res) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({ error: 'Email and password are required' });
        }

        // Find user by email
        const user = await prisma.user.findUnique({
            where: { email }
        });

        if (!user) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        // Compare password
        const isPasswordValid = await bcrypt.compare(password, user.password);

        if (!isPasswordValid) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        // Generate JWT Token
        const jwtSecret = process.env.JWT_SECRET || 'fallback_secret_key';
        const token = jwt.sign(
            { userId: user.id, email: user.email },
            jwtSecret,
            { expiresIn: '24h' }
        );

        // Omit password from response
        const { password: _, ...userWithoutPassword } = user;

        return res.status(200).json({
            message: 'Login successful',
            token,
            user: userWithoutPassword
        });

    } catch (error) {
        console.error('Login error:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
});

// Example Protected Route
app.get('/api/me', authenticateToken, async (req, res) => {
    try {
        // req.user comes from the authenticateToken middleware
        const user = await prisma.user.findUnique({
            where: { id: req.user.userId }
        });

        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        const { password, ...userWithoutPassword } = user;
        res.json({ user: userWithoutPassword });
    } catch (error) {
        console.error('Protected route error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Mail Transporter
const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
    }
});

// Forgot Password API
app.post('/api/forgot-password', async (req, res) => {
    try {
        const { email } = req.body;
        if (!email) {
            return res.status(400).json({ error: 'Email is required' });
        }

        const user = await prisma.user.findUnique({ where: { email } });
        if (!user) {
            return res.status(404).json({ error: 'User with this email not found' });
        }

        const otp = Math.floor(100000 + Math.random() * 900000).toString(); // 6 digit OTP
        const otpExpiry = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

        await prisma.user.update({
            where: { email },
            data: { otp, otpExpiry }
        });

        const mailOptions = {
            from: `"FlateMate Support" <${process.env.EMAIL_USER}>`,
            to: email,
            subject: 'Password Reset OTP - FlateMate',
            html: `
            <div style="font-family: 'Comic Sans MS', 'Chalkboard SE', sans-serif; background-color: #ffffff; padding: 40px 20px; text-align: center;">
              <div style="max-width: 500px; margin: 0 auto; background-color: #fff9e6; border: 3px solid #323232; border-radius: 15px; padding: 40px 30px; box-shadow: 5px 5px 0px #323232;">
                <h1 style="color: #ff6b6b; font-size: 32px; margin-bottom: 10px; margin-top: 0;">FlateMate ✨</h1>
                <h2 style="color: #323232; font-size: 22px; margin-top: 0;">Password Reset Request</h2>
                <p style="color: #555; font-size: 16px; line-height: 1.6; margin-bottom: 30px;">
                  Hey there! We received a request to reset your password. Here is your magic code:
                </p>
                <div style="margin: 40px 0;">
                  <span style="background-color: #ffe66d; border: 3px solid #323232; padding: 15px 30px; font-size: 36px; font-weight: bold; letter-spacing: 8px; color: #323232; border-radius: 12px; box-shadow: 4px 4px 0px #323232;">
                    ${otp}
                  </span>
                </div>
                <p style="color: #555; font-size: 14px; margin-top: 40px;">
                  This code will expire in <strong>10 minutes</strong>.<br>If you didn't request this, you can safely ignore this email.
                </p>
              </div>
            </div>
            `
        };

        await transporter.sendMail(mailOptions);
        res.status(200).json({ message: 'OTP sent successfully' });

    } catch (error) {
        console.error('Forgot password error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Reset Password API
app.post('/api/reset-password', async (req, res) => {
    try {
        const { email, otp, newPassword } = req.body;
        if (!email || !otp || !newPassword) {
            return res.status(400).json({ error: 'All fields are required' });
        }

        const user = await prisma.user.findUnique({ where: { email } });
        if (!user || user.otp !== otp) {
            return res.status(400).json({ error: 'Invalid OTP' });
        }

        if (new Date() > user.otpExpiry) {
            return res.status(400).json({ error: 'OTP has expired' });
        }

        const hashedPassword = await bcrypt.hash(newPassword, 10);

        await prisma.user.update({
            where: { email },
            data: {
                password: hashedPassword,
                otp: null,
                otpExpiry: null
            }
        });

        res.status(200).json({ message: 'Password reset successfully' });

    } catch (error) {
        console.error('Reset password error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});
// Create Group API
app.post('/api/groups', authenticateToken, async (req, res) => {
    try {
        const { name, membersToInvite } = req.body;
        if (!name) return res.status(400).json({ error: 'Group name is required' });

        const group = await prisma.$transaction(async (tx) => {
            const newGroup = await tx.group.create({
                data: {
                    name,
                    createdBy: req.user.userId,
                    members: {
                        create: { userId: req.user.userId }
                    }
                }
            });

            if (membersToInvite && Array.isArray(membersToInvite) && membersToInvite.length > 0) {
                const users = await tx.user.findMany({
                    where: { email: { in: membersToInvite } }
                });

                const memberData = users
                    .filter(u => u.id !== req.user.userId) // Prevent duplicate creator addition
                    .map(u => ({
                        groupId: newGroup.id,
                        userId: u.id
                    }));

                if (memberData.length > 0) {
                    await tx.groupMember.createMany({ data: memberData });
                }
            }
            return newGroup;
        });

        res.status(201).json(group);
    } catch (error) {
        console.error('Create group error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Get User's Groups API
app.get('/api/groups', authenticateToken, async (req, res) => {
    try {
        const groups = await prisma.group.findMany({
            where: { 
                OR: [
                    { createdBy: req.user.userId },
                    { members: { some: { userId: req.user.userId } } }
                ]
            },
            include: { members: true }
        });
        res.status(200).json(groups);
    } catch (error) {
        console.error('Fetch groups error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Get specific group
app.get('/api/groups/:id', authenticateToken, async (req, res) => {
    try {
        const groupId = parseInt(req.params.id);
        const group = await prisma.group.findUnique({
            where: { id: groupId },
            include: { members: true }
        });
        
        if (!group) return res.status(404).json({ error: 'Group not found' });
        
        // Ensure user is member or creator
        const isMember = group.members.some(m => m.userId === req.user.userId);
        if (group.createdBy !== req.user.userId && !isMember) {
            return res.status(403).json({ error: 'Access denied' });
        }
        
        res.json(group);
    } catch (error) {
        console.error('Fetch specific group error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Add Member to Group API
app.post('/api/groups/:id/members', authenticateToken, async (req, res) => {
    try {
        const groupId = parseInt(req.params.id);
        const { email } = req.body;
        
        if (!email) return res.status(400).json({ error: 'Email is required' });

        const group = await prisma.group.findUnique({ where: { id: groupId } });
        if (!group) return res.status(404).json({ error: 'Group not found' });
        if (group.createdBy !== req.user.userId) return res.status(403).json({ error: 'Only creator can add members' });

        const targetUser = await prisma.user.findUnique({ where: { email } });
        if (!targetUser) return res.status(404).json({ error: 'User not found with this email' });

        // Check if already an active member
        const activeMember = await prisma.groupMember.findFirst({
            where: {
                groupId,
                userId: targetUser.id,
                leftAt: null
            }
        });
        
        if (activeMember) return res.status(400).json({ error: 'User is already an active member' });

        const member = await prisma.groupMember.create({
            data: {
                groupId,
                userId: targetUser.id
            }
        });
        
        res.status(201).json(member);
    } catch (error) {
        console.error('Add member error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Get Group Members Timeline
app.get('/api/groups/:id/members', authenticateToken, async (req, res) => {
    try {
        const groupId = parseInt(req.params.id);
        
        const group = await prisma.group.findUnique({
            where: { id: groupId },
            include: { members: { include: { user: { select: { id: true, name: true, email: true } } } } }
        });
        
        if (!group) return res.status(404).json({ error: 'Group not found' });
        
        const isMember = group.members.some(m => m.userId === req.user.userId && m.leftAt === null);
        if (group.createdBy !== req.user.userId && !isMember) {
            return res.status(403).json({ error: 'Access denied' });
        }

        const currentMembers = group.members.filter(m => m.leftAt === null);
        const formerMembers = group.members.filter(m => m.leftAt !== null);
        
        // Sort history chronologically
        const membershipHistory = [...group.members].sort((a, b) => new Date(a.joinedAt) - new Date(b.joinedAt));

        res.json({ currentMembers, formerMembers, membershipHistory });
    } catch (error) {
        console.error('Fetch members error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Remove Member
app.patch('/api/groups/:id/members/:memberId/remove', authenticateToken, async (req, res) => {
    try {
        const groupId = parseInt(req.params.id);
        const memberId = parseInt(req.params.memberId);
        
        const group = await prisma.group.findUnique({ where: { id: groupId } });
        if (!group) return res.status(404).json({ error: 'Group not found' });
        if (group.createdBy !== req.user.userId) return res.status(403).json({ error: 'Only creator can remove members' });

        const member = await prisma.groupMember.findUnique({ where: { id: memberId } });
        if (!member || member.groupId !== groupId) return res.status(404).json({ error: 'Member record not found' });
        if (member.leftAt) return res.status(400).json({ error: 'Member is already removed' });

        // Balance check: Cannot leave if not settled
        const { calculateUserBreakdown } = require('./utils/balanceEngine');
        const expenses = await prisma.expense.findMany({
            where: { groupId },
            include: { participants: true, payer: { select: { name: true } } }
        });
        const breakdown = calculateUserBreakdown(expenses, member.userId);
        if (breakdown.netBalance !== 0) {
            return res.status(400).json({ 
                error: `Cannot remove member without settling up. Current balance: ${breakdown.netBalance > 0 ? 'Gets back' : 'Owes'} ${Math.abs(breakdown.netBalance)}` 
            });
        }

        const updatedMember = await prisma.groupMember.update({
            where: { id: memberId },
            data: { leftAt: new Date() }
        });
        
        res.json(updatedMember);
    } catch (error) {
        console.error('Remove member error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Update group
app.put('/api/groups/:id', authenticateToken, async (req, res) => {
    try {
        const groupId = parseInt(req.params.id);
        const { name } = req.body;
        
        const group = await prisma.group.findUnique({ where: { id: groupId } });
        if (!group) return res.status(404).json({ error: 'Group not found' });
        if (group.createdBy !== req.user.userId) return res.status(403).json({ error: 'Only creator can edit' });

        const updated = await prisma.group.update({
            where: { id: groupId },
            data: { name }
        });
        res.json(updated);
    } catch (error) {
        console.error('Update group error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Delete group
app.delete('/api/groups/:id', authenticateToken, async (req, res) => {
    try {
        const groupId = parseInt(req.params.id);
        
        const group = await prisma.group.findUnique({ where: { id: groupId } });
        if (!group) return res.status(404).json({ error: 'Group not found' });
        if (group.createdBy !== req.user.userId) return res.status(403).json({ error: 'Only creator can delete' });

        await prisma.group.delete({ where: { id: groupId } });
        res.json({ message: 'Group deleted successfully' });
    } catch (error) {
        console.error('Delete group error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// --- EXPENSE MANAGEMENT APIs ---

// 1. Create Expense
app.post('/api/groups/:groupId/expenses', authenticateToken, async (req, res) => {
    try {
        const groupId = parseInt(req.params.groupId);
        const { description, amount, currency, expenseDate, payerId, splitType, notes, participants } = req.body;
        
        // Basic Validations
        if (!description || !amount || amount <= 0 || !currency || !payerId || !splitType || !participants || participants.length === 0) {
            return res.status(400).json({ error: 'Missing required fields or invalid amount/participants' });
        }

        // Verify group exists and user has access
        const group = await prisma.group.findUnique({ where: { id: groupId }, include: { members: true } });
        if (!group) return res.status(404).json({ error: 'Group not found' });
        
        const isUserMember = group.members.some(m => m.userId === req.user.userId && !m.leftAt);
        if (!isUserMember && group.createdBy !== req.user.userId) return res.status(403).json({ error: 'Access denied' });

        // Verify payer is an active member
        const isPayerActive = group.members.some(m => m.userId === payerId && !m.leftAt);
        if (!isPayerActive) return res.status(400).json({ error: 'Payer must be an active member' });

        // Validate Split
        let totalVal = 0;
        if (splitType === 'EXACT') {
            totalVal = participants.reduce((sum, p) => sum + (p.shareValue || 0), 0);
            if (Math.abs(totalVal - amount) > 0.01) return res.status(400).json({ error: 'Sum of exact splits must equal the total amount' });
        } else if (splitType === 'PERCENTAGE') {
            totalVal = participants.reduce((sum, p) => sum + (p.shareValue || 0), 0);
            if (Math.abs(totalVal - 100) > 0.01) return res.status(400).json({ error: 'Sum of percentages must equal 100' });
        } else if (splitType === 'EQUAL') {
            // shareValue can be null
        } else {
            return res.status(400).json({ error: 'Invalid split type' });
        }

        // Create Expense and Participants in a transaction
        const expense = await prisma.$transaction(async (tx) => {
            const exp = await tx.expense.create({
                data: {
                    description,
                    amount,
                    currency,
                    expenseDate: expenseDate ? new Date(expenseDate) : new Date(),
                    splitType,
                    notes,
                    groupId,
                    payerId,
                    createdBy: req.user.userId
                }
            });

            const participantData = participants.map(p => ({
                expenseId: exp.id,
                userId: p.userId,
                shareValue: splitType === 'EQUAL' ? null : p.shareValue
            }));

            await tx.expenseParticipant.createMany({ data: participantData });

            return exp;
        });

        res.status(201).json(expense);
    } catch (error) {
        console.error('Create expense error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// 2. Get All Expenses for a Group
app.get('/api/groups/:groupId/expenses', authenticateToken, async (req, res) => {
    try {
        const groupId = parseInt(req.params.groupId);
        
        const group = await prisma.group.findUnique({ where: { id: groupId }, include: { members: true } });
        if (!group) return res.status(404).json({ error: 'Group not found' });
        
        const isUserMember = group.members.some(m => m.userId === req.user.userId);
        if (!isUserMember && group.createdBy !== req.user.userId) return res.status(403).json({ error: 'Access denied' });

        const expenses = await prisma.expense.findMany({
            where: { groupId },
            include: {
                payer: { select: { id: true, name: true } },
                creator: { select: { id: true, name: true } },
                participants: { include: { user: { select: { id: true, name: true } } } }
            },
            orderBy: { expenseDate: 'desc' }
        });

        res.json(expenses);
    } catch (error) {
        console.error('Fetch expenses error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// 3. Get Single Expense
app.get('/api/expenses/:expenseId', authenticateToken, async (req, res) => {
    try {
        const expenseId = parseInt(req.params.expenseId);
        
        const expense = await prisma.expense.findUnique({
            where: { id: expenseId },
            include: {
                group: { include: { members: true } },
                payer: { select: { id: true, name: true } },
                creator: { select: { id: true, name: true } },
                participants: { include: { user: { select: { id: true, name: true } } } }
            }
        });
        
        if (!expense) return res.status(404).json({ error: 'Expense not found' });
        
        const isUserMember = expense.group.members.some(m => m.userId === req.user.userId);
        if (!isUserMember && expense.group.createdBy !== req.user.userId) return res.status(403).json({ error: 'Access denied' });

        res.json(expense);
    } catch (error) {
        console.error('Fetch expense error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// 4. Update Expense
app.put('/api/expenses/:expenseId', authenticateToken, async (req, res) => {
    try {
        const expenseId = parseInt(req.params.expenseId);
        const { description, amount, currency, expenseDate, payerId, splitType, notes, participants } = req.body;
        
        const expense = await prisma.expense.findUnique({
            where: { id: expenseId },
            include: { group: { include: { members: true } } }
        });
        if (!expense) return res.status(404).json({ error: 'Expense not found' });
        
        // Only creator can edit
        if (expense.createdBy !== req.user.userId) return res.status(403).json({ error: 'Only creator can edit this expense' });

        // Basic Validations
        if (!description || !amount || amount <= 0 || !currency || !payerId || !splitType || !participants || participants.length === 0) {
            return res.status(400).json({ error: 'Missing required fields or invalid amount/participants' });
        }

        // Verify payer is an active member
        const isPayerActive = expense.group.members.some(m => m.userId === payerId && !m.leftAt);
        if (!isPayerActive) return res.status(400).json({ error: 'Payer must be an active member' });

        // Validate Split
        let totalVal = 0;
        if (splitType === 'EXACT') {
            totalVal = participants.reduce((sum, p) => sum + (p.shareValue || 0), 0);
            if (Math.abs(totalVal - amount) > 0.01) return res.status(400).json({ error: 'Sum of exact splits must equal the total amount' });
        } else if (splitType === 'PERCENTAGE') {
            totalVal = participants.reduce((sum, p) => sum + (p.shareValue || 0), 0);
            if (Math.abs(totalVal - 100) > 0.01) return res.status(400).json({ error: 'Sum of percentages must equal 100' });
        }

        const updatedExpense = await prisma.$transaction(async (tx) => {
            // Delete old participants
            await tx.expenseParticipant.deleteMany({ where: { expenseId } });

            // Update expense
            const exp = await tx.expense.update({
                where: { id: expenseId },
                data: {
                    description,
                    amount,
                    currency,
                    expenseDate: expenseDate ? new Date(expenseDate) : new Date(),
                    splitType,
                    notes,
                    payerId
                }
            });

            // Recreate participants
            const participantData = participants.map(p => ({
                expenseId: exp.id,
                userId: p.userId,
                shareValue: splitType === 'EQUAL' ? null : p.shareValue
            }));

            await tx.expenseParticipant.createMany({ data: participantData });

            return exp;
        });

        res.json(updatedExpense);
    } catch (error) {
        console.error('Update expense error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// 5. Delete Expense
app.delete('/api/expenses/:expenseId', authenticateToken, async (req, res) => {
    try {
        const expenseId = parseInt(req.params.expenseId);
        
        const expense = await prisma.expense.findUnique({ where: { id: expenseId } });
        if (!expense) return res.status(404).json({ error: 'Expense not found' });
        
        if (expense.createdBy !== req.user.userId && expense.payerId !== req.user.userId) {
            return res.status(403).json({ error: 'Only creator or payer can delete this expense' });
        }

        await prisma.expense.delete({ where: { id: expenseId } });
        res.json({ message: 'Expense deleted successfully' });
    } catch (error) {
        console.error('Delete expense error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// 6. Balance APIs
app.get('/api/groups/:groupId/balances', authenticateToken, getGroupBalances);
app.get('/api/groups/:groupId/balances/:userId', authenticateToken, getUserBalance);

// 7. CSV Upload API
app.post('/api/groups/:groupId/expenses/csv', authenticateToken, upload.single('file'), uploadCsvExpenses);

app.listen(3000, () => {
    console.log('Server started on port 3000');
});
