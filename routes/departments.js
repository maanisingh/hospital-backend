// Department & Bed Management APIs
// Multi-tenant with orgId filtering
// Handles: departments, beds, bed assignments, bed transfers

const express = require('express');
const router = express.Router();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

console.log('✅ Department & Bed Management routes module loaded');

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
  }

  const user = await prisma.user.findUnique({
    where: { id: req.user.id },
    select: { orgId: true }
  });

  if (!user || !user.orgId) {
    throw new Error('User has no organization assigned');
  }

  return user.orgId;
}

// ============================================================================
// DEPARTMENT ENDPOINTS
// ============================================================================

/**
 * GET /api/departments
 * List all departments
 */
router.get('/', authenticateToken, async (req, res) => {
  try {
    const orgId = await getUserOrgId(req);
    const { search, status, page = 1, limit = 50 } = req.query;

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const where = {
      orgId,
      ...(search && {
        OR: [
          { name: { contains: search, mode: 'insensitive' } },
          { code: { contains: search, mode: 'insensitive' } }
        ]
      }),
      ...(status && { status })
    };

    const [departments, total] = await Promise.all([
      prisma.department.findMany({
        where,
        include: {
          _count: {
            select: {
              beds: true,
              opdTokens: true,
              ipdAdmissions: true
            }
          }
        },
        orderBy: { name: 'asc' },
        skip,
        take: parseInt(limit)
      }),
      prisma.department.count({ where })
    ]);

    res.json({
      data: departments,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (error) {
    console.error('List departments error:', error);
    res.status(500).json({ errors: [{ message: error.message || 'Failed to list departments' }] });
  }
});

/**
 * GET /api/departments/:id
 * Get single department
 */
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const orgId = await getUserOrgId(req);

    const department = await prisma.department.findFirst({
      where: {
        id: req.params.id,
        orgId
      },
      include: {
        headDoctor: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            phone: true
          }
        },
        beds: {
          include: {
            currentAssignment: {
              include: {
                patient: {
                  select: {
                    patientCode: true,
                    name: true,
                    mobile: true
                  }
                }
              }
            }
          }
        },
        _count: {
          select: {
            beds: true,
            staff: true
          }
        }
      }
    });

    if (!department) {
      return res.status(404).json({
        errors: [{ message: 'Department not found' }]
      });
    }

    res.json({ data: department });
  } catch (error) {
    console.error('Get department error:', error);
    res.status(500).json({ errors: [{ message: error.message || 'Failed to get department' }] });
  }
});

/**
 * POST /api/departments
 * Create new department
 * RBAC: Admins only
 */
router.post('/', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const orgId = await getUserOrgId(req);

    const {
      code,
      name,
      type,
      description,
      headDoctorId,
      floor,
      location,
      phone,
      extension
    } = req.body;

    // Validate required fields
    if (!code || !name || !type) {
      return res.status(400).json({
        errors: [{ message: 'Code, name, and type are required' }]
      });
    }

    // Check if code already exists
    const existing = await prisma.department.findFirst({
      where: { orgId, code }
    });

    if (existing) {
      return res.status(400).json({
        errors: [{ message: `Department with code ${code} already exists` }]
      });
    }

    const department = await prisma.department.create({
      data: {
        orgId,
        code,
        name,
        type,
        description,
        headDoctorId,
        floor,
        location,
        phone,
        extension,
        status: 'active'
      },
      include: {
        organization: {
          select: {
            name: true,
            code: true
          }
        }
      }
    });

    res.status(201).json({
      data: department,
      message: `Department ${code} created successfully`
    });
  } catch (error) {
    console.error('Create department error:', error);
    res.status(500).json({ errors: [{ message: error.message || 'Failed to create department' }] });
  }
});

/**
 * PATCH /api/departments/:id
 * Update department
 */
