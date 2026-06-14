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
            text: `Your OTP for password reset is ${otp}. It will expire in 10 minutes.`
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

app.listen(3000, () => {
    console.log('Server started on port 3000');
});
