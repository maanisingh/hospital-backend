// RBAC (Role-Based Access Control) Middleware
// Hospital SaaS Platform - Multi-tenant Access Control

// ============================================================================
// ROLE DEFINITIONS
// ============================================================================

const ROLES = {
  SUPER_ADMIN: 'SuperAdmin',
  HOSPITAL_ADMIN: 'HospitalAdmin',
  DOCTOR: 'Doctor',
  NURSE: 'Nurse',
  RECEPTIONIST: 'Receptionist',
  PHARMACIST: 'Pharmacist',
  LAB_TECHNICIAN: 'LabTechnician',
  RADIOLOGIST: 'Radiologist',
  BILLING: 'Billing',
  // Extended roles
  ACCOUNTANT: 'Accountant',
  HR_MANAGER: 'HRManager',
  MEDICAL_RECORDS: 'MedicalRecords',
  INVENTORY_MANAGER: 'InventoryManager',
  DIETITIAN: 'Dietitian',
  PHYSIOTHERAPIST: 'Physiotherapist'
};

// ============================================================================
// PERMISSION GROUPS
// ============================================================================

const PERMISSION_GROUPS = {
  // All authenticated users
  ALL_USERS: Object.values(ROLES),

  // Administrative roles
  ADMINS: [ROLES.SUPER_ADMIN, ROLES.HOSPITAL_ADMIN],

  // Medical/Clinical staff
  MEDICAL_STAFF: [ROLES.DOCTOR, ROLES.NURSE],
  CLINICAL_ALL: [ROLES.DOCTOR, ROLES.NURSE, ROLES.LAB_TECHNICIAN, ROLES.RADIOLOGIST],

  // Patient management
  PATIENT_ACCESS: [ROLES.SUPER_ADMIN, ROLES.HOSPITAL_ADMIN, ROLES.DOCTOR, ROLES.NURSE, ROLES.RECEPTIONIST],
  PATIENT_WRITE: [ROLES.SUPER_ADMIN, ROLES.HOSPITAL_ADMIN, ROLES.DOCTOR, ROLES.NURSE, ROLES.RECEPTIONIST],

  // OPD/Appointments
  OPD_ACCESS: [ROLES.SUPER_ADMIN, ROLES.HOSPITAL_ADMIN, ROLES.DOCTOR, ROLES.NURSE, ROLES.RECEPTIONIST],
  OPD_CONSULTATION: [ROLES.SUPER_ADMIN, ROLES.HOSPITAL_ADMIN, ROLES.DOCTOR],

  // IPD
  IPD_ACCESS: [ROLES.SUPER_ADMIN, ROLES.HOSPITAL_ADMIN, ROLES.DOCTOR, ROLES.NURSE],
  IPD_DISCHARGE: [ROLES.SUPER_ADMIN, ROLES.HOSPITAL_ADMIN, ROLES.DOCTOR],

  // Pharmacy
  PHARMACY_READ: [ROLES.SUPER_ADMIN, ROLES.HOSPITAL_ADMIN, ROLES.DOCTOR, ROLES.PHARMACIST],
  PHARMACY_MANAGE: [ROLES.SUPER_ADMIN, ROLES.HOSPITAL_ADMIN, ROLES.PHARMACIST],
  PRESCRIPTION_CREATE: [ROLES.SUPER_ADMIN, ROLES.HOSPITAL_ADMIN, ROLES.DOCTOR],

  // Lab
  LAB_ORDER: [ROLES.SUPER_ADMIN, ROLES.HOSPITAL_ADMIN, ROLES.DOCTOR, ROLES.NURSE],
  LAB_PROCESS: [ROLES.SUPER_ADMIN, ROLES.HOSPITAL_ADMIN, ROLES.NURSE, ROLES.LAB_TECHNICIAN],
  LAB_RESULTS: [ROLES.SUPER_ADMIN, ROLES.HOSPITAL_ADMIN, ROLES.LAB_TECHNICIAN],

  // Radiology
  RADIOLOGY_ORDER: [ROLES.SUPER_ADMIN, ROLES.HOSPITAL_ADMIN, ROLES.DOCTOR],
  RADIOLOGY_PROCESS: [ROLES.SUPER_ADMIN, ROLES.HOSPITAL_ADMIN, ROLES.RADIOLOGIST],

  // Billing
  BILLING_VIEW: [ROLES.SUPER_ADMIN, ROLES.HOSPITAL_ADMIN, ROLES.DOCTOR, ROLES.RECEPTIONIST, ROLES.BILLING, ROLES.ACCOUNTANT],
  BILLING_MANAGE: [ROLES.SUPER_ADMIN, ROLES.HOSPITAL_ADMIN, ROLES.RECEPTIONIST, ROLES.BILLING],
  BILLING_REPORTS: [ROLES.SUPER_ADMIN, ROLES.HOSPITAL_ADMIN, ROLES.BILLING, ROLES.ACCOUNTANT],

  // Organization Management
  ORG_VIEW: [ROLES.SUPER_ADMIN, ROLES.HOSPITAL_ADMIN],
  ORG_MANAGE: [ROLES.SUPER_ADMIN],

  // Dashboard & Stats
  DASHBOARD_ACCESS: [ROLES.SUPER_ADMIN, ROLES.HOSPITAL_ADMIN, ROLES.DOCTOR],

  // Extended Permissions
  FINANCIAL_REPORTS: [ROLES.SUPER_ADMIN, ROLES.HOSPITAL_ADMIN, ROLES.ACCOUNTANT],
  HR_MANAGEMENT: [ROLES.SUPER_ADMIN, ROLES.HOSPITAL_ADMIN, ROLES.HR_MANAGER],
  MEDICAL_RECORDS_ACCESS: [ROLES.SUPER_ADMIN, ROLES.HOSPITAL_ADMIN, ROLES.DOCTOR, ROLES.NURSE, ROLES.MEDICAL_RECORDS],
  INVENTORY_MANAGE: [ROLES.SUPER_ADMIN, ROLES.HOSPITAL_ADMIN, ROLES.INVENTORY_MANAGER, ROLES.PHARMACIST],
  DIETARY_MANAGE: [ROLES.SUPER_ADMIN, ROLES.HOSPITAL_ADMIN, ROLES.DIETITIAN, ROLES.DOCTOR],
  THERAPY_MANAGE: [ROLES.SUPER_ADMIN, ROLES.HOSPITAL_ADMIN, ROLES.PHYSIOTHERAPIST, ROLES.DOCTOR]
};

