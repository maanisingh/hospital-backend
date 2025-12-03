// Patient CRUD Endpoints
// Routes for managing patients with auto-generated codes (PAT001, PAT002, etc.)
// Multi-tenant with orgId filtering

const express = require('express');
const router = express.Router();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

console.log('✅ Patient routes module loaded');

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Generate next patient code for an organization (PAT001, PAT002, PAT003, ...)
 * Queries database for highest patient number within the organization
 * Handles race conditions by retrying with incremented numbers
 */
async function generatePatientCode(orgId, retryCount = 0) {
  try {
    // Get the latest patient code for this organization
    const lastPatient = await prisma.patient.findMany({
      where: {
        orgId: orgId,
        patientCode: {
          startsWith: 'PAT'
        }
      },
      orderBy: {
        patientCode: 'desc'
      },
      take: 1,
      select: {
        patientCode: true
      }
    });

    let nextNumber = 1;
    if (lastPatient.length > 0) {
      // Extract number from code (PAT001 → 001 → 1)
      const lastCode = lastPatient[0].patientCode;
      const lastNumber = parseInt(lastCode.substring(3));
      nextNumber = lastNumber + 1;
    }

    // Add retry count to handle race conditions
    nextNumber = nextNumber + retryCount;

    // Format with leading zeros (PAT001, PAT002, ...)
    return `PAT${nextNumber.toString().padStart(3, '0')}`;
  } catch (error) {
    console.error('Error generating patient code:', error);
    throw new Error('Failed to generate patient code');
  }
}

/**
 * Calculate age from date of birth
 */
function calculateAge(dateOfBirth) {
  if (!dateOfBirth) return null;

  const today = new Date();
  const birthDate = new Date(dateOfBirth);
  let age = today.getFullYear() - birthDate.getFullYear();
  const monthDiff = today.getMonth() - birthDate.getMonth();

  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
    age--;
  }

  return age;
}

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

/**
 * Get user's organization ID
 * SuperAdmin must provide orgId in query params
 * Hospital Admin uses their orgId from user record
 */
async function getUserOrgId(req) {
  // SuperAdmin can work with any organization via orgId query param
  if (req.user.role === 'SuperAdmin') {
    const orgId = req.query.orgId;
    if (!orgId) {
      throw new Error('SuperAdmin must provide orgId parameter');
    }
    return orgId;
  }

  // Hospital Admin and staff use their assigned orgId
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
// PATIENT CRUD ENDPOINTS
// ============================================================================

/**
 * GET /api/patients
 * List all patients for organization
 * - SuperAdmin: Must provide orgId query param
 * - Hospital Admin: See patients from their organization
 * Supports search, pagination, and filters
 */
router.get('/', authenticateToken, async (req, res) => {
  try {
    const { status, search, limit = 50, offset = 0 } = req.query;
    const orgId = await getUserOrgId(req);

    // Build query filters
    const where = { orgId };

    // Filter by status if provided
    if (status) {
      where.status = status;
    }

    // Search by name, mobile, email, or patient code
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { mobile: { contains: search } },
        { email: { contains: search, mode: 'insensitive' } },
        { patientCode: { contains: search, mode: 'insensitive' } }
      ];
    }

    // Get patients with pagination
    const patients = await prisma.patient.findMany({
      where,
      orderBy: [
        { dateCreated: 'desc' }
      ],
      take: parseInt(limit),
      skip: parseInt(offset),
      include: {
        _count: {
          select: {
            opdTokens: true,
            ipdAdmissions: true,
            labTests: true,
            bills: true
          }
        }
      }
    });

    // Get total count for pagination
    const total = await prisma.patient.count({ where });

    res.json({
      data: patients,
      meta: {
        total,
        limit: parseInt(limit),
        offset: parseInt(offset)
      }
    });
  } catch (error) {
    console.error('Get patients error:', error);
    res.status(500).json({ errors: [{ message: error.message || 'Failed to get patients' }] });
  }
});

/**
 * GET /api/patients/code/:patientCode
 * Get patient by patient code (PAT001, PAT002, etc.)
 * IMPORTANT: Must be defined BEFORE /:id route to avoid "code" being treated as an ID
 */
router.get('/code/:patientCode', authenticateToken, async (req, res) => {
  try {
    const orgId = await getUserOrgId(req);

    const patient = await prisma.patient.findFirst({
      where: {
        patientCode: req.params.patientCode,
        orgId
      },
      include: {
        _count: {
          select: {
            opdTokens: true,
            ipdAdmissions: true,
            labTests: true,
            bills: true
          }
        }
      }
    });

    if (!patient) {
      return res.status(404).json({
        errors: [{ message: `Patient with code ${req.params.patientCode} not found` }]
      });
    }

    res.json({ data: patient });
  } catch (error) {
    console.error('Get patient by code error:', error);
    res.status(500).json({ errors: [{ message: error.message || 'Failed to get patient' }] });
  }
});

