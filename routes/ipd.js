// IPD (In-Patient Department) Module APIs
// Handles: Admissions, Discharges, Bed transfers, Daily records
// Multi-tenant with orgId filtering

const express = require('express');
const router = express.Router();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

console.log('✅ IPD Module routes loaded');

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

async function generateAdmissionNumber(orgId) {
  const count = await prisma.iPDAdmission.count({ where: { orgId } });
  const year = new Date().getFullYear();
  return `IPD${year}${String(count + 1).padStart(6, '0')}`;
}

// ============================================================================
// IPD ADMISSION MANAGEMENT
// ============================================================================

// GET /api/ipd/admissions - List all IPD admissions (with filters)
router.get('/admissions', authenticateToken, async (req, res) => {
  try {
    const orgId = await getUserOrgId(req);
    const {
      patientId,
      departmentId,
      doctorId,
      bedId,
      status,
      page = 1,
      limit = 50
    } = req.query;

    const skip = (parseInt(page) - 1) * parseInt(limit);

    let where = { orgId };

    if (patientId) where.patientId = patientId;
    if (departmentId) where.departmentId = departmentId;
    if (doctorId) where.doctorId = doctorId;
    if (bedId) where.bedId = bedId;
    if (status) where.status = status;

    const [admissions, total] = await Promise.all([
      prisma.iPDAdmission.findMany({
        where,
        include: {
          patient: {
            select: {
              id: true,
              name: true,
              mobile: true,
              age: true,
              gender: true,
              bloodGroup: true
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
          },
          bed: {
            select: {
              id: true,
              bedNumber: true,
              bedType: true,
              ward: true
            }
          }
        },
        orderBy: { admissionDate: 'desc' },
        skip,
        take: parseInt(limit)
      }),
      prisma.iPDAdmission.count({ where })
    ]);

    res.json({
      data: admissions,
      meta: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (error) {
    console.error('List IPD admissions error:', error);
    res.status(500).json({
      errors: [{ message: error.message || 'Failed to fetch IPD admissions' }]
    });
  }
});

// GET /api/ipd/admissions/:id - Get single IPD admission
router.get('/admissions/:id', authenticateToken, async (req, res) => {
  try {
    const orgId = await getUserOrgId(req);
    const { id } = req.params;

    const admission = await prisma.iPDAdmission.findFirst({
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
        },
        bed: true,
        dailyRecords: {
          orderBy: { recordDate: 'desc' },
          take: 7
        }
      }
    });

    if (!admission) {
      return res.status(404).json({
        errors: [{ message: 'IPD admission not found' }]
      });
    }

    res.json({ data: admission });
  } catch (error) {
    console.error('Get IPD admission error:', error);
    res.status(500).json({
      errors: [{ message: error.message || 'Failed to fetch IPD admission' }]
    });
  }
});

// POST /api/ipd/admissions - Create new IPD admission
router.post('/admissions', authenticateToken, async (req, res) => {
  try {
    const orgId = await getUserOrgId(req);
    const {
      patientId,
      departmentId,
      doctorId,
      bedId,
      admissionDate,
      admissionType = 'planned',
      chiefComplaint,
      provisionalDiagnosis,
      emergencyContact,
      allergies,
      currentMedications,
      specialInstructions
    } = req.body;

    // Validate required fields
    if (!patientId || !departmentId || !doctorId || !bedId) {
      return res.status(400).json({
        errors: [{ message: 'Patient, Department, Doctor, and Bed are required' }]
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

    // Verify bed is available
    const bed = await prisma.bed.findFirst({
      where: { id: bedId, orgId }
    });
    if (!bed) {
      return res.status(404).json({
        errors: [{ message: 'Bed not found' }]
      });
    }
    if (bed.status !== 'available') {
      return res.status(400).json({
        errors: [{ message: 'Bed is not available' }]
      });
    }

    // Generate admission number
    const admissionNumber = await generateAdmissionNumber(orgId);

    // Create admission and update bed status in a transaction
    const admission = await prisma.$transaction(async (tx) => {
      // Create admission
      const newAdmission = await tx.iPDAdmission.create({
        data: {
          orgId,
          patientId,
          departmentId,
          doctorId,
          bedId,
          admissionNumber,
          admissionDate: admissionDate ? new Date(admissionDate) : new Date(),
          admissionType,
          chiefComplaint,
          provisionalDiagnosis,
          emergencyContact,
          allergies,
          currentMedications,
          specialInstructions,
          status: 'admitted'
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
          },
          bed: true
        }
      });

      // Update bed status
      await tx.bed.update({
        where: { id: bedId },
        data: {
          status: 'occupied',
          currentPatientId: patientId
        }
      });

      return newAdmission;
    });

    res.status(201).json({ data: admission });
  } catch (error) {
    console.error('Create IPD admission error:', error);
    res.status(500).json({
      errors: [{ message: error.message || 'Failed to create IPD admission' }]
    });
  }
});

// PATCH /api/ipd/admissions/:id - Update IPD admission
router.patch('/admissions/:id', authenticateToken, async (req, res) => {
  try {
    const orgId = await getUserOrgId(req);
    const { id } = req.params;
    const updates = req.body;

    // Check if admission exists
    const existingAdmission = await prisma.iPDAdmission.findFirst({
      where: { id, orgId }
    });

    if (!existingAdmission) {
      return res.status(404).json({
        errors: [{ message: 'IPD admission not found' }]
      });
    }

    // Update admission
    const updatedAdmission = await prisma.iPDAdmission.update({
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
        },
        bed: true
      }
    });

    res.json({ data: updatedAdmission });
  } catch (error) {
    console.error('Update IPD admission error:', error);
    res.status(500).json({
      errors: [{ message: error.message || 'Failed to update IPD admission' }]
    });
  }
});

// POST /api/ipd/admissions/:id/discharge - Discharge patient
router.post('/admissions/:id/discharge', authenticateToken, async (req, res) => {
  try {
    const orgId = await getUserOrgId(req);
    const { id } = req.params;
    const {
      dischargeDate,
      dischargeSummary,
      finalDiagnosis,
      treatmentGiven,
      dischargeAdvice,
      followUpDate,
      dischargeType = 'normal',
      medications
    } = req.body;

    const admission = await prisma.iPDAdmission.findFirst({
      where: { id, orgId }
    });

    if (!admission) {
      return res.status(404).json({
        errors: [{ message: 'IPD admission not found' }]
      });
    }

    if (admission.status === 'discharged') {
      return res.status(400).json({
        errors: [{ message: 'Patient already discharged' }]
      });
    }

    // Discharge patient and free bed in a transaction
    const discharged = await prisma.$transaction(async (tx) => {
      // Update admission
      const updated = await tx.iPDAdmission.update({
        where: { id },
        data: {
          status: 'discharged',
          dischargeDate: dischargeDate ? new Date(dischargeDate) : new Date(),
          dischargeSummary,
          finalDiagnosis,
          treatmentGiven,
          dischargeAdvice,
          followUpDate: followUpDate ? new Date(followUpDate) : null,
          dischargeType,
          dischargeMedications: medications
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
          },
          bed: true
        }
      });

      // Free up the bed
      if (admission.bedId) {
        await tx.bed.update({
          where: { id: admission.bedId },
          data: {
            status: 'available',
            currentPatientId: null
          }
        });
      }

      return updated;
    });

    res.json({ data: discharged });
  } catch (error) {
    console.error('Discharge patient error:', error);
    res.status(500).json({
      errors: [{ message: error.message || 'Failed to discharge patient' }]
    });
  }
});

// POST /api/ipd/admissions/:id/transfer - Transfer patient to another bed
router.post('/admissions/:id/transfer', authenticateToken, async (req, res) => {
  try {
    const orgId = await getUserOrgId(req);
    const { id } = req.params;
    const { newBedId, reason, notes } = req.body;

    if (!newBedId) {
      return res.status(400).json({
        errors: [{ message: 'New bed ID is required' }]
      });
    }

    const admission = await prisma.iPDAdmission.findFirst({
      where: { id, orgId }
    });

    if (!admission) {
      return res.status(404).json({
        errors: [{ message: 'IPD admission not found' }]
      });
    }

    if (admission.status !== 'admitted') {
      return res.status(400).json({
        errors: [{ message: 'Patient is not currently admitted' }]
      });
    }

    // Verify new bed is available
    const newBed = await prisma.bed.findFirst({
      where: { id: newBedId, orgId }
    });
    if (!newBed) {
      return res.status(404).json({
        errors: [{ message: 'New bed not found' }]
      });
    }
    if (newBed.status !== 'available') {
      return res.status(400).json({
        errors: [{ message: 'New bed is not available' }]
      });
    }

    // Transfer in a transaction
    const transferred = await prisma.$transaction(async (tx) => {
      // Free old bed
      if (admission.bedId) {
        await tx.bed.update({
          where: { id: admission.bedId },
          data: {
            status: 'available',
            currentPatientId: null
          }
        });
      }

      // Occupy new bed
      await tx.bed.update({
        where: { id: newBedId },
        data: {
          status: 'occupied',
          currentPatientId: admission.patientId
        }
      });

      // Update admission
      const updated = await tx.iPDAdmission.update({
        where: { id },
        data: {
          bedId: newBedId,
          transferHistory: {
            push: {
              from: admission.bedId,
              to: newBedId,
              date: new Date().toISOString(),
              reason,
              notes
            }
          }
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
          },
          bed: true
        }
      });

      return updated;
    });

    res.json({ data: transferred });
  } catch (error) {
    console.error('Transfer patient error:', error);
    res.status(500).json({
      errors: [{ message: error.message || 'Failed to transfer patient' }]
    });
  }
});

