// User Management API Routes
// CRUD operations for users with role assignment
// RBAC: Only admins can manage users

const express = require('express');
const router = express.Router();
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const {
  requireAdmin,
  requireSuperAdmin,
  ROLES,
  PERMISSION_GROUPS
} = require('../middleware/rbac');

const prisma = new PrismaClient();
const JWT_SECRET = process.env.JWT_SECRET || 'hospital-saas-jwt-secret-2024';

console.log('✅ User management routes loaded');

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
// USER MANAGEMENT ENDPOINTS
// ============================================================================

/**
 * GET /api/users
 * List all users in organization
 * RBAC: Admins only
 * - SuperAdmin: Can list users from any org (with orgId param)
 * - HospitalAdmin: Can only list users from their org
 */
router.get('/', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { role, status, search, limit = 50, offset = 0 } = req.query;

    // Determine which org's users to fetch
    let orgId;
    if (req.user.role === 'SuperAdmin') {
      orgId = req.query.orgId; // SuperAdmin can specify orgId
    } else {
      orgId = req.user.orgId; // HospitalAdmin sees their own org only
    }

    // Build query filters
    const where = {};

    if (orgId) {
      where.orgId = orgId;
    }

    if (role) {
      where.role = role;
    }

    if (status) {
      where.status = status;
    }

    if (search) {
      where.OR = [
        { email: { contains: search, mode: 'insensitive' } },
        { firstName: { contains: search, mode: 'insensitive' } },
        { lastName: { contains: search, mode: 'insensitive' } }
      ];
    }

    // Fetch users (exclude password)
    const users = await prisma.user.findMany({
      where,
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        orgId: true,
        status: true,
        phone: true,
        avatar: true,
        dateCreated: true,
        dateUpdated: true,
        organization: {
          select: {
            id: true,
            name: true,
            code: true
          }
        }
      },
      orderBy: {
        dateCreated: 'desc'
      },
      take: parseInt(limit),
      skip: parseInt(offset)
    });

    // Get total count
    const total = await prisma.user.count({ where });

    res.json({
      data: users,
      meta: {
        total,
        limit: parseInt(limit),
        offset: parseInt(offset)
      }
    });
  } catch (error) {
    console.error('List users error:', error);
    res.status(500).json({
      errors: [{ message: error.message }]
    });
  }
});

/**
 * GET /api/users/:id
 * Get single user by ID
 * RBAC: Admins only
 */
router.get('/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;

    const user = await prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        orgId: true,
        status: true,
        phone: true,
        avatar: true,
        dateCreated: true,
        dateUpdated: true,
        organization: {
          select: {
            id: true,
            name: true,
            code: true
          }
        }
      }
    });

    if (!user) {
      return res.status(404).json({
        errors: [{ message: 'User not found' }]
      });
    }

    // HospitalAdmin can only view users from their org
    if (req.user.role !== 'SuperAdmin' && user.orgId !== req.user.orgId) {
      return res.status(403).json({
        errors: [{ message: 'Access denied. Cannot view users from other organizations.' }]
      });
    }

    res.json({ data: user });
  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({
      errors: [{ message: error.message }]
    });
  }
});

/**
 * POST /api/users
 * Create new user with role assignment
 * RBAC: Admins only
 * - SuperAdmin: Can create users with any role in any org
 * - HospitalAdmin: Can create users (except HospitalAdmin/SuperAdmin) in their org only
 */
router.post('/', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const {
      email,
      password,
      firstName,
      lastName,
      role,
      orgId,
      phone,
      status = 'active'
    } = req.body;

    // Validation
    if (!email || !password || !role) {
      return res.status(400).json({
        errors: [{ message: 'Email, password, and role are required' }]
      });
    }

    // Role validation based on who's creating the user
    if (req.user.role === 'HospitalAdmin') {
      // HospitalAdmin cannot create SuperAdmin or other HospitalAdmins
      if (role === 'SuperAdmin' || role === 'HospitalAdmin') {
        return res.status(403).json({
          errors: [{ message: 'HospitalAdmin cannot create SuperAdmin or HospitalAdmin users' }]
        });
      }

      // HospitalAdmin can only create users in their own organization
      if (orgId && orgId !== req.user.orgId) {
        return res.status(403).json({
          errors: [{ message: 'HospitalAdmin can only create users in their own organization' }]
        });
      }
    }

    // Determine orgId
    let finalOrgId;
    if (req.user.role === 'SuperAdmin') {
      finalOrgId = orgId; // SuperAdmin can specify orgId
    } else {
      finalOrgId = req.user.orgId; // HospitalAdmin uses their own orgId
    }

    // Check if email already exists
    const existingUser = await prisma.user.findUnique({
      where: { email }
    });

    if (existingUser) {
      return res.status(400).json({
        errors: [{ message: 'Email already exists' }]
      });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create user
    const user = await prisma.user.create({
      data: {
        email,
        password: hashedPassword,
        firstName,
        lastName,
        role,
        orgId: finalOrgId,
        phone,
        status
      },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        orgId: true,
        status: true,
        phone: true,
        dateCreated: true
      }
    });

    res.status(201).json({
      data: user,
      message: 'User created successfully'
    });
  } catch (error) {
    console.error('Create user error:', error);
    res.status(500).json({
      errors: [{ message: error.message }]
    });
  }
});

