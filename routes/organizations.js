// Organization CRUD Endpoints
// Routes for managing hospitals/clinics (multi-tenant organizations)
// SuperAdmin can create hospitals with codes like h101, h102, etc.

const express = require('express');
const router = express.Router();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Generate next organization code (h101, h102, h103, ...)
 * Queries database for highest code number and increments
 */
async function generateOrganizationCode() {
  try {
    // Get the latest organization code
    const lastOrg = await prisma.organization.findMany({
      where: {
        code: {
          startsWith: 'h'
        }
      },
      orderBy: {
        code: 'desc'
      },
      take: 1,
      select: {
        code: true
      }
    });

    if (lastOrg.length === 0) {
      // First organization
      return 'h101';
    }

    // Extract number from code (h101 → 101)
    const lastCode = lastOrg[0].code;
    const lastNumber = parseInt(lastCode.substring(1));
    const nextNumber = lastNumber + 1;

    return `h${nextNumber}`;
  } catch (error) {
    console.error('Error generating organization code:', error);
    throw new Error('Failed to generate organization code');
  }
}

/**
 * Validate organization code format
 * Must be h followed by 3+ digits (h101, h102, h999)
 */
function isValidOrgCode(code) {
  return /^h\d{3,}$/.test(code);
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
const {
  requirePermission,
  requireAdmin,
  requireSuperAdmin,
  enforceOrgScope
} = require('../middleware/rbac');
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
 * SuperAdmin authorization middleware
 * Only SuperAdmin can create/manage all organizations
 */
const requireSuperAdmin = (req, res, next) => {
  if (req.user.role !== 'SuperAdmin') {
    return res.status(403).json({
      errors: [{ message: 'Only SuperAdmin can perform this action' }]
    });
  }
  next();
};

/**
 * Organization access middleware
 * Hospital Admin can only access their own organization
 */
const requireOrgAccess = async (req, res, next) => {
  try {
    const orgId = req.params.id;

    // SuperAdmin can access any organization
    if (req.user.role === 'SuperAdmin') {
      return next();
    }

    // Hospital Admin must match orgId
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: { orgId: true }
    });

    if (!user || user.orgId !== orgId) {
      return res.status(403).json({
        errors: [{ message: 'Access denied to this organization' }]
      });
    }

    next();
  } catch (error) {
    console.error('Organization access check error:', error);
    res.status(500).json({ errors: [{ message: 'Authorization failed' }] });
  }
};

// ============================================================================
// ORGANIZATION CRUD ENDPOINTS
// ============================================================================

/**
 * GET /api/organizations
 * List all organizations
 * - SuperAdmin: See all organizations
 * - Hospital Admin: See only their organization
 */
router.get('/', authenticateToken, requirePermission('ORG_VIEW'), async (req, res) => {
  try {
    const { status, search, limit = 50, offset = 0 } = req.query;

    // Build query filters
    const where = {};

    // Filter by status if provided
    if (status) {
      where.status = status;
    }

    // Search by name, code, or email
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { code: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } }
      ];
    }

    // Hospital Admin: Only their organization
    if (req.user.role !== 'SuperAdmin') {
      const user = await prisma.user.findUnique({
        where: { id: req.user.id },
        select: { orgId: true }
      });

      if (!user || !user.orgId) {
        return res.status(403).json({
          errors: [{ message: 'No organization associated with user' }]
        });
      }

      where.id = user.orgId;
    }

    // Get organizations with pagination
    const organizations = await prisma.organization.findMany({
      where,
      orderBy: [
        { dateCreated: 'desc' }
      ],
      take: parseInt(limit),
      skip: parseInt(offset),
      include: {
        _count: {
          select: {
            users: true,
            patients: true,
            departments: true,
            beds: true
          }
        }
      }
    });

    // Get total count for pagination
    const total = await prisma.organization.count({ where });

    res.json({
      data: organizations,
      meta: {
        total,
        limit: parseInt(limit),
        offset: parseInt(offset)
      }
    });
  } catch (error) {
    console.error('Get organizations error:', error);
    res.status(500).json({ errors: [{ message: 'Failed to get organizations' }] });
  }
});