// ============================================================================
// DAILY RECORDS
// ============================================================================

// GET /api/ipd/admissions/:admissionId/daily-records - Get daily records for admission
router.get('/admissions/:admissionId/daily-records', authenticateToken, async (req, res) => {
  try {
    const orgId = await getUserOrgId(req);
    const { admissionId } = req.params;

    // Verify admission exists
    const admission = await prisma.iPDAdmission.findFirst({
      where: { id: admissionId, orgId }
    });

    if (!admission) {
      return res.status(404).json({
        errors: [{ message: 'IPD admission not found' }]
      });
    }

    const dailyRecords = await prisma.iPDDailyRecord.findMany({
      where: { admissionId },
      orderBy: { recordDate: 'desc' }
    });

    res.json({ data: dailyRecords });
  } catch (error) {
    console.error('Get daily records error:', error);
    res.status(500).json({
      errors: [{ message: error.message || 'Failed to fetch daily records' }]
    });
  }
});

// POST /api/ipd/admissions/:admissionId/daily-records - Add daily record
router.post('/admissions/:admissionId/daily-records', authenticateToken, async (req, res) => {
  try {
    const orgId = await getUserOrgId(req);
    const { admissionId } = req.params;
    const {
      recordDate,
      vitalSigns,
      symptoms,
      treatment,
      medications,
      progressNotes,
      doctorId,
      nurseId
    } = req.body;

    // Verify admission exists
    const admission = await prisma.iPDAdmission.findFirst({
      where: { id: admissionId, orgId }
    });

    if (!admission) {
      return res.status(404).json({
        errors: [{ message: 'IPD admission not found' }]
      });
    }

    const dailyRecord = await prisma.iPDDailyRecord.create({
      data: {
        admissionId,
        recordDate: recordDate ? new Date(recordDate) : new Date(),
        vitalSigns,
        symptoms,
        treatment,
        medications,
        progressNotes,
        doctorId,
        nurseId
      }
    });

    res.status(201).json({ data: dailyRecord });
  } catch (error) {
    console.error('Create daily record error:', error);
    res.status(500).json({
      errors: [{ message: error.message || 'Failed to create daily record' }]
    });
  }
});

