require('dotenv').config();
const express = require('express');
const cors = require('cors');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const nodemailer = require('nodemailer');
const authenticateToken = require('./middleware/auth');
const { Pool } = require('pg');
const { PrismaPg } = require('@prisma/adapter-pg');
const { PrismaClient } = require('./generated/prisma');

const app = express();

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

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
        const { name } = req.body;
        if (!name) return res.status(400).json({ error: 'Group name is required' });

        const group = await prisma.group.create({
            data: {
                name,
                createdBy: req.user.userId,
                members: {
                    create: { userId: req.user.userId }
                }
            }
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

        // Check if already a member
        const existingMember = await prisma.groupMember.findUnique({
            where: {
                groupId_userId: {
                    groupId,
                    userId: targetUser.id
                }
            }
        });
        
        if (existingMember) return res.status(400).json({ error: 'User is already a member of this group' });

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

app.listen(3000, () => {
    console.log('Server started on port 3000');
});