// ============================================================================
// RBAC MIDDLEWARE FUNCTIONS
// ============================================================================

/**
 * Check if user has one of the required roles
 * @param {Array<string>} allowedRoles - Array of role names that can access
 */
const requireRole = (allowedRoles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        errors: [{ message: 'Authentication required' }]
      });
    }

    const userRole = req.user.role;

    if (!allowedRoles.includes(userRole)) {
      return res.status(403).json({
        errors: [{
          message: 'Access denied. Insufficient permissions.',
          requiredRoles: allowedRoles,
          userRole: userRole
        }]
      });
    }

    next();
  };
};

/**
 * Check if user is SuperAdmin
 */
const requireSuperAdmin = () => {
  return requireRole([ROLES.SUPER_ADMIN]);
};

/**
 * Check if user is any admin (SuperAdmin or HospitalAdmin)
 */
const requireAdmin = () => {
  return requireRole(PERMISSION_GROUPS.ADMINS);
};

/**
 * Ensure user can only access their own organization's data
 * SuperAdmin can access all organizations
 */
const enforceOrgScope = () => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        errors: [{ message: 'Authentication required' }]
      });
    }

    const userRole = req.user.role;
    const userOrgId = req.user.orgId;
    const requestedOrgId = req.query.orgId || req.body.orgId || req.params.orgId;

    // SuperAdmin can access any organization
    if (userRole === ROLES.SUPER_ADMIN) {
      return next();
    }

    // For non-SuperAdmin users
    if (!userOrgId) {
      return res.status(403).json({
        errors: [{ message: 'User has no organization assigned' }]
      });
    }

    // If orgId is provided in request, it must match user's orgId
    if (requestedOrgId && requestedOrgId !== userOrgId) {
      return res.status(403).json({
        errors: [{
          message: 'Access denied. Cannot access other organizations.',
          userOrgId: userOrgId,
          requestedOrgId: requestedOrgId
        }]
      });
    }

    // Automatically set orgId for the user's organization
    if (!req.query.orgId && !req.body.orgId) {
      req.query.orgId = userOrgId;
    }

    next();
  };
};

