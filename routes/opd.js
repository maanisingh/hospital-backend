// OPD (Out-Patient Department) Module APIs
// Handles: Token generation, Queue management, Consultations, Vital signs
// Multi-tenant with orgId filtering

const express = require('express');
const router = express.Router();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

console.log('✅ OPD Module routes loaded');

// ============================================================================
// AUTHENTICATION MIDDLEWARE
// ============================================================================

const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({
      errors: [{ message: 'Access token required' }]
    });
  }

  const jwt = require('jsonwebtoken');
const {
  requirePermission,
  requireAdmin,
  requireSuperAdmin,
  enforceOrgScope
} = require('../middleware/rbac');
  const JWT_SECRET = process.env.JWT_SECRET || 'hospital-saas-jwt-secret-2024';

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (error) {
    return res.status(403).json({
      errors: [{ message: 'Invalid or expired token' }]
    });
  }
};

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

async function getUserOrgId(req) {
  if (req.user.role === 'SuperAdmin') {
    const orgId = req.query.orgId;
    if (!orgId) {
      throw new Error('SuperAdmin must provide orgId parameter');
    }
    return orgId;
  } else {
    const user = await prisma.user.findUnique({
      where: { id: req.user.id }
    });
    if (!user || !user.orgId) {
      throw new Error('User not associated with any organization');
    }
    return user.orgId;
  }
}

async function generateTokenNumber(orgId, departmentId, date) {
  // Get the count of tokens for this dept today
  const startOfDay = new Date(date);
  startOfDay.setHours(0, 0, 0, 0);
  const endOfDay = new Date(date);
  endOfDay.setHours(23, 59, 59, 999);

  const count = await prisma.oPDToken.count({
    where: {
      orgId,
      departmentId,
      tokenDate: {
        gte: startOfDay,
        lte: endOfDay
      }
    }
  });

  return count + 1;
}

// ============================================================================
// OPD TOKEN GENERATION & MANAGEMENT
// ============================================================================

// GET /api/opd/tokens - List all OPD tokens (with filters)
router.get('/tokens', authenticateToken, async (req, res) => {
  try {
    const orgId = await getUserOrgId(req);
    const {
      departmentId,
      doctorId,
      patientId,
      status,
      date,
      page = 1,
      limit = 50
    } = req.query;

    const skip = (parseInt(page) - 1) * parseInt(limit);

    let where = { orgId };

    if (departmentId) where.departmentId = departmentId;
    if (doctorId) where.doctorId = doctorId;
    if (patientId) where.patientId = patientId;
    if (status) where.status = status;

    if (date) {
      const startOfDay = new Date(date);
      startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date(date);
      endOfDay.setHours(23, 59, 59, 999);

      where.tokenDate = {
        gte: startOfDay,
        lte: endOfDay
      };
    }

    const [tokens, total] = await Promise.all([
      prisma.oPDToken.findMany({
        where,
        include: {
          patient: {
            select: {
              id: true,
              name: true,
              mobile: true,
              age: true,
              gender: true
            }
          },
          department: {
            select: {
              id: true,
              name: true,
              code: true
            }
          },
          doctor: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true
            }
          }
        },
        orderBy: { tokenNumber: 'asc' },
        skip,
        take: parseInt(limit)
      }),
      prisma.oPDToken.count({ where })
    ]);

    res.json({
      data: tokens,
      meta: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (error) {
    console.error('List OPD tokens error:', error);
    res.status(500).json({
      errors: [{ message: error.message || 'Failed to fetch OPD tokens' }]
    });
  }
});

// GET /api/opd/tokens/:id - Get single OPD token
router.get('/tokens/:id', authenticateToken, async (req, res) => {
  try {
    const orgId = await getUserOrgId(req);
    const { id } = req.params;

    const token = await prisma.oPDToken.findFirst({
      where: { id, orgId },
      include: {
        patient: true,
        department: true,
        doctor: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            phone: true
          }
        }
      }
    });

    if (!token) {
      return res.status(404).json({
        errors: [{ message: 'OPD token not found' }]
      });
    }

    res.json({ data: token });
  } catch (error) {
    console.error('Get OPD token error:', error);
    res.status(500).json({
      errors: [{ message: error.message || 'Failed to fetch OPD token' }]
    });
  }
});

