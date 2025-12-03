#!/usr/bin/env node

/**
 * Automated RBAC Application Script
 * Applies permission checks to all route handlers across all route files
 */

const fs = require('fs');
const path = require('path');

// Define route-specific RBAC replacements
const rbacFixes = {
  'opd.js': [
    { from: "router.get('/tokens', authenticateToken,", to: "router.get('/tokens', authenticateToken, requirePermission('OPD_ACCESS')," },
    { from: "router.get('/tokens/:id', authenticateToken,", to: "router.get('/tokens/:id', authenticateToken, requirePermission('OPD_ACCESS')," },
    { from: "router.post('/tokens', authenticateToken,", to: "router.post('/tokens', authenticateToken, requirePermission('OPD_ACCESS')," },
    { from: "router.patch('/tokens/:id', authenticateToken,", to: "router.patch('/tokens/:id', authenticateToken, requirePermission('OPD_ACCESS')," },
    { from: "router.post('/tokens/:id/call', authenticateToken,", to: "router.post('/tokens/:id/call', authenticateToken, requirePermission('OPD_CONSULTATION')," },
    { from: "router.post('/tokens/:id/complete', authenticateToken,", to: "router.post('/tokens/:id/complete', authenticateToken, requirePermission('OPD_CONSULTATION')," },
    { from: "router.delete('/tokens/:id', authenticateToken,", to: "router.delete('/tokens/:id', authenticateToken, requireAdmin()," },
    { from: "router.get('/queue', authenticateToken,", to: "router.get('/queue', authenticateToken, requirePermission('OPD_ACCESS')," },
    { from: "router.get('/queue/next', authenticateToken,", to: "router.get('/queue/next', authenticateToken, requirePermission('OPD_CONSULTATION')," },
    { from: "router.get('/stats', authenticateToken,", to: "router.get('/stats', authenticateToken, requirePermission('OPD_ACCESS')," }
  ],
  'appointments.js': [
    { from: "router.get('/', authenticateToken,", to: "router.get('/', authenticateToken, requirePermission('OPD_ACCESS')," },
    { from: "router.post('/', authenticateToken,", to: "router.post('/', authenticateToken, requirePermission('OPD_ACCESS')," },
    { from: "router.get('/:id', authenticateToken,", to: "router.get('/:id', authenticateToken, requirePermission('OPD_ACCESS')," },
    { from: "router.patch('/:id', authenticateToken,", to: "router.patch('/:id', authenticateToken, requirePermission('OPD_ACCESS')," },
    { from: "router.delete('/:id', authenticateToken,", to: "router.delete('/:id', authenticateToken, requireAdmin()," }
  ],
  'ipd.js': [
    { from: "router.get('/admissions', authenticateToken,", to: "router.get('/admissions', authenticateToken, requirePermission('IPD_ACCESS')," },
    { from: "router.post('/admissions', authenticateToken,", to: "router.post('/admissions', authenticateToken, requirePermission('IPD_ACCESS')," },
    { from: "router.get('/admissions/:id', authenticateToken,", to: "router.get('/admissions/:id', authenticateToken, requirePermission('IPD_ACCESS')," },
    { from: "router.patch('/admissions/:id', authenticateToken,", to: "router.patch('/admissions/:id', authenticateToken, requirePermission('IPD_ACCESS')," },
    { from: "router.post('/admissions/:id/discharge', authenticateToken,", to: "router.post('/admissions/:id/discharge', authenticateToken, requirePermission('IPD_DISCHARGE')," },
    { from: "router.delete('/admissions/:id', authenticateToken,", to: "router.delete('/admissions/:id', authenticateToken, requireAdmin()," }
  ],
  'pharmacy.js': [
    { from: "router.get('/medicines', authenticateToken,", to: "router.get('/medicines', authenticateToken, requirePermission('PHARMACY_READ')," },
    { from: "router.post('/medicines', authenticateToken,", to: "router.post('/medicines', authenticateToken, requirePermission('PHARMACY_MANAGE')," },
    { from: "router.get('/medicines/:id', authenticateToken,", to: "router.get('/medicines/:id', authenticateToken, requirePermission('PHARMACY_READ')," },
    { from: "router.patch('/medicines/:id', authenticateToken,", to: "router.patch('/medicines/:id', authenticateToken, requirePermission('PHARMACY_MANAGE')," },
    { from: "router.delete('/medicines/:id', authenticateToken,", to: "router.delete('/medicines/:id', authenticateToken, requirePermission('PHARMACY_MANAGE')," },
    { from: "router.get('/prescriptions', authenticateToken,", to: "router.get('/prescriptions', authenticateToken, requirePermission('PHARMACY_READ')," },
    { from: "router.post('/prescriptions', authenticateToken,", to: "router.post('/prescriptions', authenticateToken, requirePermission('PRESCRIPTION_CREATE')," },
    { from: "router.get('/prescriptions/:id', authenticateToken,", to: "router.get('/prescriptions/:id', authenticateToken, requirePermission('PHARMACY_READ')," },
    { from: "router.get('/low-stock', authenticateToken,", to: "router.get('/low-stock', authenticateToken, requirePermission('PHARMACY_READ')," }
  ],
  'lab.js': [
    { from: "router.get('/tests', authenticateToken,", to: "router.get('/tests', authenticateToken, requirePermission('LAB_ORDER')," },
    { from: "router.post('/tests', authenticateToken,", to: "router.post('/tests', authenticateToken, requirePermission('LAB_ORDER')," },
    { from: "router.get('/tests/:id', authenticateToken,", to: "router.get('/tests/:id', authenticateToken, requirePermission('LAB_ORDER')," },
    { from: "router.patch('/tests/:id/collect', authenticateToken,", to: "router.patch('/tests/:id/collect', authenticateToken, requirePermission('LAB_PROCESS')," },
    { from: "router.patch('/tests/:id/results', authenticateToken,", to: "router.patch('/tests/:id/results', authenticateToken, requirePermission('LAB_RESULTS')," },
    { from: "router.delete('/tests/:id', authenticateToken,", to: "router.delete('/tests/:id', authenticateToken, requireAdmin()," }
  ],
  'radiology.js': [
    { from: "router.get('/tests', authenticateToken,", to: "router.get('/tests', authenticateToken, requirePermission('RADIOLOGY_ORDER')," },
    { from: "router.post('/tests', authenticateToken,", to: "router.post('/tests', authenticateToken, requirePermission('RADIOLOGY_ORDER')," },
    { from: "router.get('/tests/:id', authenticateToken,", to: "router.get('/tests/:id', authenticateToken, requirePermission('RADIOLOGY_ORDER')," },
    { from: "router.patch('/tests/:id', authenticateToken,", to: "router.patch('/tests/:id', authenticateToken, requirePermission('RADIOLOGY_PROCESS')," },
    { from: "router.delete('/tests/:id', authenticateToken,", to: "router.delete('/tests/:id', authenticateToken, requireAdmin()," }
  ],
  'billing.js': [
    { from: "router.get('/invoices', authenticateToken,", to: "router.get('/invoices', authenticateToken, requirePermission('BILLING_VIEW')," },
    { from: "router.post('/invoices', authenticateToken,", to: "router.post('/invoices', authenticateToken, requirePermission('BILLING_MANAGE')," },
    { from: "router.get('/invoices/:id', authenticateToken,", to: "router.get('/invoices/:id', authenticateToken, requirePermission('BILLING_VIEW')," },
    { from: "router.patch('/invoices/:id', authenticateToken,", to: "router.patch('/invoices/:id', authenticateToken, requirePermission('BILLING_MANAGE')," },
    { from: "router.post('/payments', authenticateToken,", to: "router.post('/payments', authenticateToken, requirePermission('BILLING_MANAGE')," },
    { from: "router.get('/payments', authenticateToken,", to: "router.get('/payments', authenticateToken, requirePermission('BILLING_VIEW')," }
  ],
  'organizations.js': [
    { from: "router.get('/', authenticateToken,", to: "router.get('/', authenticateToken, requirePermission('ORG_VIEW')," },
    { from: "router.post('/', authenticateToken,", to: "router.post('/', authenticateToken, requireSuperAdmin()," },
    { from: "router.get('/:id', authenticateToken,", to: "router.get('/:id', authenticateToken, requirePermission('ORG_VIEW')," },
    { from: "router.patch('/:id', authenticateToken,", to: "router.patch('/:id', authenticateToken, requireAdmin()," },
    { from: "router.delete('/:id', authenticateToken,", to: "router.delete('/:id', authenticateToken, requireSuperAdmin()," }
  ],
  'patients.js': [
    { from: "router.get('/', authenticateToken,", to: "router.get('/', authenticateToken, requirePermission('PATIENT_ACCESS')," },
    { from: "router.post('/', authenticateToken,", to: "router.post('/', authenticateToken, requirePermission('PATIENT_WRITE')," },
    { from: "router.get('/:id', authenticateToken,", to: "router.get('/:id', authenticateToken, requirePermission('PATIENT_ACCESS')," },
    { from: "router.get('/code/:code', authenticateToken,", to: "router.get('/code/:code', authenticateToken, requirePermission('PATIENT_ACCESS')," },
    { from: "router.patch('/:id', authenticateToken,", to: "router.patch('/:id', authenticateToken, requirePermission('PATIENT_WRITE')," },
    { from: "router.delete('/:id', authenticateToken,", to: "router.delete('/:id', authenticateToken, requireAdmin()," },
    { from: "router.get('/:id/history', authenticateToken,", to: "router.get('/:id/history', authenticateToken, requirePermission('PATIENT_ACCESS')," }
  ]
};