router.patch('/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const orgId = await getUserOrgId(req);

    const {
      name,
      description,
      headDoctorId,
      floor,
      location,
      phone,
      extension,
      status
    } = req.body;

    const department = await prisma.department.updateMany({
      where: {
        id: req.params.id,
        orgId
      },
      data: {
        ...(name && { name }),
        ...(description !== undefined && { description }),
        ...(headDoctorId !== undefined && { headDoctorId }),
        ...(floor !== undefined && { floor }),
        ...(location !== undefined && { location }),
        ...(phone !== undefined && { phone }),
        ...(extension !== undefined && { extension }),
        ...(status && { status })
      }
    });

    if (department.count === 0) {
      return res.status(404).json({
        errors: [{ message: 'Department not found' }]
      });
    }

    const updated = await prisma.department.findFirst({
      where: { id: req.params.id, orgId },
      include: {
        headDoctor: {
          select: {
            firstName: true,
            lastName: true
          }
        }
      }
    });

    res.json({
      data: updated,
      message: 'Department updated successfully'
    });
  } catch (error) {
    console.error('Update department error:', error);
    res.status(500).json({ errors: [{ message: error.message || 'Failed to update department' }] });
  }
});

/**
 * DELETE /api/departments/:id
 * Soft delete department (set status to inactive)
 */
router.delete('/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const orgId = await getUserOrgId(req);

    const department = await prisma.department.updateMany({
      where: {
        id: req.params.id,
        orgId
      },
      data: {
        status: 'inactive'
      }
    });

    if (department.count === 0) {
      return res.status(404).json({
        errors: [{ message: 'Department not found' }]
      });
    }

    res.json({ message: 'Department deactivated successfully' });
  } catch (error) {
    console.error('Delete department error:', error);
    res.status(500).json({ errors: [{ message: error.message || 'Failed to delete department' }] });
  }
});

// ============================================================================
// BED ENDPOINTS
// ============================================================================

/**
 * GET /api/departments/:deptId/beds
 * List all beds in a department
 */
router.get('/:deptId/beds', authenticateToken, async (req, res) => {
  try {
    const orgId = await getUserOrgId(req);
    const { status, type } = req.query;

    const where = {
      departmentId: req.params.deptId,
      department: { orgId },
      ...(status && { status }),
      ...(type && { bedType: type })
    };

    const beds = await prisma.bed.findMany({
      where,
      include: {
        department: {
          select: {
            code: true,
            name: true
          }
        },
        currentAssignment: {
          include: {
            patient: {
              select: {
                patientCode: true,
                name: true,
                mobile: true
              }
            }
          }
        }
      },
      orderBy: { bedNumber: 'asc' }
    });

    res.json({ data: beds });
  } catch (error) {
    console.error('List beds error:', error);
    res.status(500).json({ errors: [{ message: error.message || 'Failed to list beds' }] });
  }
});

/**
 * POST /api/departments/:deptId/beds
 * Create new bed in department
 * RBAC: Admins only
 */
router.post('/:deptId/beds', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const orgId = await getUserOrgId(req);

    const {
      bedNumber,
      bedType,
      floor,
      ward,
      features,
      chargesPerDay
    } = req.body;

    // Validate required fields
    if (!bedNumber || !bedType) {
      return res.status(400).json({
        errors: [{ message: 'Bed number and type are required' }]
      });
    }

    // Verify department exists and belongs to organization
    const department = await prisma.department.findFirst({
      where: {
        id: req.params.deptId,
        orgId
      }
    });

    if (!department) {
      return res.status(404).json({
        errors: [{ message: 'Department not found' }]
      });
    }

    // Check if bed number already exists in department
    const existing = await prisma.bed.findFirst({
      where: {
        departmentId: req.params.deptId,
        bedNumber
      }
    });

    if (existing) {
      return res.status(400).json({
        errors: [{ message: `Bed ${bedNumber} already exists in this department` }]
      });
    }

    const bed = await prisma.bed.create({
      data: {
        orgId,
        departmentId: req.params.deptId,
        bedNumber,
        bedType,
        floor,
        ward,
        chargesPerDay: chargesPerDay ? parseFloat(chargesPerDay) : null,
        status: 'available'
      },
      include: {
        department: {
          select: {
            code: true,
            name: true
          }
        }
      }
    });

    res.status(201).json({
      data: bed,
      message: `Bed ${bedNumber} created successfully`
    });
  } catch (error) {
    console.error('Create bed error:', error);
    res.status(500).json({ errors: [{ message: error.message || 'Failed to create bed' }] });
  }
});

/**
 * PATCH /api/beds/:id
 * Update bed details
 */
