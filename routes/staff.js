// Staff Management Routes
const express = require('express');
const router = express.Router();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// Import RBAC middleware
const { requirePermission, requireAdmin, requireRoleWithOrgScope } = require('../middleware/rbac');

// Auth middleware
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({
      errors: [{ message: 'Access token required' }]
    });
  }

  const jwt = require('jsonwebtoken');
  const JWT_SECRET = process.env.JWT_SECRET || 'hospital-saas-jwt-secret-2024';

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

// ============================================================================
// STAFF ROUTES
// ============================================================================

// GET all staff members in an organization
router.get('/', authenticateToken, requireRoleWithOrgScope(['SuperAdmin', 'HospitalAdmin']), async (req, res) => {
  try {
    const { orgId } = req.query;

    if (!orgId) {
      return res.status(400).json({
        errors: [{ message: 'Organization ID is required' }]
      });
    }

    const staff = await prisma.user.findMany({
      where: {
        orgId: orgId,
        role: {
          in: ['Doctor', 'Nurse', 'Receptionist', 'Pharmacist', 'LabTechnician', 'Radiologist', 'Billing']
        }
      },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        phone: true,
        status: true,
        createdAt: true
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    res.json({
      data: staff,
      meta: { count: staff.length }
    });
  } catch (error) {
    console.error('Error fetching staff:', error);
    res.status(500).json({
      errors: [{ message: error.message }]
    });
  }
});

// GET staff member by ID
router.get('/:id', authenticateToken, requireRoleWithOrgScope(['SuperAdmin', 'HospitalAdmin']), async (req, res) => {
  try {
    const { id } = req.params;
    const { orgId } = req.query;

    const staff = await prisma.user.findFirst({
      where: {
        id: id,
        orgId: orgId
      },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        phone: true,
        status: true,
        createdAt: true,
        updatedAt: true
      }
    });

    if (!staff) {
      return res.status(404).json({
        errors: [{ message: 'Staff member not found' }]
      });
    }

    res.json({ data: staff });
  } catch (error) {
    console.error('Error fetching staff member:', error);
    res.status(500).json({
      errors: [{ message: error.message }]
    });
  }
});

// GET staff statistics
router.get('/stats/summary', authenticateToken, requireRoleWithOrgScope(['SuperAdmin', 'HospitalAdmin']), async (req, res) => {
  try {
    const { orgId } = req.query;

    if (!orgId) {
      return res.status(400).json({
        errors: [{ message: 'Organization ID is required' }]
      });
    }

    const [totalStaff, activeStaff, staffByRole] = await Promise.all([
      prisma.user.count({
        where: {
          orgId: orgId,
          role: {
            in: ['Doctor', 'Nurse', 'Receptionist', 'Pharmacist', 'LabTechnician', 'Radiologist', 'Billing']
          }
        }
      }),
      prisma.user.count({
        where: {
          orgId: orgId,
          status: 'active',
          role: {
            in: ['Doctor', 'Nurse', 'Receptionist', 'Pharmacist', 'LabTechnician', 'Radiologist', 'Billing']
          }
        }
      }),
      prisma.user.groupBy({
        by: ['role'],
        where: {
          orgId: orgId,
          role: {
            in: ['Doctor', 'Nurse', 'Receptionist', 'Pharmacist', 'LabTechnician', 'Radiologist', 'Billing']
          }
        },
        _count: {
          id: true
        }
      })
    ]);

    const roleBreakdown = {};
    staffByRole.forEach(item => {
      roleBreakdown[item.role] = item._count.id;
    });

    res.json({
      data: {
        totalStaff,
        activeStaff,
        inactiveStaff: totalStaff - activeStaff,
        roleBreakdown
      }
    });
  } catch (error) {
    console.error('Error fetching staff stats:', error);
    res.status(500).json({
      errors: [{ message: error.message }]
    });
  }
});

module.exports = router;
