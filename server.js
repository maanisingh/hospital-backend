// Hospital SaaS Backend - Express + Prisma
// Simple, fast, and fully functional replacement for Directus

const express = require('express');
const cors = require('cors');
const { PrismaClient } = require('@prisma/client');

const app = express();
const prisma = new PrismaClient();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'OK', message: 'Hospital SaaS Backend is running' });
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
    const plan = await prisma.subscriptionPlan.create({
      data: req.body
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
    const promotion = await prisma.promotion.create({
      data: req.body
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

// ============== STATS/ANALYTICS ENDPOINTS ==============

// GET dashboard stats
app.get('/api/stats/dashboard', async (req, res) => {
  try {
    const [totalPlans, activePlans, totalPromotions, activePromotions, totalPayments] = await Promise.all([
      prisma.subscriptionPlan.count(),
      prisma.subscriptionPlan.count({ where: { status: 'active' } }),
      prisma.promotion.count(),
      prisma.promotion.count({ where: { isActive: true } }),
      prisma.paymentHistory.count()
    ]);

    const totalRevenue = await prisma.paymentHistory.aggregate({
      where: { status: 'completed' },
      _sum: { amount: true }
    });

    res.json({
      data: {
        subscriptionPlans: { total: totalPlans, active: activePlans },
        promotions: { total: totalPromotions, active: activePromotions },
        payments: { total: totalPayments },
        revenue: { total: totalRevenue._sum.amount || 0 }
      }
    });
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