router.patch('/beds/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const orgId = await getUserOrgId(req);

    const {
      bedType,
      floor,
      room,
      features,
      chargesPerDay,
      status
    } = req.body;

    // Verify bed exists and belongs to organization
    const bed = await prisma.bed.findFirst({
      where: {
        id: req.params.id,
        department: { orgId }
      }
    });

    if (!bed) {
      return res.status(404).json({
        errors: [{ message: 'Bed not found' }]
      });
    }

    const updated = await prisma.bed.update({
      where: { id: req.params.id },
      data: {
        ...(bedType && { bedType }),
        ...(floor !== undefined && { floor }),
        ...(room !== undefined && { room }),
        ...(features !== undefined && { features }),
        ...(chargesPerDay !== undefined && { chargesPerDay: parseFloat(chargesPerDay) }),
        ...(status && { status })
      },
      include: {
        department: {
          select: {
            code: true,
            name: true
          }
        }
      }
    });

    res.json({
      data: updated,
      message: 'Bed updated successfully'
    });
  } catch (error) {
    console.error('Update bed error:', error);
    res.status(500).json({ errors: [{ message: error.message || 'Failed to update bed' }] });
  }
});

/**
 * GET /api/beds/available
 * Get all available beds across all departments
 */
router.get('/beds/available', authenticateToken, async (req, res) => {
  try {
    const orgId = await getUserOrgId(req);
    const { type, departmentId } = req.query;

    const where = {
      department: { orgId },
      status: 'available',
      ...(type && { bedType: type }),
      ...(departmentId && { departmentId })
    };

    const beds = await prisma.bed.findMany({
      where,
      include: {
        department: {
          select: {
            id: true,
            code: true,
            name: true
          }
        }
      },
      orderBy: [
        { department: { name: 'asc' } },
        { bedNumber: 'asc' }
      ]
    });

    res.json({ data: beds });
  } catch (error) {
    console.error('List available beds error:', error);
    res.status(500).json({ errors: [{ message: error.message || 'Failed to list available beds' }] });
  }
});

/**
 * POST /api/beds/:bedId/assign
 * Assign bed to patient (for IPD admission)
 */
router.post('/beds/:bedId/assign', authenticateToken, requirePermission('IPD_ACCESS'), async (req, res) => {
  try {
    const orgId = await getUserOrgId(req);

    const {
      patientId
      // Note: ipdAdmissionId, assignedBy not used - no BedAssignment model exists
    } = req.body;

    if (!patientId) {
      return res.status(400).json({
        errors: [{ message: 'Patient ID is required' }]
      });
    }

    // Verify bed exists and is available
    const bed = await prisma.bed.findFirst({
      where: {
        id: req.params.bedId,
        department: { orgId }
      }
    });

    if (!bed) {
      return res.status(404).json({
        errors: [{ message: 'Bed not found' }]
      });
    }

    if (bed.status !== 'available') {
      return res.status(400).json({
        errors: [{ message: `Bed is currently ${bed.status}` }]
      });
    }

    // Update bed with patient assignment
    const updatedBed = await prisma.bed.update({
      where: { id: req.params.bedId },
      data: {
        status: 'occupied',
        currentPatientId: patientId
      },
      include: {
        department: {
          select: {
            code: true,
            name: true
          }
        }
        // Note: patient relation doesn't exist in schema
      }
    });

    res.status(201).json({
      data: updatedBed,
      message: 'Bed assigned successfully'
    });
  } catch (error) {
    console.error('Assign bed error:', error);
    res.status(500).json({ errors: [{ message: error.message || 'Failed to assign bed' }] });
  }
});

/**
 * POST /api/beds/assignments/:assignmentId/release
 * Release bed (patient discharged or transferred)
 */
router.post('/beds/assignments/:assignmentId/release', authenticateToken, requirePermission('IPD_ACCESS'), async (req, res) => {
  try {
    const orgId = await getUserOrgId(req);

    const { releasedBy, remarks } = req.body;

    // Get assignment
    const assignment = await prisma.bedAssignment.findFirst({
      where: {
        id: req.params.assignmentId,
        bed: {
          department: { orgId }
        }
      },
      include: {
        bed: true
      }
    });

    if (!assignment) {
      return res.status(404).json({
        errors: [{ message: 'Bed assignment not found' }]
      });
    }

    if (assignment.status !== 'active') {
      return res.status(400).json({
        errors: [{ message: 'Bed assignment is not active' }]
      });
    }

    // Update assignment and bed status
    const [updated] = await prisma.$transaction([
      prisma.bedAssignment.update({
        where: { id: req.params.assignmentId },
        data: {
          releasedAt: new Date(),
          releasedBy,
          remarks,
          status: 'released'
        }
      }),
      prisma.bed.update({
        where: { id: assignment.bedId },
        data: { status: 'available' }
      })
    ]);

    res.json({
      data: updated,
      message: 'Bed released successfully'
    });
  } catch (error) {
    console.error('Release bed error:', error);
    res.status(500).json({ errors: [{ message: error.message || 'Failed to release bed' }] });
  }
});