/**
 * PATCH /api/users/:id
 * Update user (including role change)
 * RBAC: Admins only
 */
router.patch('/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const {
      email,
      firstName,
      lastName,
      role,
      orgId,
      phone,
      status,
      password
    } = req.body;

    // Fetch existing user
    const existingUser = await prisma.user.findUnique({
      where: { id }
    });

    if (!existingUser) {
      return res.status(404).json({
        errors: [{ message: 'User not found' }]
      });
    }

    // HospitalAdmin can only update users in their org
    if (req.user.role === 'HospitalAdmin') {
      if (existingUser.orgId !== req.user.orgId) {
        return res.status(403).json({
          errors: [{ message: 'Access denied. Cannot update users from other organizations.' }]
        });
      }

      // HospitalAdmin cannot change role to SuperAdmin/HospitalAdmin
      if (role && (role === 'SuperAdmin' || role === 'HospitalAdmin')) {
        return res.status(403).json({
          errors: [{ message: 'HospitalAdmin cannot set role to SuperAdmin or HospitalAdmin' }]
        });
      }
    }

    // Build update data
    const updateData = {};
    if (email) updateData.email = email;
    if (firstName) updateData.firstName = firstName;
    if (lastName) updateData.lastName = lastName;
    if (role) updateData.role = role;
    if (orgId && req.user.role === 'SuperAdmin') updateData.orgId = orgId; // Only SuperAdmin can change orgId
    if (phone) updateData.phone = phone;
    if (status) updateData.status = status;

    // Update password if provided
    if (password) {
      updateData.password = await bcrypt.hash(password, 10);
    }

    // Update user
    const user = await prisma.user.update({
      where: { id },
      data: updateData,
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        orgId: true,
        status: true,
        phone: true,
        dateUpdated: true
      }
    });

    res.json({
      data: user,
      message: 'User updated successfully'
    });
  } catch (error) {
    console.error('Update user error:', error);
    res.status(500).json({
      errors: [{ message: error.message }]
    });
  }
});

/**
 * DELETE /api/users/:id
 * Delete user (soft delete by setting status to inactive)
 * RBAC: Admins only
 */
router.delete('/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;

    // Fetch existing user
    const existingUser = await prisma.user.findUnique({
      where: { id }
    });

    if (!existingUser) {
      return res.status(404).json({
        errors: [{ message: 'User not found' }]
      });
    }

    // HospitalAdmin can only delete users in their org
    if (req.user.role === 'HospitalAdmin' && existingUser.orgId !== req.user.orgId) {
      return res.status(403).json({
        errors: [{ message: 'Access denied. Cannot delete users from other organizations.' }]
      });
    }

    // Cannot delete yourself
    if (id === req.user.id) {
      return res.status(400).json({
        errors: [{ message: 'Cannot delete your own account' }]
      });
    }

    // Soft delete by setting status to inactive
    await prisma.user.update({
      where: { id },
      data: {
        status: 'inactive'
      }
    });

    res.json({
      message: 'User deleted successfully'
    });
  } catch (error) {
    console.error('Delete user error:', error);
    res.status(500).json({
      errors: [{ message: error.message }]
    });
  }
});

/**
 * GET /api/users/roles/available
 * Get list of roles that current user can assign
 * RBAC: Admins only
 */
router.get('/roles/available', authenticateToken, requireAdmin, async (req, res) => {
  try {
    let availableRoles;

    if (req.user.role === 'SuperAdmin') {
      // SuperAdmin can assign any role
      availableRoles = Object.values(ROLES);
    } else if (req.user.role === 'HospitalAdmin') {
      // HospitalAdmin can assign all roles except SuperAdmin and HospitalAdmin
      availableRoles = Object.values(ROLES).filter(
        role => role !== 'SuperAdmin' && role !== 'HospitalAdmin'
      );
    } else {
      availableRoles = [];
    }

    res.json({
      data: availableRoles.map(role => ({
        value: role,
        label: role
      }))
    });
  } catch (error) {
    console.error('Get available roles error:', error);
    res.status(500).json({
      errors: [{ message: error.message }]
    });
  }
});

module.exports = router;
