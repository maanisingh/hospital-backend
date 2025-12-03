// Billing Module Routes - Invoice & Payment Management
const express = require('express');
const router = express.Router();
const { PrismaClient } = require('@prisma/client');
const jwt = require('jsonwebtoken');
const {
  requirePermission,
  requireAdmin,
  requireSuperAdmin,
  enforceOrgScope
} = require('../middleware/rbac');

const prisma = new PrismaClient();
const JWT_SECRET = process.env.JWT_SECRET || 'hospital-saas-jwt-secret-2024';

// Auth middleware
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

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

// Helper to get user's org ID (SuperAdmin can see all)
function getUserOrgId(req) {
  if (req.query.orgId && req.user.role === 'SuperAdmin') {
    return req.query.orgId;
  }
  return req.user.orgId || req.query.orgId;
}

// Helper to generate invoice number
async function generateInvoiceNumber(orgId) {
  const year = new Date().getFullYear();
  const timestamp = Date.now().toString().slice(-6); // Last 6 digits of timestamp
  const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');

  // Try up to 5 times to find a unique number
  for (let attempt = 0; attempt < 5; attempt++) {
    const invoiceNumber = `INV${year}${timestamp}${random}${attempt}`;

    const existing = await prisma.invoice.findUnique({
      where: { invoiceNumber }
    });

    if (!existing) {
      return invoiceNumber;
    }
  }

  // Fallback: use UUID-based number
  return `INV${year}${Date.now()}`;
}

// Helper to generate receipt number
async function generateReceiptNumber(orgId) {
  const year = new Date().getFullYear();
  const timestamp = Date.now().toString().slice(-6);
  const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');

  // Try up to 5 times to find a unique number
  for (let attempt = 0; attempt < 5; attempt++) {
    const receiptNumber = `RCP${year}${timestamp}${random}${attempt}`;

    const existing = await prisma.payment.findUnique({
      where: { receiptNumber }
    });

    if (!existing) {
      return receiptNumber;
    }
  }

  // Fallback: use UUID-based number
  return `RCP${year}${Date.now()}`;
}

// ============== INVOICE ENDPOINTS ==============