// POST /api/opd/tokens - Generate new OPD token
router.post('/tokens', authenticateToken, async (req, res) => {
  try {
    const orgId = await getUserOrgId(req);
    const {
      patientId,
      departmentId,
      doctorId,
      priority = 'normal',
      tokenDate
      // Note: visitType, chiefComplaint, appointmentId removed - not in schema
    } = req.body;

    // Validate required fields
    if (!patientId || !departmentId) {
      return res.status(400).json({
        errors: [{ message: 'Patient and Department are required' }]
      });
    }

    // Verify patient exists
    const patient = await prisma.patient.findFirst({
      where: { id: patientId, orgId }
    });
    if (!patient) {
      return res.status(404).json({
        errors: [{ message: 'Patient not found' }]
      });
    }

    // Verify department exists
    const department = await prisma.department.findFirst({
      where: { id: departmentId, orgId }
    });
    if (!department) {
      return res.status(404).json({
        errors: [{ message: 'Department not found' }]
      });
    }

    // Note: Doctor verification skipped to allow flexible doctor assignment
    // In production, you may want to add validation based on your requirements

    // Generate token number
    const date = tokenDate ? new Date(tokenDate) : new Date();
    const tokenNumber = await generateTokenNumber(orgId, departmentId, date);

    // Create OPD token
    const includeOptions = {
      patient: true,
      department: true
    };

    // Only include doctor if doctorId is provided and valid
    if (doctorId) {
      includeOptions.doctor = {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true
        }
      };
    }

    const opdToken = await prisma.oPDToken.create({
      data: {
        orgId,
        patientId,
        departmentId,
        doctorId,
        tokenNumber,
        tokenDate: date,
        priority,
        status: 'waiting'
        // Note: visitType, chiefComplaint, appointmentId removed - not in schema
        // Use symptoms field instead of chiefComplaint if needed
      },
      include: includeOptions
    });

    res.status(201).json({ data: opdToken });
  } catch (error) {
    console.error('Create OPD token error:', error);
    res.status(500).json({
      errors: [{ message: error.message || 'Failed to create OPD token' }]
    });
  }
});

// PATCH /api/opd/tokens/:id - Update OPD token
router.patch('/tokens/:id', authenticateToken, async (req, res) => {
  try {
    const orgId = await getUserOrgId(req);
    const { id } = req.params;
    const updates = req.body;

    // Check if token exists
    const existingToken = await prisma.oPDToken.findFirst({
      where: { id, orgId }
    });

    if (!existingToken) {
      return res.status(404).json({
        errors: [{ message: 'OPD token not found' }]
      });
    }

    // Update token
    const updatedToken = await prisma.oPDToken.update({
      where: { id },
      data: updates,
      include: {
        patient: true,
        department: true,
        doctor: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true
          }
        }
      }
    });

    res.json({ data: updatedToken });
  } catch (error) {
    console.error('Update OPD token error:', error);
    res.status(500).json({
      errors: [{ message: error.message || 'Failed to update OPD token' }]
    });
  }
});

// POST /api/opd/tokens/:id/call - Call next patient
router.post('/tokens/:id/call', authenticateToken, async (req, res) => {
  try {
    const orgId = await getUserOrgId(req);
    const { id } = req.params;

    const token = await prisma.oPDToken.findFirst({
      where: { id, orgId }
    });

    if (!token) {
      return res.status(404).json({
        errors: [{ message: 'OPD token not found' }]
      });
    }

    const updatedToken = await prisma.oPDToken.update({
      where: { id },
      data: {
        status: 'in_progress', // Schema uses in_progress not in_consultation
        calledAt: new Date()   // Schema uses calledAt not consultationStartTime
      },
      include: {
        patient: true,
        department: true,
        doctor: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true
          }
        }
      }
    });

    res.json({ data: updatedToken });
  } catch (error) {
    console.error('Call patient error:', error);
    res.status(500).json({
      errors: [{ message: error.message || 'Failed to call patient' }]
    });
  }
});

// POST /api/opd/tokens/:id/complete - Complete consultation
router.post('/tokens/:id/complete', authenticateToken, async (req, res) => {
  try {
    const orgId = await getUserOrgId(req);
    const { id } = req.params;
    const {
      diagnosis,
      prescription,
      followUpDate,
      notes,
      vitalSigns
    } = req.body;

    const token = await prisma.oPDToken.findFirst({
      where: { id, orgId }
    });

    if (!token) {
      return res.status(404).json({
        errors: [{ message: 'OPD token not found' }]
      });
    }

    const updatedToken = await prisma.oPDToken.update({
      where: { id },
      data: {
        status: 'completed',
        completedAt: new Date(), // Schema uses completedAt not consultationEndTime
        diagnosis,
        prescription,
        notes
        // Note: followUpDate and vitalSigns don't exist in schema
        // Note: doctorNotes field doesn't exist, use notes instead
      },
      include: {
        patient: true,
        department: true,
        doctor: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true
          }
        }
      }
    });

    res.json({ data: updatedToken });
  } catch (error) {
    console.error('Complete consultation error:', error);
    res.status(500).json({
      errors: [{ message: error.message || 'Failed to complete consultation' }]
    });
  }
});

// DELETE /api/opd/tokens/:id - Cancel OPD token
router.delete('/tokens/:id', authenticateToken, async (req, res) => {
  try {
    const orgId = await getUserOrgId(req);
    const { id } = req.params;

    const token = await prisma.oPDToken.findFirst({
      where: { id, orgId }
    });

    if (!token) {
      return res.status(404).json({
        errors: [{ message: 'OPD token not found' }]
      });
    }

    await prisma.oPDToken.update({
      where: { id },
      data: { status: 'cancelled' }
    });

    res.json({
      data: { message: 'OPD token cancelled successfully' }
    });
  } catch (error) {
    console.error('Cancel OPD token error:', error);
    res.status(500).json({
      errors: [{ message: error.message || 'Failed to cancel OPD token' }]
    });
  }
});