/**
 * GET /api/organizations/:id
 * Get single organization by ID
 * - SuperAdmin: Any organization
 * - Hospital Admin: Only their organization
 */
router.get('/:id', authenticateToken, requirePermission('ORG_VIEW'), requireOrgAccess, async (req, res) => {
  try {
    const organization = await prisma.organization.findUnique({
      where: { id: req.params.id },
      include: {
        _count: {
          select: {
            users: true,
            patients: true,
            departments: true,
            beds: true,
            opdTokens: true,
            ipdAdmissions: true
          }
        }
      }
    });

    if (!organization) {
      return res.status(404).json({
        errors: [{ message: 'Organization not found' }]
      });
    }

    res.json({ data: organization });
  } catch (error) {
    console.error('Get organization error:', error);
    res.status(500).json({ errors: [{ message: 'Failed to get organization' }] });
  }
});

/**
 * POST /api/organizations
 * Create new hospital/organization
 * - Only SuperAdmin can create organizations
 * - Auto-generates code (h101, h102, etc.)
 */
router.post('/', authenticateToken, requireSuperAdmin(), requireSuperAdmin, async (req, res) => {
  try {
    const {
      name,
      businessName,
      logo,
      address,
      city,
      state,
      pincode,
      country,
      phone,
      email,
      helplineNumber,
      websiteUrl,
      ownerName,
      ownerEmail,
      ownerMobile,
      facebookUrl,
      instagramUrl,
      youtubeUrl,
      twitterUrl,
      linkedinUrl,
      dashboardFooterText,
      modules,
      subscriptionPlanId,
      subscriptionStartDate,
      subscriptionEndDate,
      themePrimaryColor,
      themeSecondaryColor,
      headerColor,
      footerColor
    } = req.body;

    // Validate required fields
    if (!name) {
      return res.status(400).json({
        errors: [{ message: 'Organization name is required' }]
      });
    }

    // Generate organization code
    const code = await generateOrganizationCode();

    // Create organization
    const organization = await prisma.organization.create({
      data: {
        code,
        name,
        businessName,
        logo,
        address,
        city,
        state,
        pincode,
        country,
        phone,
        email,
        helplineNumber,
        websiteUrl,
        ownerName,
        ownerEmail,
        ownerMobile,
        facebookUrl,
        instagramUrl,
        youtubeUrl,
        twitterUrl,
        linkedinUrl,
        dashboardFooterText,
        modules: modules || {},
        subscriptionPlanId,
        subscriptionStartDate: subscriptionStartDate ? new Date(subscriptionStartDate) : null,
        subscriptionEndDate: subscriptionEndDate ? new Date(subscriptionEndDate) : null,
        subscriptionStatus: 'active',
        paymentStatus: 'pending',
        themePrimaryColor,
        themeSecondaryColor,
        headerColor,
        footerColor,
        status: 'active'
      }
    });

    res.status(201).json({
      data: organization,
      message: `Hospital created successfully with code: ${code}`
    });
  } catch (error) {
    console.error('Create organization error:', error);
    res.status(500).json({ errors: [{ message: 'Failed to create organization' }] });
  }
});

/**
 * PATCH /api/organizations/:id
 * Update organization
 * - SuperAdmin: Can update any organization
 * - Hospital Admin: Can only update their own organization
 */