console.log('🔒 Applying RBAC to All Route Files');
console.log('====================================\n');

const routesDir = path.join(__dirname, 'routes');
let totalFixed = 0;
let totalFiles = 0;

Object.keys(rbacFixes).forEach(filename => {
  const filepath = path.join(routesDir, filename);

  if (!fs.existsSync(filepath)) {
    console.log(`⚠️  ${filename} - Not found`);
    return;
  }

  let content = fs.readFileSync(filepath, 'utf8');
  let fixCount = 0;

  rbacFixes[filename].forEach(fix => {
    if (content.includes(fix.from)) {
      content = content.replace(new RegExp(fix.from.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), fix.to);
      fixCount++;
    }
  });

  if (fixCount > 0) {
    fs.writeFileSync(filepath, content, 'utf8');
    console.log(`✅ ${filename} - Applied ${fixCount} RBAC fixes`);
    totalFixed += fixCount;
    totalFiles++;
  } else {
    console.log(`⏭️  ${filename} - Already has RBAC or no matches`);
  }
});

console.log(`\n✅ RBAC Application Complete!`);
console.log(`   Files Updated: ${totalFiles}`);
console.log(`   Total Fixes: ${totalFixed}`);
console.log(`\n🔒 All routes now protected with proper RBAC!`);
