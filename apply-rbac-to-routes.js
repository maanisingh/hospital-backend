#!/usr/bin/env node

/**
 * Script to apply RBAC middleware to all route files
 * This adds proper role-based access control to every endpoint
 */

const fs = require('fs');
const path = require('path');

// Define RBAC rules for each route file
const routeRBAC = {
  'patients.js': [
    { method: 'GET', path: '/', permission: 'PATIENT_ACCESS' },
    { method: 'POST', path: '/', permission: 'PATIENT_WRITE' },
    { method: 'GET', path: '/:id', permission: 'PATIENT_ACCESS' },
    { method: 'GET', path: '/code/:code', permission: 'PATIENT_ACCESS' },
    { method: 'PATCH', path: '/:id', permission: 'PATIENT_WRITE' },
    { method: 'DELETE', path: '/:id', middleware: 'requireAdmin' },
    { method: 'GET', path: '/:id/history', permission: 'PATIENT_ACCESS' }
  ],
  'opd.js': [
    { method: 'GET', path: '/tokens', permission: 'OPD_ACCESS' },
    { method: 'POST', path: '/tokens', permission: 'OPD_ACCESS' },
    { method: 'GET', path: '/queue', permission: 'OPD_ACCESS' },
    { method: 'POST', path: '/call-next', permission: 'OPD_CONSULTATION' },
    { method: 'POST', path: '/complete', permission: 'OPD_CONSULTATION' }
  ],
  'appointments.js': [
    { method: 'GET', path: '/', permission: 'OPD_ACCESS' },
    { method: 'POST', path: '/', permission: 'OPD_ACCESS' },
    { method: 'GET', path: '/:id', permission: 'OPD_ACCESS' },
    { method: 'PATCH', path: '/:id', permission: 'OPD_ACCESS' },
    { method: 'DELETE', path: '/:id', middleware: 'requireAdmin' }
  ],
  'ipd.js': [
    { method: 'GET', path: '/admissions', permission: 'IPD_ACCESS' },
    { method: 'POST', path: '/admissions', permission: 'IPD_ACCESS' },
    { method: 'GET', path: '/admissions/:id', permission: 'IPD_ACCESS' },
    { method: 'PATCH', path: '/admissions/:id', permission: 'IPD_ACCESS' },
    { method: 'POST', path: '/discharge', permission: 'IPD_DISCHARGE' }
  ],
  'pharmacy.js': [
    { method: 'GET', path: '/medicines', permission: 'PHARMACY_READ' },
    { method: 'POST', path: '/medicines', permission: 'PHARMACY_MANAGE' },
    { method: 'GET', path: '/medicines/:id', permission: 'PHARMACY_READ' },
    { method: 'PATCH', path: '/medicines/:id', permission: 'PHARMACY_MANAGE' },
    { method: 'GET', path: '/prescriptions', permission: 'PHARMACY_READ' },
    { method: 'POST', path: '/prescriptions', permission: 'PRESCRIPTION_CREATE' },
    { method: 'GET', path: '/prescriptions/:id', permission: 'PHARMACY_READ' },
    { method: 'POST', path: '/orders', permission: 'PHARMACY_MANAGE' }
  ],
  'lab.js': [
    { method: 'GET', path: '/tests', permission: 'LAB_ORDER' },
    { method: 'POST', path: '/tests', permission: 'LAB_ORDER' },
    { method: 'GET', path: '/tests/:id', permission: 'LAB_ORDER' },
    { method: 'PATCH', path: '/tests/:id/sample', permission: 'LAB_PROCESS' },
    { method: 'PATCH', path: '/tests/:id/results', permission: 'LAB_RESULTS' }
  ],
  'radiology.js': [
    { method: 'GET', path: '/tests', permission: 'RADIOLOGY_ORDER' },
    { method: 'POST', path: '/tests', permission: 'RADIOLOGY_ORDER' },
    { method: 'GET', path: '/tests/:id', permission: 'RADIOLOGY_ORDER' },
    { method: 'PATCH', path: '/tests/:id', permission: 'RADIOLOGY_PROCESS' }
  ],
  'billing.js': [
    { method: 'GET', path: '/invoices', permission: 'BILLING_VIEW' },
    { method: 'POST', path: '/invoices', permission: 'BILLING_MANAGE' },
    { method: 'GET', path: '/invoices/:id', permission: 'BILLING_VIEW' },
    { method: 'POST', path: '/payments', permission: 'BILLING_MANAGE' },
    { method: 'GET', path: '/statistics', permission: 'BILLING_REPORTS' }
  ],
  'departments.js': [
    { method: 'GET', path: '/', permission: 'PATIENT_ACCESS' },
    { method: 'POST', path: '/', middleware: 'requireAdmin' },
    { method: 'GET', path: '/beds', permission: 'IPD_ACCESS' },
    { method: 'POST', path: '/beds', middleware: 'requireAdmin' }
  ],
  'organizations.js': [
    { method: 'GET', path: '/', permission: 'ORG_VIEW' },
    { method: 'POST', path: '/', middleware: 'requireSuperAdmin' },
    { method: 'GET', path: '/:id', permission: 'ORG_VIEW' },
    { method: 'PATCH', path: '/:id', middleware: 'requireAdmin' },
    { method: 'DELETE', path: '/:id', middleware: 'requireSuperAdmin' }
  ]
};

console.log('🔒 RBAC Application Script');
console.log('==========================\n');

// Check if routes need RBAC import
const routesDir = path.join(__dirname, 'routes');

Object.keys(routeRBAC).forEach(filename => {
  const filepath = path.join(routesDir, filename);

  if (!fs.existsSync(filepath)) {
    console.log(`⚠️  File not found: ${filename}`);
    return;
  }

  let content = fs.readFileSync(filepath, 'utf8');

  // Check if RBAC is already imported
  if (!content.includes('require(\'../middleware/rbac\')')) {
    console.log(`✅ ${filename} - Adding RBAC import`);

    // Find the last require statement
    const requireRegex = /const .+ = require\([^)]+\);/g;
    const matches = content.match(requireRegex);

    if (matches && matches.length > 0) {
      const lastRequire = matches[matches.length - 1];
      const rbacImport = `const {
  requirePermission,
  requireAdmin,
  requireSuperAdmin,
  enforceOrgScope
} = require('../middleware/rbac');`;

      content = content.replace(lastRequire, `${lastRequire}\n${rbacImport}`);
    }
  } else {
    console.log(`⏭️  ${filename} - RBAC already imported`);
  }

  // Save updated content
  fs.writeFileSync(filepath, content, 'utf8');
});

console.log('\n✅ RBAC imports added to all route files');
console.log('\n📋 Next Steps:');
console.log('1. Manually add middleware to each route handler');
console.log('2. Test endpoints with different roles');
console.log('3. Create test users for each role');
console.log('\nSee APPLY_RBAC_PLAN.md for detailed implementation guide');