router.patch('/:id', authenticateToken, requireAdmin(), requireOrgAccess, async (req, res) => {
  try {
    const {
      name,
      businessName,
      logo,
      address,
      city,
      state,
      pincode,
      country,
      phone,
      email,
      helplineNumber,
      websiteUrl,
      ownerName,
      ownerEmail,
      ownerMobile,
      facebookUrl,
      instagramUrl,
      youtubeUrl,
      twitterUrl,
      linkedinUrl,
      dashboardFooterText,
      modules,
      subscriptionPlanId,
      subscriptionStartDate,
      subscriptionEndDate,
      subscriptionStatus,
      paymentStatus,
      themePrimaryColor,
      themeSecondaryColor,
      headerColor,
      footerColor,
      status
    } = req.body;

    // Build update data object (only include provided fields)
    const updateData = {};

    if (name !== undefined) updateData.name = name;
    if (businessName !== undefined) updateData.businessName = businessName;
    if (logo !== undefined) updateData.logo = logo;
    if (address !== undefined) updateData.address = address;
    if (city !== undefined) updateData.city = city;
    if (state !== undefined) updateData.state = state;
    if (pincode !== undefined) updateData.pincode = pincode;
    if (country !== undefined) updateData.country = country;
    if (phone !== undefined) updateData.phone = phone;
    if (email !== undefined) updateData.email = email;
    if (helplineNumber !== undefined) updateData.helplineNumber = helplineNumber;
    if (websiteUrl !== undefined) updateData.websiteUrl = websiteUrl;
    if (ownerName !== undefined) updateData.ownerName = ownerName;
    if (ownerEmail !== undefined) updateData.ownerEmail = ownerEmail;
    if (ownerMobile !== undefined) updateData.ownerMobile = ownerMobile;
    if (facebookUrl !== undefined) updateData.facebookUrl = facebookUrl;
    if (instagramUrl !== undefined) updateData.instagramUrl = instagramUrl;
    if (youtubeUrl !== undefined) updateData.youtubeUrl = youtubeUrl;
    if (twitterUrl !== undefined) updateData.twitterUrl = twitterUrl;
    if (linkedinUrl !== undefined) updateData.linkedinUrl = linkedinUrl;
    if (dashboardFooterText !== undefined) updateData.dashboardFooterText = dashboardFooterText;
    if (modules !== undefined) updateData.modules = modules;
    if (subscriptionPlanId !== undefined) updateData.subscriptionPlanId = subscriptionPlanId;
    if (subscriptionStartDate !== undefined) updateData.subscriptionStartDate = new Date(subscriptionStartDate);
    if (subscriptionEndDate !== undefined) updateData.subscriptionEndDate = new Date(subscriptionEndDate);
    if (themePrimaryColor !== undefined) updateData.themePrimaryColor = themePrimaryColor;
    if (themeSecondaryColor !== undefined) updateData.themeSecondaryColor = themeSecondaryColor;
    if (headerColor !== undefined) updateData.headerColor = headerColor;
    if (footerColor !== undefined) updateData.footerColor = footerColor;

    // Only SuperAdmin can change these fields
    if (req.user.role === 'SuperAdmin') {
      if (subscriptionStatus !== undefined) updateData.subscriptionStatus = subscriptionStatus;
      if (paymentStatus !== undefined) updateData.paymentStatus = paymentStatus;
      if (status !== undefined) updateData.status = status;
    }

    // Update organization
    const organization = await prisma.organization.update({
      where: { id: req.params.id },
      data: updateData
    });

    res.json({
      data: organization,
      message: 'Organization updated successfully'
    });
  } catch (error) {
    console.error('Update organization error:', error);
    if (error.code === 'P2025') {
      return res.status(404).json({ errors: [{ message: 'Organization not found' }] });
    }
    res.status(500).json({ errors: [{ message: 'Failed to update organization' }] });
  }
});

/**
 * DELETE /api/organizations/:id
 * Delete/deactivate organization
 * - Only SuperAdmin can delete organizations
 * - Sets status to 'inactive' instead of hard delete
 */
router.delete('/:id', authenticateToken, requireSuperAdmin(), requireSuperAdmin, async (req, res) => {
  try {
    // Soft delete: Set status to inactive
    const organization = await prisma.organization.update({
      where: { id: req.params.id },
      data: {
        status: 'inactive',
        subscriptionStatus: 'cancelled'
      }
    });

    res.json({
      data: organization,
      message: 'Organization deactivated successfully'
    });
  } catch (error) {
    console.error('Delete organization error:', error);
    if (error.code === 'P2025') {
      return res.status(404).json({ errors: [{ message: 'Organization not found' }] });
    }
    res.status(500).json({ errors: [{ message: 'Failed to delete organization' }] });
  }
});

/**
 * GET /api/organizations/code/:code
 * Get organization by code (h101, h102, etc.)
 */
