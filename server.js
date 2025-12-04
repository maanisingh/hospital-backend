// Hospital SaaS Backend - Express + Prisma
// Simple, fast, and fully functional replacement for Directus

const express = require('express');
const cors = require('cors');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { PrismaClient } = require('@prisma/client');

const app = express();
const prisma = new PrismaClient();
const PORT = process.env.PORT || 5000;
const JWT_SECRET = process.env.JWT_SECRET || 'hospital-saas-jwt-secret-2024';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';

// Middleware
app.use(cors());
app.use(express.json());

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'OK', message: 'Hospital SaaS Backend is running' });
});

// Seed endpoint - one-time database initialization
app.post('/api/seed', async (req, res) => {
  try {
    // Check if new super admin already exists
    const existingAdmin = await prisma.user.findUnique({
      where: { email: 'admin@novoraplus.com' }
    });

    if (existingAdmin) {
      return res.status(400).json({
        errors: [{ message: 'Database already seeded. Demo accounts exist.' }]
      });
    }

    // Create City General Hospital organization
    const cityGeneralOrg = await prisma.organization.create({
      data: {
        code: 'cgh001',
        name: 'City General Hospital',
        businessName: 'City General Hospital Pvt Ltd',
        address: '456 Healthcare Ave',
        city: 'Metro City',
        state: 'State',
        pincode: '100001',
        country: 'Country',
        phone: '+1234567890',
        email: 'info@citygeneralhospital.com',
        status: 'active'
      }
    });

    // Hash passwords for all users
    const superAdminPass = await bcrypt.hash('NovoraPlus@2024!', 10);
    const hospitalAdminPass = await bcrypt.hash('Hospital@2024!', 10);
    const staffPass = await bcrypt.hash('Staff@2024!', 10);

    // Create super admin user (NovoraPlus admin)
    const superAdmin = await prisma.user.create({
      data: {
        email: 'admin@novoraplus.com',
        password: superAdminPass,
        firstName: 'NovoraPlus',
        lastName: 'Admin',
        role: 'SuperAdmin',
        phone: '+1234567890',
        status: 'active'
      }
    });

    // Create hospital admin for City General Hospital
    const hospitalAdmin = await prisma.user.create({
      data: {
        email: 'admin@citygeneralhospital.com',
        password: hospitalAdminPass,
        firstName: 'Hospital',
        lastName: 'Admin',
        role: 'HospitalAdmin',
        phone: '+1234567891',
        status: 'active',
        orgId: cityGeneralOrg.id
      }
    });

    // Create doctor
    const doctor = await prisma.user.create({
      data: {
        email: 'doctor@citygeneralhospital.com',
        password: staffPass,
        firstName: 'John',
        lastName: 'Smith',
        role: 'Doctor',
        phone: '+1234567892',
        status: 'active',
        orgId: cityGeneralOrg.id
      }
    });

    // Create nurse
    const nurse = await prisma.user.create({
      data: {
        email: 'nurse@citygeneralhospital.com',
        password: staffPass,
        firstName: 'Sarah',
        lastName: 'Johnson',
        role: 'Nurse',
        phone: '+1234567893',
        status: 'active',
        orgId: cityGeneralOrg.id
      }
    });

    // Create receptionist
    const receptionist = await prisma.user.create({
      data: {
        email: 'reception@citygeneralhospital.com',
        password: staffPass,
        firstName: 'Emily',
        lastName: 'Davis',
        role: 'Receptionist',
        phone: '+1234567894',
        status: 'active',
        orgId: cityGeneralOrg.id
      }
    });

    // Create lab technician
    const labTech = await prisma.user.create({
      data: {
        email: 'lab@citygeneralhospital.com',
        password: staffPass,
        firstName: 'Mike',
        lastName: 'Wilson',
        role: 'LabTechnician',
        phone: '+1234567895',
        status: 'active',
        orgId: cityGeneralOrg.id
      }
    });

    // Create pharmacist
    const pharmacist = await prisma.user.create({
      data: {
        email: 'pharmacy@citygeneralhospital.com',
        password: staffPass,
        firstName: 'Lisa',
        lastName: 'Brown',
        role: 'Pharmacist',
        phone: '+1234567896',
        status: 'active',
        orgId: cityGeneralOrg.id
      }
    });

    res.json({
      data: {
        message: 'Database seeded successfully with all demo accounts!',
        organization: { id: cityGeneralOrg.id, name: cityGeneralOrg.name, code: cityGeneralOrg.code },
        users: [
          { email: superAdmin.email, role: superAdmin.role },
          { email: hospitalAdmin.email, role: hospitalAdmin.role },
          { email: doctor.email, role: doctor.role },
          { email: nurse.email, role: nurse.role },
          { email: receptionist.email, role: receptionist.role },
          { email: labTech.email, role: labTech.role },
          { email: pharmacist.email, role: pharmacist.role }
        ],
        credentials: {
          superAdmin: {
            email: 'admin@novoraplus.com',
            password: 'NovoraPlus@2024!'
          },
          hospitalAdmin: {
            email: 'admin@citygeneralhospital.com',
            password: 'Hospital@2024!'
          },
          staff: {
            password: 'Staff@2024!',
            accounts: [
              'doctor@citygeneralhospital.com',
              'nurse@citygeneralhospital.com',
              'reception@citygeneralhospital.com',
              'lab@citygeneralhospital.com',
              'pharmacy@citygeneralhospital.com'
            ]
          }
        }
      }
    });
  } catch (error) {
    console.error('Seed error:', error);
    res.status(500).json({
      errors: [{ message: 'Failed to seed database', details: error.message }]
    });
  }
});