/**
 * GET /api/patients/:id
 * Get single patient by ID
 */
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const orgId = await getUserOrgId(req);

    const patient = await prisma.patient.findFirst({
      where: {
        id: req.params.id,
        orgId
      },
      include: {
        organization: {
          select: {
            code: true,
            name: true
          }
        },
        _count: {
          select: {
            opdTokens: true,
            ipdAdmissions: true,
            labTests: true,
            radiologyTests: true,
            pharmacyOrders: true,
            bills: true,
            appointments: true
          }
        }
      }
    });

    if (!patient) {
      return res.status(404).json({
        errors: [{ message: 'Patient not found' }]
      });
    }

    res.json({ data: patient });
  } catch (error) {
    console.error('Get patient error:', error);
    res.status(500).json({ errors: [{ message: error.message || 'Failed to get patient' }] });
  }
});

/**
 * POST /api/patients
 * Register new patient
 * - Auto-generates patient code (PAT001, PAT002, etc.)
 * - Auto-calculates age from date of birth
 */
router.post('/', authenticateToken, async (req, res) => {
  const MAX_RETRIES = 3;
  let retryCount = 0;

  while (retryCount < MAX_RETRIES) {
    try {
      const orgId = await getUserOrgId(req);

      let {
        name,
        mobile,
        email,
        dateOfBirth,
        gender,
        bloodGroup,
        address,
        city,
        state,
        pincode,
        emergencyContactName,
        emergencyContactNumber,
        allergies,
        medicalHistory,
        chronicDiseases,
        currentMedications,
        photo,
        firstName,
        lastName,
        phone
      } = req.body;

      // Handle legacy field names: combine firstName/lastName into name
      if (!name && (firstName || lastName)) {
        name = `${firstName || ''} ${lastName || ''}`.trim();
      }

      // Handle legacy field: phone -> mobile
      if (!mobile && phone) {
        mobile = phone;
      }

      // Validate required fields
      if (!name || !mobile) {
        return res.status(400).json({
          errors: [{ message: 'Patient name and mobile are required' }]
        });
      }

      // Check if mobile number already exists for this organization
      const existingPatient = await prisma.patient.findFirst({
        where: {
          mobile,
          orgId
        }
      });

      if (existingPatient) {
        return res.status(400).json({
          errors: [{ message: 'Patient with this mobile number already exists' }]
        });
      }

      // Generate patient code with retry count to handle race conditions
      const patientCode = await generatePatientCode(orgId, retryCount);

      // Calculate age if date of birth provided
      const age = calculateAge(dateOfBirth);

      // Create patient
      const patient = await prisma.patient.create({
        data: {
          orgId,
          patientCode,
          name,
          mobile,
          email,
          dateOfBirth: dateOfBirth ? new Date(dateOfBirth) : null,
          age,
          gender,
          bloodGroup,
          address,
          city,
          state,
          pincode,
          emergencyContactName,
          emergencyContactNumber,
          allergies,
          medicalHistory,
          chronicDiseases,
          currentMedications,
          photo,
          status: 'active'
        }
      });

      return res.status(201).json({
        data: patient,
        message: `Patient registered successfully with code: ${patientCode}`
      });

    } catch (error) {
      // Check if it's a unique constraint error on patient_code
      if (error.code === 'P2002' && error.meta?.target?.includes('patient_code')) {
        retryCount++;
        console.log(`Patient code collision detected. Retry attempt ${retryCount}/${MAX_RETRIES}`);

        if (retryCount >= MAX_RETRIES) {
          console.error('Max retries reached for patient creation');
          return res.status(500).json({
            errors: [{ message: 'Failed to generate unique patient code after multiple attempts. Please try again.' }]
          });
        }

        // Continue to next retry iteration
        continue;
      }

      // For any other error, return immediately
      console.error('Create patient error:', error);
      return res.status(500).json({
        errors: [{ message: error.message || 'Failed to register patient' }]
      });
    }
  }
});

/**
 * PATCH /api/patients/:id
 * Update patient information
 */