router.get('/code/:code', authenticateToken, async (req, res) => {
  try {
    const { code } = req.params;

    // Validate code format
    if (!isValidOrgCode(code)) {
      return res.status(400).json({
        errors: [{ message: 'Invalid organization code format. Must be h followed by digits (e.g., h101)' }]
      });
    }

    const organization = await prisma.organization.findUnique({
      where: { code },
      include: {
        _count: {
          select: {
            users: true,
            patients: true,
            departments: true
          }
        }
      }
    });

    if (!organization) {
      return res.status(404).json({
        errors: [{ message: `Organization with code ${code} not found` }]
      });
    }

    // Check access rights
    if (req.user.role !== 'SuperAdmin') {
      const user = await prisma.user.findUnique({
        where: { id: req.user.id },
        select: { orgId: true }
      });

      if (!user || user.orgId !== organization.id) {
        return res.status(403).json({
          errors: [{ message: 'Access denied to this organization' }]
        });
      }
    }

    res.json({ data: organization });
  } catch (error) {
    console.error('Get organization by code error:', error);
    res.status(500).json({ errors: [{ message: 'Failed to get organization' }] });
  }
});

/**
 * GET /api/organizations/:id/stats
 * Get comprehensive statistics for an organization
 */
router.get('/:id/stats', authenticateToken, requireOrgAccess, async (req, res) => {
  try {
    const { id } = req.params;

    // Verify organization exists
    const organization = await prisma.organization.findUnique({
      where: { id }
    });

    if (!organization) {
      return res.status(404).json({
        errors: [{ message: 'Organization not found' }]
      });
    }

    // Get comprehensive statistics
    const [
      totalPatients,
      totalDepartments,
      totalUsers,
      totalBeds,
      occupiedBeds,
      todayAppointments,
      todayOPDTokens,
      activeIPDAdmissions,
      pendingLabTests,
      pendingRadiologyTests,
      totalRevenue
    ] = await Promise.all([
      // Total patients
      prisma.patient.count({ where: { orgId: id } }),

      // Total departments
      prisma.department.count({ where: { orgId: id } }),

      // Total users/staff
      prisma.user.count({ where: { orgId: id } }),

      // Total beds
      prisma.bed.count({ where: { department: { orgId: id } } }),

      // Occupied beds
      prisma.bed.count({
        where: {
          department: { orgId: id },
          status: 'occupied'
        }
      }),

      // Today's appointments
      prisma.appointment.count({
        where: {
          orgId: id,
          appointmentDate: new Date()
        }
      }),

      // Today's OPD tokens
      prisma.oPDToken.count({
        where: {
          orgId: id,
          tokenDate: new Date()
        }
      }),

      // Active IPD admissions
      prisma.iPDAdmission.count({
        where: {
          orgId: id,
          status: 'admitted'
        }
      }),

      // Pending lab tests
      prisma.labTest.count({
        where: {
          orgId: id,
          status: { in: ['ordered', 'sample_collected', 'processing'] }
        }
      }),

      // Pending radiology tests
      prisma.radiologyTest.count({
        where: {
          orgId: id,
          status: { in: ['ordered', 'scheduled', 'image_captured'] }
        }
      }),

      // Total revenue from pharmacy orders and bills
      prisma.bill.aggregate({
        where: {
          orgId: id,
          paymentStatus: { in: ['paid', 'partial'] }
        },
        _sum: { paidAmount: true }
      })
    ]);

    res.json({
      data: {
        organization: {
          id: organization.id,
          name: organization.name,
          code: organization.code
        },
        patients: {
          total: totalPatients
        },
        departments: {
          total: totalDepartments
        },
        staff: {
          total: totalUsers
        },
        beds: {
          total: totalBeds,
          occupied: occupiedBeds,
          available: totalBeds - occupiedBeds,
          occupancyRate: totalBeds > 0 ? ((occupiedBeds / totalBeds) * 100).toFixed(2) : 0
        },
        appointments: {
          today: todayAppointments
        },
        opd: {
          todayTokens: todayOPDTokens
        },
        ipd: {
          activeAdmissions: activeIPDAdmissions
        },
        lab: {
          pendingTests: pendingLabTests
        },
        radiology: {
          pendingTests: pendingRadiologyTests
        },
        revenue: {
          total: totalRevenue._sum.paidAmount || 0
        }
      }
    });
  } catch (error) {
    console.error('Get organization stats error:', error);
    res.status(500).json({ errors: [{ message: 'Failed to get organization statistics' }] });
  }
});

module.exports = router;