// Add missing demo accounts endpoint
app.post('/api/seed/demo-accounts', async (req, res) => {
  try {
    // Check if City General Hospital org exists
    let cityGeneralOrg = await prisma.organization.findUnique({
      where: { code: 'cgh001' }
    });

    // Create it if it doesn't exist
    if (!cityGeneralOrg) {
      cityGeneralOrg = await prisma.organization.create({
        data: {
          code: 'cgh001',
          name: 'City General Hospital',
          businessName: 'City General Hospital Pvt Ltd',
          address: '456 Healthcare Ave',
          city: 'Metro City',
          state: 'State',
          pincode: '100001',
          country: 'Country',
          phone: '+1234567890',
          email: 'info@citygeneralhospital.com',
          status: 'active'
        }
      });
    }

    // Hash passwords for all users
    const superAdminPass = await bcrypt.hash('NovoraPlus@2024!', 10);
    const hospitalAdminPass = await bcrypt.hash('Hospital@2024!', 10);
    const staffPass = await bcrypt.hash('Staff@2024!', 10);

    const createdUsers = [];
    const skippedUsers = [];

    // Helper function to create user if not exists
    async function createUserIfNotExists(userData) {
      const existing = await prisma.user.findUnique({
        where: { email: userData.email }
      });

      if (existing) {
        skippedUsers.push(userData.email);
        return null;
      }

      const user = await prisma.user.create({ data: userData });
      createdUsers.push({ email: user.email, role: user.role });
      return user;
    }

    // Create all demo accounts
    await createUserIfNotExists({
      email: 'admin@novoraplus.com',
      password: superAdminPass,
      firstName: 'NovoraPlus',
      lastName: 'Admin',
      role: 'SuperAdmin',
      phone: '+1234567890',
      status: 'active'
    });

    await createUserIfNotExists({
      email: 'admin@citygeneralhospital.com',
      password: hospitalAdminPass,
      firstName: 'Hospital',
      lastName: 'Admin',
      role: 'HospitalAdmin',
      phone: '+1234567891',
      status: 'active',
      orgId: cityGeneralOrg.id
    });

    await createUserIfNotExists({
      email: 'doctor@citygeneralhospital.com',
      password: staffPass,
      firstName: 'John',
      lastName: 'Smith',
      role: 'Doctor',
      phone: '+1234567892',
      status: 'active',
      orgId: cityGeneralOrg.id
    });

    await createUserIfNotExists({
      email: 'nurse@citygeneralhospital.com',
      password: staffPass,
      firstName: 'Sarah',
      lastName: 'Johnson',
      role: 'Nurse',
      phone: '+1234567893',
      status: 'active',
      orgId: cityGeneralOrg.id
    });

    await createUserIfNotExists({
      email: 'reception@citygeneralhospital.com',
      password: staffPass,
      firstName: 'Emily',
      lastName: 'Davis',
      role: 'Receptionist',
      phone: '+1234567894',
      status: 'active',
      orgId: cityGeneralOrg.id
    });

    await createUserIfNotExists({
      email: 'lab@citygeneralhospital.com',
      password: staffPass,
      firstName: 'Mike',
      lastName: 'Wilson',
      role: 'LabTechnician',
      phone: '+1234567895',
      status: 'active',
      orgId: cityGeneralOrg.id
    });

    await createUserIfNotExists({
      email: 'pharmacy@citygeneralhospital.com',
      password: staffPass,
      firstName: 'Lisa',
      lastName: 'Brown',
      role: 'Pharmacist',
      phone: '+1234567896',
      status: 'active',
      orgId: cityGeneralOrg.id
    });

    res.json({
      data: {
        message: 'Demo accounts processed successfully!',
        organization: { id: cityGeneralOrg.id, name: cityGeneralOrg.name },
        created: createdUsers,
        skipped: skippedUsers,
        credentials: {
          superAdmin: {
            email: 'admin@novoraplus.com',
            password: 'NovoraPlus@2024!'
          },
          hospitalAdmin: {
            email: 'admin@citygeneralhospital.com',
            password: 'Hospital@2024!'
          },
          staff: {
            password: 'Staff@2024!',
            accounts: [
              'doctor@citygeneralhospital.com',
              'nurse@citygeneralhospital.com',
              'reception@citygeneralhospital.com',
              'lab@citygeneralhospital.com',
              'pharmacy@citygeneralhospital.com'
            ]
          }
        }
      }
    });
  } catch (error) {
    console.error('Demo accounts error:', error);
    res.status(500).json({
      errors: [{ message: 'Failed to create demo accounts', details: error.message }]
    });
  }
});