/**
 * POST /api/beds/:bedId/transfer
 * Transfer patient to another bed
 */
router.post('/beds/:bedId/transfer', authenticateToken, requirePermission('IPD_ACCESS'), async (req, res) => {
  try {
    const orgId = await getUserOrgId(req);

    const {
      fromBedId,
      patientId,
      transferredBy,
      reason
    } = req.body;

    if (!fromBedId || !patientId) {
      return res.status(400).json({
        errors: [{ message: 'From bed ID and patient ID are required' }]
      });
    }

    // Verify both beds exist and belong to organization
    const [fromBed, toBed] = await Promise.all([
      prisma.bed.findFirst({
        where: {
          id: fromBedId,
          department: { orgId }
        }
      }),
      prisma.bed.findFirst({
        where: {
          id: req.params.bedId,
          department: { orgId }
        }
      })
    ]);

    if (!fromBed || !toBed) {
      return res.status(404).json({
        errors: [{ message: 'One or both beds not found' }]
      });
    }

    if (toBed.status !== 'available') {
      return res.status(400).json({
        errors: [{ message: 'Target bed is not available' }]
      });
    }

    // Get current assignment
    const currentAssignment = await prisma.bedAssignment.findFirst({
      where: {
        bedId: fromBedId,
        patientId,
        status: 'active'
      }
    });

    if (!currentAssignment) {
      return res.status(404).json({
        errors: [{ message: 'No active bed assignment found for this patient' }]
      });
    }

    // Release old bed, assign new bed, create transfer record
    const [, , newAssignment, transfer] = await prisma.$transaction([
      // Release old assignment
      prisma.bedAssignment.update({
        where: { id: currentAssignment.id },
        data: {
          releasedAt: new Date(),
          releasedBy: transferredBy,
          status: 'transferred'
        }
      }),
      // Update old bed status
      prisma.bed.update({
        where: { id: fromBedId },
        data: { status: 'available' }
      }),
      // Create new assignment
      prisma.bedAssignment.create({
        data: {
          bedId: req.params.bedId,
          patientId,
          ipdAdmissionId: currentAssignment.ipdAdmissionId,
          assignedBy: transferredBy,
          assignedAt: new Date(),
          status: 'active'
        }
      }),
      // Update new bed status
      prisma.bed.update({
        where: { id: req.params.bedId },
        data: { status: 'occupied' }
      })
    ]);

    res.json({
      data: {
        newAssignment,
        transfer: {
          fromBedId,
          toBedId: req.params.bedId,
          patientId,
          transferredBy,
          reason,
          transferredAt: new Date()
        }
      },
      message: 'Patient transferred successfully'
    });
  } catch (error) {
    console.error('Transfer bed error:', error);
    res.status(500).json({ errors: [{ message: error.message || 'Failed to transfer bed' }] });
  }
});

/**
 * GET /api/beds/assignments/history
 * Get bed assignment history
 */
router.get('/beds/assignments/history', authenticateToken, async (req, res) => {
  try {
    const orgId = await getUserOrgId(req);
    const { patientId, bedId, status, page = 1, limit = 50 } = req.query;

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const where = {
      bed: {
        department: { orgId }
      },
      ...(patientId && { patientId }),
      ...(bedId && { bedId }),
      ...(status && { status })
    };

    const [assignments, total] = await Promise.all([
      prisma.bedAssignment.findMany({
        where,
        include: {
          bed: {
            include: {
              department: {
                select: {
                  code: true,
                  name: true
                }
              }
            }
          },
          patient: {
            select: {
              patientCode: true,
              name: true,
              mobile: true
            }
          }
        },
        orderBy: { assignedAt: 'desc' },
        skip,
        take: parseInt(limit)
      }),
      prisma.bedAssignment.count({ where })
    ]);

    res.json({
      data: assignments,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (error) {
    console.error('Get assignment history error:', error);
    res.status(500).json({ errors: [{ message: error.message || 'Failed to get assignment history' }] });
  }
});

module.exports = router;