/**
 * Combined middleware: Role check + Org scope enforcement
 * @param {Array<string>} allowedRoles - Roles that can access
 */
const requireRoleWithOrgScope = (allowedRoles) => {
  return [
    requireRole(allowedRoles),
    enforceOrgScope()
  ];
};

/**
 * Check if user has permission for a specific action
 * @param {string} permissionGroup - Name of permission group from PERMISSION_GROUPS
 */
const requirePermission = (permissionGroup) => {
  return (req, res, next) => {
    if (!PERMISSION_GROUPS[permissionGroup]) {
      console.error(`Invalid permission group: ${permissionGroup}`);
      return res.status(500).json({
        errors: [{ message: 'Internal server error: Invalid permission configuration' }]
      });
    }

    return requireRole(PERMISSION_GROUPS[permissionGroup])(req, res, next);
  };
};

/**
 * Allow access to resource owner or admin
 * Useful for endpoints like "update my profile" or "view my data"
 */
const requireOwnerOrAdmin = (getOwnerIdFromReq) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        errors: [{ message: 'Authentication required' }]
      });
    }

    const userRole = req.user.role;
    const userId = req.user.id;
    const ownerId = getOwnerIdFromReq(req);

    // Admins can access any resource
    if (userRole === ROLES.SUPER_ADMIN || userRole === ROLES.HOSPITAL_ADMIN) {
      return next();
    }

    // User can access their own resource
    if (userId === ownerId) {
      return next();
    }

    return res.status(403).json({
      errors: [{ message: 'Access denied. Can only access your own resources.' }]
    });
  };
};

/**
 * Log access attempts for audit trail
 */
const logAccess = (action) => {
  return (req, res, next) => {
    const timestamp = new Date().toISOString();
    const user = req.user || { id: 'anonymous', role: 'none' };
    const orgId = req.query.orgId || req.body.orgId || req.user?.orgId || 'none';

    console.log(`[RBAC] ${timestamp} | ${action} | User: ${user.id} | Role: ${user.role} | OrgId: ${orgId} | Path: ${req.path}`);

    next();
  };
};

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Check if user has specific role (without middleware)
 */
const hasRole = (user, role) => {
  return user && user.role === role;
};

/**
 * Check if user has any of the specified roles
 */
const hasAnyRole = (user, roles) => {
  return user && roles.includes(user.role);
};

/**
 * Check if user is in the same organization
 */
const isSameOrg = (user, orgId) => {
  if (user.role === ROLES.SUPER_ADMIN) return true;
  return user.orgId === orgId;
};

/**
 * Get effective orgId for query (user's org or requested org for SuperAdmin)
 */
const getEffectiveOrgId = (req) => {
  const userRole = req.user?.role;
  const userOrgId = req.user?.orgId;
  const requestedOrgId = req.query.orgId || req.body.orgId;

  if (userRole === ROLES.SUPER_ADMIN && requestedOrgId) {
    return requestedOrgId;
  }

  return userOrgId;
};

// ============================================================================
// EXPORTS
// ============================================================================

module.exports = {
  // Role constants
  ROLES,
  PERMISSION_GROUPS,

  // Middleware functions
  requireRole,
  requireSuperAdmin,
  requireAdmin,
  enforceOrgScope,
  requireRoleWithOrgScope,
  requirePermission,
  requireOwnerOrAdmin,
  logAccess,

  // Utility functions
  hasRole,
  hasAnyRole,
  isSameOrg,
  getEffectiveOrgId
};