// ============== AUTHENTICATION API ==============

// Login endpoint - compatible with Directus structure
app.post('/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        errors: [{ message: 'Email and password are required' }]
      });
    }

    // Find user by email
    const user = await prisma.user.findUnique({
      where: { email }
    });

    if (!user) {
      return res.status(401).json({
        errors: [{ message: 'Invalid email or password' }]
      });
    }

    // Check if user is active
    if (user.status !== 'active') {
      return res.status(401).json({
        errors: [{ message: 'Account is not active' }]
      });
    }

    // Verify password
    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      return res.status(401).json({
        errors: [{ message: 'Invalid email or password' }]
      });
    }

    // Generate JWT tokens
    const access_token = jwt.sign(
      { id: user.id, email: user.email, role: user.role },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRES_IN }
    );

    const refresh_token = jwt.sign(
      { id: user.id, type: 'refresh' },
      JWT_SECRET,
      { expiresIn: '30d' }
    );

    // Calculate expiration time in milliseconds
    const expiresInMs = 7 * 24 * 60 * 60 * 1000; // 7 days in ms

    res.json({
      data: {
        access_token,
        refresh_token,
        expires: expiresInMs,
        expires_at: Date.now() + expiresInMs
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ errors: [{ message: 'Login failed' }] });
  }
});

// Logout endpoint
app.post('/auth/logout', async (req, res) => {
  // Since we're using JWT tokens, logout is handled client-side
  // We just acknowledge the request
  res.json({ data: { message: 'Logged out successfully' } });
});

// Auth middleware
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

  if (!token) {
    return res.status(401).json({
      errors: [{ message: 'Access token required' }]
    });
  }

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({
        errors: [{ message: 'Invalid or expired token' }]
      });
    }
    req.user = user;
    next();
  });
};