// ============================================================================
// QUEUE MANAGEMENT
// ============================================================================

// GET /api/opd/queue - Get current queue for a department/doctor
router.get('/queue', authenticateToken, async (req, res) => {
  try {
    const orgId = await getUserOrgId(req);
    const { departmentId, doctorId, date } = req.query;

    if (!departmentId && !doctorId) {
      return res.status(400).json({
        errors: [{ message: 'Either departmentId or doctorId is required' }]
      });
    }

    let where = { orgId, status: { in: ['waiting', 'in_consultation'] } };

    if (departmentId) where.departmentId = departmentId;
    if (doctorId) where.doctorId = doctorId;

    if (date) {
      const startOfDay = new Date(date);
      startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date(date);
      endOfDay.setHours(23, 59, 59, 999);

      where.tokenDate = {
        gte: startOfDay,
        lte: endOfDay
      };
    } else {
      // Default to today
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const endToday = new Date();
      endToday.setHours(23, 59, 59, 999);

      where.tokenDate = {
        gte: today,
        lte: endToday
      };
    }

    const queue = await prisma.oPDToken.findMany({
      where,
      include: {
        patient: {
          select: {
            id: true,
            name: true,
            age: true,
            gender: true,
            mobile: true
          }
        },
        department: true,
        doctor: {
          select: {
            id: true,
            firstName: true,
            lastName: true
          }
        }
      },
      orderBy: [
        { priority: 'desc' },
        { tokenNumber: 'asc' }
      ]
    });

    const stats = {
      total: queue.length,
      waiting: queue.filter(t => t.status === 'waiting').length,
      inConsultation: queue.filter(t => t.status === 'in_consultation').length
    };

    res.json({
      data: queue,
      meta: stats
    });
  } catch (error) {
    console.error('Get queue error:', error);
    res.status(500).json({
      errors: [{ message: error.message || 'Failed to fetch queue' }]
    });
  }
});

// GET /api/opd/queue/next - Get next patient in queue
router.get('/queue/next', authenticateToken, async (req, res) => {
  try {
    const orgId = await getUserOrgId(req);
    const { departmentId, doctorId } = req.query;

    if (!departmentId && !doctorId) {
      return res.status(400).json({
        errors: [{ message: 'Either departmentId or doctorId is required' }]
      });
    }

    let where = {
      orgId,
      status: 'waiting'
    };

    if (departmentId) where.departmentId = departmentId;
    if (doctorId) where.doctorId = doctorId;

    // Today's tokens only
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const endToday = new Date();
    endToday.setHours(23, 59, 59, 999);

    where.tokenDate = {
      gte: today,
      lte: endToday
    };

    const nextPatient = await prisma.oPDToken.findFirst({
      where,
      include: {
        patient: true,
        department: true,
        doctor: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true
          }
        }
      },
      orderBy: [
        { priority: 'desc' },
        { tokenNumber: 'asc' }
      ]
    });

    if (!nextPatient) {
      return res.json({
        data: null,
        message: 'No patients waiting in queue'
      });
    }

    res.json({ data: nextPatient });
  } catch (error) {
    console.error('Get next patient error:', error);
    res.status(500).json({
      errors: [{ message: error.message || 'Failed to fetch next patient' }]
    });
  }
});

// ============================================================================
// STATISTICS & REPORTS
// ============================================================================

// GET /api/opd/stats - Get OPD statistics
router.get('/stats', authenticateToken, async (req, res) => {
  try {
    const orgId = await getUserOrgId(req);
    const { startDate, endDate, departmentId, doctorId } = req.query;

    let where = { orgId };

    if (departmentId) where.departmentId = departmentId;
    if (doctorId) where.doctorId = doctorId;

    if (startDate && endDate) {
      where.tokenDate = {
        gte: new Date(startDate),
        lte: new Date(endDate)
      };
    }

    const [
      totalTokens,
      completedTokens,
      cancelledTokens,
      waitingTokens,
      inConsultationTokens
    ] = await Promise.all([
      prisma.oPDToken.count({ where }),
      prisma.oPDToken.count({ where: { ...where, status: 'completed' } }),
      prisma.oPDToken.count({ where: { ...where, status: 'cancelled' } }),
      prisma.oPDToken.count({ where: { ...where, status: 'waiting' } }),
      prisma.oPDToken.count({ where: { ...where, status: 'in_consultation' } })
    ]);

    const stats = {
      totalTokens,
      completed: completedTokens,
      cancelled: cancelledTokens,
      waiting: waitingTokens,
      inConsultation: inConsultationTokens,
      completionRate: totalTokens > 0
        ? ((completedTokens / totalTokens) * 100).toFixed(2)
        : 0
    };

    res.json({ data: stats });
  } catch (error) {
    console.error('Get OPD stats error:', error);
    res.status(500).json({
      errors: [{ message: error.message || 'Failed to fetch OPD stats' }]
    });
  }
});

module.exports = router;