router.patch('/:id', authenticateToken, async (req, res) => {
  try {
    const orgId = await getUserOrgId(req);

    const {
      name,
      mobile,
      phone, // alias for mobile
      email,
      dateOfBirth,
      gender,
      bloodGroup,
      address,
      city,
      state,
      pincode,
      emergencyContactName,
      emergencyContactNumber,
      allergies,
      medicalHistory,
      chronicDiseases,
      currentMedications,
      photo,
      status
    } = req.body;

    // Build update data object (only include provided fields)
    const updateData = {};

    if (name !== undefined) updateData.name = name;
    if (mobile !== undefined) updateData.mobile = mobile;
    if (phone !== undefined) updateData.mobile = phone; // phone is alias for mobile
    if (email !== undefined) updateData.email = email;
    if (dateOfBirth !== undefined) {
      updateData.dateOfBirth = dateOfBirth ? new Date(dateOfBirth) : null;
      updateData.age = calculateAge(dateOfBirth);
    }
    if (gender !== undefined) updateData.gender = gender;
    if (bloodGroup !== undefined) updateData.bloodGroup = bloodGroup;
    if (address !== undefined) updateData.address = address;
    if (city !== undefined) updateData.city = city;
    if (state !== undefined) updateData.state = state;
    if (pincode !== undefined) updateData.pincode = pincode;
    if (emergencyContactName !== undefined) updateData.emergencyContactName = emergencyContactName;
    if (emergencyContactNumber !== undefined) updateData.emergencyContactNumber = emergencyContactNumber;
    if (allergies !== undefined) updateData.allergies = allergies;
    if (medicalHistory !== undefined) updateData.medicalHistory = medicalHistory;
    if (chronicDiseases !== undefined) updateData.chronicDiseases = chronicDiseases;
    if (currentMedications !== undefined) updateData.currentMedications = currentMedications;
    if (photo !== undefined) updateData.photo = photo;
    if (status !== undefined) updateData.status = status;

    // Update patient
    const patient = await prisma.patient.updateMany({
      where: {
        id: req.params.id,
        orgId
      },
      data: updateData
    });

    if (patient.count === 0) {
      return res.status(404).json({ errors: [{ message: 'Patient not found' }] });
    }

    // Fetch updated patient
    const updatedPatient = await prisma.patient.findUnique({
      where: { id: req.params.id }
    });

    res.json({
      data: updatedPatient,
      message: 'Patient updated successfully'
    });
  } catch (error) {
    console.error('Update patient error:', error);
    res.status(500).json({ errors: [{ message: error.message || 'Failed to update patient' }] });
  }
});

/**
 * DELETE /api/patients/:id
 * Delete/deactivate patient
 * Sets status to 'inactive' instead of hard delete
 */
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    const orgId = await getUserOrgId(req);

    // Soft delete: Set status to inactive
    const patient = await prisma.patient.updateMany({
      where: {
        id: req.params.id,
        orgId
      },
      data: {
        status: 'inactive'
      }
    });

    if (patient.count === 0) {
      return res.status(404).json({ errors: [{ message: 'Patient not found' }] });
    }

    res.json({
      message: 'Patient deactivated successfully'
    });
  } catch (error) {
    console.error('Delete patient error:', error);
    res.status(500).json({ errors: [{ message: error.message || 'Failed to delete patient' }] });
  }
});

/**
 * GET /api/patients/:id/history
 * Get patient's complete medical history
 * - OPD tokens
 * - IPD admissions
 * - Lab tests
 * - Radiology tests
 * - Pharmacy orders
 * - Bills
 */
router.get('/:id/history', authenticateToken, async (req, res) => {
  try {
    const orgId = await getUserOrgId(req);

    const patient = await prisma.patient.findFirst({
      where: {
        id: req.params.id,
        orgId
      },
      include: {
        opdTokens: {
          orderBy: { tokenDate: 'desc' },
          take: 10,
          include: {
            doctor: {
              select: { firstName: true, lastName: true }
            },
            department: {
              select: { name: true }
            }
          }
        },
        ipdAdmissions: {
          orderBy: { admissionDate: 'desc' },
          take: 10,
          include: {
            doctor: {
              select: { firstName: true, lastName: true }
            },
            department: {
              select: { name: true }
            },
            bed: {
              select: { bedNumber: true, bedType: true }
            }
          }
        },
        labTests: {
          orderBy: { orderDate: 'desc' },
          take: 10,
          select: {
            id: true,
            testCode: true,
            testName: true,
            orderDate: true,
            reportDate: true,
            status: true
          }
        },
        radiologyTests: {
          orderBy: { orderDate: 'desc' },
          take: 10,
          select: {
            id: true,
            testCode: true,
            testName: true,
            testType: true,
            orderDate: true,
            reportDate: true,
            status: true
          }
        },
        bills: {
          orderBy: { dateCreated: 'desc' },
          take: 10,
          select: {
            id: true,
            billNumber: true,
            billType: true,
            totalAmount: true,
            paidAmount: true,
            paymentStatus: true,
            dateCreated: true
          }
        }
      }
    });

    if (!patient) {
      return res.status(404).json({
        errors: [{ message: 'Patient not found' }]
      });
    }

    res.json({ data: patient });
  } catch (error) {
    console.error('Get patient history error:', error);
    res.status(500).json({ errors: [{ message: error.message || 'Failed to get patient history' }] });
  }
});

module.exports = router;