// Get current user - compatible with Directus /users/me
app.get('/users/me', authenticateToken, async (req, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        orgId: true,
        status: true,
        avatar: true
      }
    });

    if (!user) {
      return res.status(404).json({
        errors: [{ message: 'User not found' }]
      });
    }

    // Format response to match Directus structure with role object
    res.json({
      data: {
        id: user.id,
        email: user.email,
        first_name: user.firstName,
        last_name: user.lastName,
        role: {
          id: user.role,
          name: user.role
        },
        org_id: user.orgId,
        status: user.status,
        avatar: user.avatar
      }
    });
  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({ errors: [{ message: 'Failed to get user' }] });
  }
});

// ============== SUBSCRIPTION PLANS API ==============

// GET all subscription plans
app.get('/api/subscription-plans', async (req, res) => {
  try {
    const plans = await prisma.subscriptionPlan.findMany({
      orderBy: [
        { sort: 'asc' },
        { dateCreated: 'desc' }
      ]
    });
    res.json({ data: plans, count: plans.length });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET single subscription plan
app.get('/api/subscription-plans/:id', async (req, res) => {
  try {
    const plan = await prisma.subscriptionPlan.findUnique({
      where: { id: req.params.id },
      include: { paymentHistory: true }
    });
    if (!plan) return res.status(404).json({ error: 'Plan not found' });
    res.json({ data: plan });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST create subscription plan
app.post('/api/subscription-plans', async (req, res) => {
  try {
    const data = { ...req.body };

    // Handle legacy field names: monthlyPrice -> price with billing_cycle
    if (data.monthlyPrice && !data.price) {
      data.price = data.monthlyPrice;
      data.billingCycle = 'monthly';
      delete data.monthlyPrice;
      delete data.yearlyPrice; // Remove if exists
    }

    const plan = await prisma.subscriptionPlan.create({
      data
    });
    res.status(201).json({ data: plan });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// PATCH update subscription plan
app.patch('/api/subscription-plans/:id', async (req, res) => {
  try {
    const plan = await prisma.subscriptionPlan.update({
      where: { id: req.params.id },
      data: req.body
    });
    res.json({ data: plan });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// DELETE subscription plan
app.delete('/api/subscription-plans/:id', async (req, res) => {
  try {
    await prisma.subscriptionPlan.delete({
      where: { id: req.params.id }
    });
    res.json({ message: 'Plan deleted successfully' });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// ============== SUPERADMIN SETTINGS API ==============

// GET superadmin settings (singleton)
app.get('/api/superadmin-settings', async (req, res) => {
  try {
    const settings = await prisma.superAdminSettings.findFirst();
    if (!settings) {
      // Create default settings if none exist
      const defaultSettings = await prisma.superAdminSettings.create({
        data: {
          platformName: 'Hospital SaaS Platform',
          supportEmail: 'support@hospital-saas.com',
          currency: 'USD',
          trialDays: 14,
          maintenanceMode: false
        }
      });
      return res.json({ data: defaultSettings });
    }
    res.json({ data: settings });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// PATCH update superadmin settings
app.patch('/api/superadmin-settings/:id', async (req, res) => {
  try {
    const settings = await prisma.superAdminSettings.update({
      where: { id: req.params.id },
      data: req.body
    });
    res.json({ data: settings });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// ============== PROMOTIONS API ==============

// GET all promotions
app.get('/api/promotions', async (req, res) => {
  try {
    const { active } = req.query;
    const where = active === 'true' ? { isActive: true } : {};

    const promotions = await prisma.promotion.findMany({
      where,
      orderBy: { dateCreated: 'desc' }
    });
    res.json({ data: promotions, count: promotions.length });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET single promotion
app.get('/api/promotions/:id', async (req, res) => {
  try {
    const promotion = await prisma.promotion.findUnique({
      where: { id: req.params.id }
    });
    if (!promotion) return res.status(404).json({ error: 'Promotion not found' });
    res.json({ data: promotion });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET promotion by code
app.get('/api/promotions/code/:code', async (req, res) => {
  try {
    const promotion = await prisma.promotion.findUnique({
      where: { code: req.params.code }
    });
    if (!promotion) return res.status(404).json({ error: 'Promotion not found' });
    res.json({ data: promotion });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST create promotion
app.post('/api/promotions', async (req, res) => {
  try {
    const data = { ...req.body };

    // Check if promotion code already exists
    if (data.code) {
      const existing = await prisma.promotion.findUnique({
        where: { code: data.code }
      });
      if (existing) {
        return res.status(400).json({
          errors: [{ message: `Promotion code '${data.code}' already exists` }]
        });
      }
    }

    // Convert date strings to ISO-8601 DateTime format if needed
    if (data.startDate && typeof data.startDate === 'string' && !data.startDate.includes('T')) {
      data.startDate = new Date(data.startDate + 'T00:00:00.000Z').toISOString();
    }
    if (data.endDate && typeof data.endDate === 'string' && !data.endDate.includes('T')) {
      data.endDate = new Date(data.endDate + 'T23:59:59.999Z').toISOString();
    }

    const promotion = await prisma.promotion.create({
      data
    });
    res.status(201).json({ data: promotion });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// PATCH update promotion
app.patch('/api/promotions/:id', async (req, res) => {
  try {
    const promotion = await prisma.promotion.update({
      where: { id: req.params.id },
      data: req.body
    });
    res.json({ data: promotion });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// DELETE promotion
app.delete('/api/promotions/:id', async (req, res) => {
  try {
    await prisma.promotion.delete({
      where: { id: req.params.id }
    });
    res.json({ message: 'Promotion deleted successfully' });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// ============== SURGICAL HISTORY API ==============

// GET all surgical histories
app.get('/api/surgical-history', async (req, res) => {
  try {
    const { patientId } = req.query;
    const where = patientId ? { patientId } : {};

    const histories = await prisma.surgicalHistory.findMany({
      where,
      orderBy: { surgeryDate: 'desc' }
    });
    res.json({ data: histories, count: histories.length });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET single surgical history
app.get('/api/surgical-history/:id', async (req, res) => {
  try {
    const history = await prisma.surgicalHistory.findUnique({
      where: { id: req.params.id }
    });
    if (!history) return res.status(404).json({ error: 'Record not found' });
    res.json({ data: history });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST create surgical history
app.post('/api/surgical-history', async (req, res) => {
  try {
    const history = await prisma.surgicalHistory.create({
      data: req.body
    });
    res.status(201).json({ data: history });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// PATCH update surgical history
app.patch('/api/surgical-history/:id', async (req, res) => {
  try {
    const history = await prisma.surgicalHistory.update({
      where: { id: req.params.id },
      data: req.body
    });
    res.json({ data: history });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// DELETE surgical history
app.delete('/api/surgical-history/:id', async (req, res) => {
  try {
    await prisma.surgicalHistory.delete({
      where: { id: req.params.id }
    });
    res.json({ message: 'Record deleted successfully' });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// ============== PAYMENT HISTORY API ==============

// GET all payment histories
app.get('/api/payment-history', async (req, res) => {
  try {
    const { hospitalId, status } = req.query;
    const where = {};
    if (hospitalId) where.hospitalId = hospitalId;
    if (status) where.status = status;

    const payments = await prisma.paymentHistory.findMany({
      where,
      include: { subscriptionPlan: true },
      orderBy: { dateCreated: 'desc' }
    });
    res.json({ data: payments, count: payments.length });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET single payment history
app.get('/api/payment-history/:id', async (req, res) => {
  try {
    const payment = await prisma.paymentHistory.findUnique({
      where: { id: req.params.id },
      include: { subscriptionPlan: true }
    });
    if (!payment) return res.status(404).json({ error: 'Payment not found' });
    res.json({ data: payment });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST create payment history
app.post('/api/payment-history', async (req, res) => {
  try {
    const payment = await prisma.paymentHistory.create({
      data: req.body,
      include: { subscriptionPlan: true }
    });
    res.status(201).json({ data: payment });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// PATCH update payment history
app.patch('/api/payment-history/:id', async (req, res) => {
  try {
    const payment = await prisma.paymentHistory.update({
      where: { id: req.params.id },
      data: req.body,
      include: { subscriptionPlan: true }
    });
    res.json({ data: payment });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// ============== ORGANIZATION API ==============

// Import organization routes
const organizationRoutes = require('./routes/organizations');
app.use('/api/organizations', organizationRoutes);

// ============== PATIENT API ==============

// Import patient routes
const patientRoutes = require('./routes/patients');
app.use('/api/patients', patientRoutes);

// ============== DEPARTMENT & BED MANAGEMENT API ==============

// Import department routes
const departmentRoutes = require('./routes/departments');
app.use('/api/departments', departmentRoutes);

// ============== OPD MODULE API ==============

// Import OPD routes
const opdRoutes = require('./routes/opd');
app.use('/api/opd', opdRoutes);

// ============== IPD MODULE API ==============

// Import IPD routes
const ipdRoutes = require('./routes/ipd');
app.use('/api/ipd', ipdRoutes);

// ============== APPOINTMENTS API ==============

// Import appointment routes
const appointmentRoutes = require('./routes/appointments');
app.use('/api/appointments', appointmentRoutes);

// ============== BILLING MODULE API ==============

// Import billing routes
const billingRoutes = require('./routes/billing');
app.use('/api/billing', billingRoutes);

// ============== LAB MODULE API ==============

// Import lab routes
const labRoutes = require('./routes/lab');
app.use('/api/lab', labRoutes);

// ============== RADIOLOGY MODULE API ==============

// Import radiology routes
const radiologyRoutes = require('./routes/radiology');
app.use('/api/radiology', radiologyRoutes);

// ============== PHARMACY MODULE API ==============

// Import pharmacy routes
const pharmacyRoutes = require('./routes/pharmacy');
app.use('/api/pharmacy', pharmacyRoutes);

// ============== USER MANAGEMENT API ==============

// Import user management routes
const userRoutes = require('./routes/users');
app.use('/api/users', userRoutes);

// ============== STAFF MANAGEMENT API ==============

// Import staff routes
const staffRoutes = require('./routes/staff');
app.use('/api/staff', staffRoutes);

// ============== BED MANAGEMENT API ==============

// Import bed routes
const bedRoutes = require('./routes/beds');
app.use('/api/beds', bedRoutes);

// ============== DASHBOARD API (ROLE-BASED) ==============

// Import dashboard routes
const dashboardRoutes = require('./routes/dashboard');
app.use('/api/dashboard', dashboardRoutes);

// ============== STATS/ANALYTICS ENDPOINTS ==============

// GET dashboard stats - role-aware endpoint that redirects to appropriate dashboard
app.get('/api/stats/dashboard', authenticateToken, async (req, res) => {
  try {
    const userRole = req.user.role;
    const { orgId } = req.query;

    // Route to appropriate dashboard based on role
    const dashboardMap = {
      'SuperAdmin': '/api/dashboard/superadmin',
      'HospitalAdmin': '/api/dashboard/hospital-admin',
      'Doctor': '/api/dashboard/doctor',
      'Nurse': '/api/dashboard/nurse',
      'Receptionist': '/api/dashboard/receptionist',
      'Pharmacist': '/api/dashboard/pharmacist',
      'LabTechnician': '/api/dashboard/lab-technician',
      'Radiologist': '/api/dashboard/radiologist',
      'Billing': '/api/dashboard/billing'
    };

    const dashboardPath = dashboardMap[userRole];

    if (!dashboardPath) {
      return res.status(403).json({
        errors: [{ message: 'Dashboard not available for your role' }]
      });
    }

    // For SuperAdmin, no orgId required
    if (userRole === 'SuperAdmin') {
      return res.redirect(dashboardPath);
    }

    // For other roles, orgId is required
    if (!orgId) {
      return res.status(400).json({
        errors: [{ message: 'Organization ID is required' }]
      });
    }

    res.redirect(`${dashboardPath}?orgId=${orgId}`);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  await prisma.$disconnect();
  process.exit(0);
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Hospital SaaS Backend running on port ${PORT}`);
  console.log(`📊 Health check: http://localhost:${PORT}/health`);
});
