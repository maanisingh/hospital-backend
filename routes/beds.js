// Bed Management Routes
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
// BED MANAGEMENT ROUTES
// ============================================================================

// GET all beds
router.get('/', authenticateToken, requireRoleWithOrgScope(['SuperAdmin', 'HospitalAdmin', 'Doctor', 'Nurse']), async (req, res) => {
  try {
    const { orgId, status, bedType, departmentId } = req.query;

    if (!orgId) {
      return res.status(400).json({
        errors: [{ message: 'Organization ID is required' }]
      });
    }

    const where = { orgId };
    if (status) where.status = status;
    if (bedType) where.bedType = bedType;
    if (departmentId) where.departmentId = departmentId;

    const beds = await prisma.bed.findMany({
      where,
      include: {
        department: {
          select: {
            id: true,
            name: true
          }
        },
        currentPatient: {
          select: {
            id: true,
            name: true,
            patientCode: true
          }
        }
      },
      orderBy: {
        bedNumber: 'asc'
      }
    });

    res.json({
      data: beds,
      meta: { count: beds.length }
    });
  } catch (error) {
    console.error('Error fetching beds:', error);
    res.status(500).json({
      errors: [{ message: error.message }]
    });
  }
});

// GET bed by ID
router.get('/:id', authenticateToken, requireRoleWithOrgScope(['SuperAdmin', 'HospitalAdmin', 'Doctor', 'Nurse']), async (req, res) => {
  try {
    const { id } = req.params;
    const { orgId } = req.query;

    const bed = await prisma.bed.findFirst({
      where: {
        id: id,
        orgId: orgId
      },
      include: {
        department: {
          select: {
            id: true,
            name: true
          }
        },
        currentPatient: {
          select: {
            id: true,
            name: true,
            patientCode: true,
            age: true,
            gender: true,
            mobile: true
          }
        }
      }
    });

    if (!bed) {
      return res.status(404).json({
        errors: [{ message: 'Bed not found' }]
      });
    }

    res.json({ data: bed });
  } catch (error) {
    console.error('Error fetching bed:', error);
    res.status(500).json({
      errors: [{ message: error.message }]
    });
  }
});

// POST create new bed
router.post('/', authenticateToken, requirePermission('IPD_ACCESS'), async (req, res) => {
  try {
    const { orgId } = req.query;
    const { departmentId, bedNumber, bedType, floor, ward, chargesPerDay } = req.body;

    if (!orgId) {
      return res.status(400).json({
        errors: [{ message: 'Organization ID is required' }]
      });
    }

    // Check if bed number already exists in this department
    const existingBed = await prisma.bed.findFirst({
      where: {
        orgId: orgId,
        departmentId: departmentId,
        bedNumber: bedNumber
      }
    });

    if (existingBed) {
      return res.status(400).json({
        errors: [{ message: 'Bed number already exists in this department' }]
      });
    }

    const bed = await prisma.bed.create({
      data: {
        orgId,
        departmentId,
        bedNumber,
        bedType,
        floor,
        ward,
        chargesPerDay,
        status: 'available'
      },
      include: {
        department: {
          select: {
            id: true,
            name: true
          }
        }
      }
    });

    res.status(201).json({ data: bed });
  } catch (error) {
    console.error('Error creating bed:', error);
    res.status(500).json({
      errors: [{ message: error.message }]
    });
  }
});

// PATCH update bed
router.patch('/:id', authenticateToken, requirePermission('IPD_ACCESS'), async (req, res) => {
  try {
    const { id } = req.params;
    const { orgId } = req.query;
    const { bedNumber, bedType, floor, ward, chargesPerDay, status } = req.body;

    const bed = await prisma.bed.findFirst({
      where: { id: id, orgId: orgId }
    });

    if (!bed) {
      return res.status(404).json({
        errors: [{ message: 'Bed not found' }]
      });
    }

    const updateData = {};
    if (bedNumber !== undefined) updateData.bedNumber = bedNumber;
    if (bedType !== undefined) updateData.bedType = bedType;
    if (floor !== undefined) updateData.floor = floor;
    if (ward !== undefined) updateData.ward = ward;
    if (chargesPerDay !== undefined) updateData.chargesPerDay = chargesPerDay;
    if (status !== undefined) updateData.status = status;

    const updatedBed = await prisma.bed.update({
      where: { id: id },
      data: updateData,
      include: {
        department: {
          select: {
            id: true,
            name: true
          }
        },
        currentPatient: {
          select: {
            id: true,
            name: true,
            patientCode: true
          }
        }
      }
    });

    res.json({ data: updatedBed });
  } catch (error) {
    console.error('Error updating bed:', error);
    res.status(500).json({
      errors: [{ message: error.message }]
    });
  }
});

// DELETE bed
router.delete('/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { orgId } = req.query;

    const bed = await prisma.bed.findFirst({
      where: { id: id, orgId: orgId }
    });

    if (!bed) {
      return res.status(404).json({
        errors: [{ message: 'Bed not found' }]
      });
    }

    if (bed.status === 'occupied') {
      return res.status(400).json({
        errors: [{ message: 'Cannot delete occupied bed' }]
      });
    }

    await prisma.bed.delete({
      where: { id: id }
    });

    res.json({
      data: { message: 'Bed deleted successfully' }
    });
  } catch (error) {
    console.error('Error deleting bed:', error);
    res.status(500).json({
      errors: [{ message: error.message }]
    });
  }
});

// GET bed statistics
router.get('/stats/summary', authenticateToken, requireRoleWithOrgScope(['SuperAdmin', 'HospitalAdmin', 'Doctor', 'Nurse']), async (req, res) => {
  try {
    const { orgId } = req.query;

    if (!orgId) {
      return res.status(400).json({
        errors: [{ message: 'Organization ID is required' }]
      });
    }

    const [totalBeds, availableBeds, occupiedBeds, maintenanceBeds, bedsByType] = await Promise.all([
      prisma.bed.count({ where: { orgId } }),
      prisma.bed.count({ where: { orgId, status: 'available' } }),
      prisma.bed.count({ where: { orgId, status: 'occupied' } }),
      prisma.bed.count({ where: { orgId, status: 'maintenance' } }),
      prisma.bed.groupBy({
        by: ['bedType'],
        where: { orgId },
        _count: { id: true }
      })
    ]);

    const typeBreakdown = {};
    bedsByType.forEach(item => {
      typeBreakdown[item.bedType] = item._count.id;
    });

    const occupancyRate = totalBeds > 0 ? ((occupiedBeds / totalBeds) * 100).toFixed(2) : 0;

    res.json({
      data: {
        totalBeds,
        availableBeds,
        occupiedBeds,
        maintenanceBeds,
        occupancyRate: parseFloat(occupancyRate),
        bedsByType: typeBreakdown
      }
    });
  } catch (error) {
    console.error('Error fetching bed stats:', error);
    res.status(500).json({
      errors: [{ message: error.message }]
    });
  }
});

module.exports = router;