// GET all invoices
router.get('/invoices', authenticateToken, async (req, res) => {
  try {
    const orgId = getUserOrgId(req);
    const {
      patientId,
      status,
      startDate,
      endDate,
      page = 1,
      limit = 20
    } = req.query;

    const where = {};
    if (orgId) where.orgId = orgId;
    if (patientId) where.patientId = patientId;
    if (status) where.status = status;

    if (startDate || endDate) {
      where.invoiceDate = {};
      if (startDate) where.invoiceDate.gte = new Date(startDate);
      if (endDate) where.invoiceDate.lte = new Date(endDate);
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const [invoices, total] = await Promise.all([
      prisma.invoice.findMany({
        where,
        include: {
          patient: {
            select: {
              id: true,
              name: true,
              patientCode: true
            }
          },
          items: true,
          payments: true
        },
        skip,
        take: parseInt(limit),
        orderBy: { invoiceDate: 'desc' }
      }),
      prisma.invoice.count({ where })
    ]);

    res.json({
      data: invoices,
      meta: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (error) {
    console.error('Get invoices error:', error);
    res.status(500).json({ errors: [{ message: error.message }] });
  }
});

// GET single invoice by ID
router.get('/invoices/:id', authenticateToken, async (req, res) => {
  try {
    const orgId = getUserOrgId(req);
    const where = { id: req.params.id };
    if (orgId) where.orgId = orgId;

    const invoice = await prisma.invoice.findUnique({
      where,
      include: {
        patient: {
          select: {
            id: true,
            name: true,
            patientCode: true,
            mobile: true,
            email: true
          }
        },
        items: true,
        payments: {
          orderBy: { paymentDate: 'desc' }
        }
      }
    });

    if (!invoice) {
      return res.status(404).json({
        errors: [{ message: 'Invoice not found' }]
      });
    }

    res.json({ data: invoice });
  } catch (error) {
    console.error('Get invoice error:', error);
    res.status(500).json({ errors: [{ message: error.message }] });
  }
});

// POST create new invoice
router.post('/invoices', authenticateToken, async (req, res) => {
  try {
    const orgId = getUserOrgId(req);
    const {
      patientId,
      invoiceDate,
      dueDate,
      items = [],
      discount = 0,
      tax = 0,
      notes
    } = req.body;

    if (!patientId) {
      return res.status(400).json({
        errors: [{ message: 'Patient ID is required' }]
      });
    }

    if (!items || items.length === 0) {
      return res.status(400).json({
        errors: [{ message: 'At least one invoice item is required' }]
      });
    }

    // Calculate totals
    const subtotal = items.reduce((sum, item) => {
      return sum + (item.quantity * item.unitPrice);
    }, 0);

    const discountAmount = (subtotal * discount) / 100;
    const taxAmount = ((subtotal - discountAmount) * tax) / 100;
    const totalAmount = subtotal - discountAmount + taxAmount;

    // Generate invoice number
    const invoiceNumber = await generateInvoiceNumber(orgId);

    // Create invoice with items
    const invoice = await prisma.invoice.create({
      data: {
        orgId,
        patientId,
        invoiceNumber,
        invoiceDate: invoiceDate ? new Date(invoiceDate) : new Date(),
        dueDate: dueDate ? new Date(dueDate) : null,
        subtotal,
        discount,
        discountAmount,
        tax,
        taxAmount,
        totalAmount,
        paidAmount: 0,
        balanceAmount: totalAmount,
        status: 'pending',
        notes,
        items: {
          create: items.map(item => ({
            description: item.description,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            totalPrice: item.quantity * item.unitPrice,
            itemType: item.itemType || 'service'
          }))
        }
      },
      include: {
        patient: {
          select: {
            id: true,
            name: true,
            patientCode: true
          }
        },
        items: true
      }
    });

    res.status(201).json({ data: invoice });
  } catch (error) {
    console.error('Create invoice error:', error);
    res.status(400).json({ errors: [{ message: error.message }] });
  }
});

// PATCH update invoice
router.patch('/invoices/:id', authenticateToken, async (req, res) => {
  try {
    const orgId = getUserOrgId(req);
    const where = { id: req.params.id };
    if (orgId) where.orgId = orgId;

    const { dueDate, notes, status } = req.body;

    const updateData = {};
    if (dueDate !== undefined) updateData.dueDate = dueDate ? new Date(dueDate) : null;
    if (notes !== undefined) updateData.notes = notes;
    if (status !== undefined) updateData.status = status;

    const invoice = await prisma.invoice.update({
      where,
      data: updateData,
      include: {
        patient: {
          select: {
            id: true,
            name: true,
            patientCode: true
          }
        },
        items: true,
        payments: true
      }
    });

    res.json({ data: invoice });
  } catch (error) {
    console.error('Update invoice error:', error);
    res.status(400).json({ errors: [{ message: error.message }] });
  }
});

// DELETE invoice
router.delete('/invoices/:id', authenticateToken, async (req, res) => {
  try {
    const orgId = getUserOrgId(req);
    const where = { id: req.params.id };
    if (orgId) where.orgId = orgId;

    // Check if invoice has payments
    const invoice = await prisma.invoice.findUnique({
      where,
      include: { payments: true }
    });

    if (!invoice) {
      return res.status(404).json({
        errors: [{ message: 'Invoice not found' }]
      });
    }

    if (invoice.payments && invoice.payments.length > 0) {
      return res.status(400).json({
        errors: [{ message: 'Cannot delete invoice with payments. Cancel payments first.' }]
      });
    }

    // Delete invoice and its items (cascade)
    await prisma.invoice.delete({ where });

    res.json({ message: 'Invoice deleted successfully' });
  } catch (error) {
    console.error('Delete invoice error:', error);
    res.status(400).json({ errors: [{ message: error.message }] });
  }
});

// ============== PAYMENT ENDPOINTS ==============

// GET all payments
router.get('/payments', authenticateToken, async (req, res) => {
  try {
    const orgId = getUserOrgId(req);
    const {
      invoiceId,
      patientId,
      paymentMethod,
      startDate,
      endDate,
      page = 1,
      limit = 20
    } = req.query;

    const where = {};
    if (orgId) where.orgId = orgId;
    if (invoiceId) where.invoiceId = invoiceId;
    if (patientId) where.invoice = { patientId };
    if (paymentMethod) where.paymentMethod = paymentMethod;

    if (startDate || endDate) {
      where.paymentDate = {};
      if (startDate) where.paymentDate.gte = new Date(startDate);
      if (endDate) where.paymentDate.lte = new Date(endDate);
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const [payments, total] = await Promise.all([
      prisma.payment.findMany({
        where,
        include: {
          invoice: {
            select: {
              id: true,
              invoiceNumber: true,
              totalAmount: true,
              patient: {
                select: {
                  id: true,
                  name: true,
                  patientCode: true
                }
              }
            }
          }
        },
        skip,
        take: parseInt(limit),
        orderBy: { paymentDate: 'desc' }
      }),
      prisma.payment.count({ where })
    ]);

    res.json({
      data: payments,
      meta: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (error) {
    console.error('Get payments error:', error);
    res.status(500).json({ errors: [{ message: error.message }] });
  }
});

// GET single payment by ID
router.get('/payments/:id', authenticateToken, async (req, res) => {
  try {
    const orgId = getUserOrgId(req);
    const where = { id: req.params.id };
    if (orgId) where.orgId = orgId;

    const payment = await prisma.payment.findUnique({
      where,
      include: {
        invoice: {
          include: {
            patient: {
              select: {
                id: true,
                name: true,
                patientCode: true,
                mobile: true,
                email: true
              }
            },
            items: true
          }
        }
      }
    });

    if (!payment) {
      return res.status(404).json({
        errors: [{ message: 'Payment not found' }]
      });
    }

    res.json({ data: payment });
  } catch (error) {
    console.error('Get payment error:', error);
    res.status(500).json({ errors: [{ message: error.message }] });
  }
});

// POST record new payment
router.post('/payments', authenticateToken, async (req, res) => {
  try {
    const orgId = getUserOrgId(req);
    const {
      invoiceId,
      amount,
      paymentMethod = 'cash',
      paymentDate,
      transactionId,
      notes
    } = req.body;

    if (!invoiceId) {
      return res.status(400).json({
        errors: [{ message: 'Invoice ID is required' }]
      });
    }

    if (!amount || amount <= 0) {
      return res.status(400).json({
        errors: [{ message: 'Valid payment amount is required' }]
      });
    }

    // Get invoice
    const invoice = await prisma.invoice.findUnique({
      where: { id: invoiceId }
    });

    if (!invoice) {
      return res.status(404).json({
        errors: [{ message: 'Invoice not found' }]
      });
    }

    if (invoice.status === 'cancelled') {
      return res.status(400).json({
        errors: [{ message: 'Cannot add payment to cancelled invoice' }]
      });
    }

    // Check if payment amount exceeds balance
    if (amount > invoice.balanceAmount) {
      return res.status(400).json({
        errors: [{ message: `Payment amount exceeds invoice balance (${invoice.balanceAmount})` }]
      });
    }

    // Generate receipt number
    const receiptNumber = await generateReceiptNumber(orgId);

    // Create payment and update invoice in transaction
    const payment = await prisma.$transaction(async (tx) => {
      // Create payment
      const newPayment = await tx.payment.create({
        data: {
          orgId,
          invoiceId,
          amount,
          paymentMethod,
          paymentDate: paymentDate ? new Date(paymentDate) : new Date(),
          receiptNumber,
          transactionId,
          notes
        }
      });

      // Update invoice amounts
      const newPaidAmount = invoice.paidAmount + amount;
      const newBalanceAmount = invoice.totalAmount - newPaidAmount;
      const newStatus = newBalanceAmount === 0 ? 'paid' : newBalanceAmount < invoice.totalAmount ? 'partial' : 'pending';

      await tx.invoice.update({
        where: { id: invoiceId },
        data: {
          paidAmount: newPaidAmount,
          balanceAmount: newBalanceAmount,
          status: newStatus
        }
      });

      return newPayment;
    });

    // Fetch payment with invoice details
    const paymentWithInvoice = await prisma.payment.findUnique({
      where: { id: payment.id },
      include: {
        invoice: {
          include: {
            patient: {
              select: {
                id: true,
                name: true,
                patientCode: true
              }
            }
          }
        }
      }
    });

    res.status(201).json({ data: paymentWithInvoice });
  } catch (error) {
    console.error('Create payment error:', error);
    res.status(400).json({ errors: [{ message: error.message }] });
  }
});

// DELETE payment (refund)
router.delete('/payments/:id', authenticateToken, async (req, res) => {
  try {
    const orgId = getUserOrgId(req);
    const where = { id: req.params.id };
    if (orgId) where.orgId = orgId;

    const payment = await prisma.payment.findUnique({
      where,
      include: { invoice: true }
    });

    if (!payment) {
      return res.status(404).json({
        errors: [{ message: 'Payment not found' }]
      });
    }

    // Delete payment and update invoice in transaction
    await prisma.$transaction(async (tx) => {
      // Delete payment
      await tx.payment.delete({ where: { id: req.params.id } });

      // Update invoice amounts
      const invoice = payment.invoice;
      const newPaidAmount = invoice.paidAmount - payment.amount;
      const newBalanceAmount = invoice.totalAmount - newPaidAmount;
      const newStatus = newBalanceAmount === invoice.totalAmount ? 'pending' : 'partial';

      await tx.invoice.update({
        where: { id: payment.invoiceId },
        data: {
          paidAmount: newPaidAmount,
          balanceAmount: newBalanceAmount,
          status: invoice.status === 'cancelled' ? 'cancelled' : newStatus
        }
      });
    });

    res.json({ message: 'Payment deleted and invoice updated successfully' });
  } catch (error) {
    console.error('Delete payment error:', error);
    res.status(400).json({ errors: [{ message: error.message }] });
  }
});

// ============== OUTSTANDING BALANCE ENDPOINTS ==============

// GET outstanding invoices for a patient
router.get('/patients/:patientId/outstanding', authenticateToken, async (req, res) => {
  try {
    const orgId = getUserOrgId(req);
    const { patientId } = req.params;

    const where = {
      patientId,
      status: {
        in: ['pending', 'partial', 'overdue']
      },
      balanceAmount: {
        gt: 0
      }
    };
    if (orgId) where.orgId = orgId;

    const invoices = await prisma.invoice.findMany({
      where,
      include: {
        items: true,
        payments: {
          orderBy: { paymentDate: 'desc' }
        }
      },
      orderBy: { invoiceDate: 'asc' }
    });

    const totalOutstanding = invoices.reduce((sum, inv) => sum + inv.balanceAmount, 0);

    res.json({
      data: {
        invoices,
        summary: {
          totalInvoices: invoices.length,
          totalOutstanding
        }
      }
    });
  } catch (error) {
    console.error('Get outstanding error:', error);
    res.status(500).json({ errors: [{ message: error.message }] });
  }
});

// ============== BILLING STATISTICS ==============

// GET billing statistics
router.get('/stats/summary', authenticateToken, async (req, res) => {
  try {
    const orgId = getUserOrgId(req);
    const { startDate, endDate } = req.query;

    const where = {};
    if (orgId) where.orgId = orgId;

    if (startDate || endDate) {
      where.invoiceDate = {};
      if (startDate) where.invoiceDate.gte = new Date(startDate);
      if (endDate) where.invoiceDate.lte = new Date(endDate);
    }

    const [
      totalInvoices,
      pendingInvoices,
      partialInvoices,
      paidInvoices,
      overdueInvoices,
      cancelledInvoices,
      totals,
      recentPayments
    ] = await Promise.all([
      prisma.invoice.count({ where }),
      prisma.invoice.count({ where: { ...where, status: 'pending' } }),
      prisma.invoice.count({ where: { ...where, status: 'partial' } }),
      prisma.invoice.count({ where: { ...where, status: 'paid' } }),
      prisma.invoice.count({ where: { ...where, status: 'overdue' } }),
      prisma.invoice.count({ where: { ...where, status: 'cancelled' } }),
      prisma.invoice.aggregate({
        where,
        _sum: {
          totalAmount: true,
          paidAmount: true,
          balanceAmount: true
        }
      }),
      prisma.payment.findMany({
        where: orgId ? { orgId } : {},
        take: 10,
        orderBy: { paymentDate: 'desc' },
        include: {
          invoice: {
            select: {
              invoiceNumber: true,
              patient: {
                select: {
                  name: true,
                  patientCode: true
                }
              }
            }
          }
        }
      })
    ]);

    res.json({
      data: {
        invoices: {
          total: totalInvoices,
          pending: pendingInvoices,
          partial: partialInvoices,
          paid: paidInvoices,
          overdue: overdueInvoices,
          cancelled: cancelledInvoices
        },
        amounts: {
          totalBilled: totals._sum.totalAmount || 0,
          totalPaid: totals._sum.paidAmount || 0,
          totalOutstanding: totals._sum.balanceAmount || 0
        },
        recentPayments
      }
    });
  } catch (error) {
    console.error('Get billing stats error:', error);
    res.status(500).json({ errors: [{ message: error.message }] });
  }
});

// GET revenue report
router.get('/reports/revenue', authenticateToken, async (req, res) => {
  try {
    const orgId = getUserOrgId(req);
    const { startDate, endDate, groupBy = 'day' } = req.query;

    const where = {};
    if (orgId) where.orgId = orgId;

    if (startDate || endDate) {
      where.paymentDate = {};
      if (startDate) where.paymentDate.gte = new Date(startDate);
      if (endDate) where.paymentDate.lte = new Date(endDate);
    }

    const payments = await prisma.payment.findMany({
      where,
      orderBy: { paymentDate: 'asc' }
    });

    // Group payments by date/month
    const grouped = {};
    payments.forEach(payment => {
      const date = new Date(payment.paymentDate);
      let key;

      if (groupBy === 'month') {
        key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      } else {
        key = date.toISOString().split('T')[0];
      }

      if (!grouped[key]) {
        grouped[key] = {
          date: key,
          totalAmount: 0,
          count: 0,
          methods: {}
        };
      }

      grouped[key].totalAmount += payment.amount;
      grouped[key].count += 1;
      grouped[key].methods[payment.paymentMethod] =
        (grouped[key].methods[payment.paymentMethod] || 0) + payment.amount;
    });

    const report = Object.values(grouped);

    res.json({
      data: {
        report,
        summary: {
          totalRevenue: payments.reduce((sum, p) => sum + p.amount, 0),
          totalTransactions: payments.length,
          period: { startDate, endDate, groupBy }
        }
      }
    });
  } catch (error) {
    console.error('Get revenue report error:', error);
    res.status(500).json({ errors: [{ message: error.message }] });
  }
});

module.exports = router;