// ============================================================================
// STATISTICS
// ============================================================================

// GET /api/ipd/stats - Get IPD statistics
router.get('/stats', authenticateToken, async (req, res) => {
  try {
    const orgId = await getUserOrgId(req);
    const { startDate, endDate, departmentId } = req.query;

    let where = { orgId };

    if (departmentId) where.departmentId = departmentId;

    if (startDate && endDate) {
      where.admissionDate = {
        gte: new Date(startDate),
        lte: new Date(endDate)
      };
    }

    const [
      totalAdmissions,
      currentlyAdmitted,
      discharged,
      averageStayDays
    ] = await Promise.all([
      prisma.iPDAdmission.count({ where }),
      prisma.iPDAdmission.count({ where: { ...where, status: 'admitted' } }),
      prisma.iPDAdmission.count({ where: { ...where, status: 'discharged' } }),
      prisma.iPDAdmission.aggregate({
        where: { ...where, status: 'discharged' },
        _avg: {
          lengthOfStay: true
        }
      })
    ]);

    const stats = {
      totalAdmissions,
      currentlyAdmitted,
      discharged,
      averageStayDays: averageStayDays._avg.lengthOfStay || 0
    };

    res.json({ data: stats });
  } catch (error) {
    console.error('Get IPD stats error:', error);
    res.status(500).json({
      errors: [{ message: error.message || 'Failed to fetch IPD stats' }]
    });
  }
});

module.exports = router;
