# RBAC Implementation Plan

## Current Status
- ✅ RBAC middleware created (`middleware/rbac.js`)
- ✅ Permissions matrix defined (`RBAC_DESIGN.md`)
- ⏳ Need to apply RBAC to all route files

## Route Files to Update

### 1. `/routes/patients.js`
**Endpoints:**
- `GET /` - List patients → PATIENT_ACCESS
- `POST /` - Create patient → PATIENT_WRITE
- `GET /:id` - Get patient → PATIENT_ACCESS
- `GET /code/:code` - Get by code → PATIENT_ACCESS
- `PATCH /:id` - Update patient → PATIENT_WRITE
- `DELETE /:id` - Delete patient → ADMINS only
- `GET /:id/history` - Patient history → PATIENT_ACCESS

### 2. `/routes/opd.js`
**Endpoints:**
- `GET /tokens` - List tokens → OPD_ACCESS
- `POST /tokens` - Create token → OPD_ACCESS
- `GET /queue` - Queue status → OPD_ACCESS
- `POST /call-next` - Call next → MEDICAL_STAFF
- `POST /complete` - Complete → OPD_CONSULTATION

### 3. `/routes/appointments.js`
**Endpoints:**
- `GET /` - List appointments → OPD_ACCESS
- `POST /` - Create appointment → OPD_ACCESS
- `GET /:id` - Get appointment → OPD_ACCESS
- `PATCH /:id/confirm` - Confirm → OPD_ACCESS
- `DELETE /:id` - Cancel → ADMINS + Doctor

### 4. `/routes/ipd.js`
**Endpoints:**
- `GET /admissions` - List → IPD_ACCESS
- `POST /admissions` - Admit → IPD_ACCESS
- `GET /admissions/:id` - Get → IPD_ACCESS
- `PATCH /admissions/:id` - Update → IPD_ACCESS
- `POST /discharge` - Discharge → IPD_DISCHARGE

### 5. `/routes/pharmacy.js`
**Endpoints:**
- `GET /medicines` - List → PHARMACY_READ
- `POST /medicines` - Create → PHARMACY_MANAGE
- `GET /medicines/:id` - Get → PHARMACY_READ
- `PATCH /medicines/:id` - Update → PHARMACY_MANAGE
- `GET /prescriptions` - List → PHARMACY_READ
- `POST /prescriptions` - Create → PRESCRIPTION_CREATE
- `POST /orders` - Create order → PHARMACY_MANAGE

### 6. `/routes/lab.js`
**Endpoints:**
- `GET /tests` - List → LAB_ORDER
- `POST /tests` - Create → LAB_ORDER
- `PATCH /tests/:id/sample` - Collect sample → LAB_PROCESS
- `PATCH /tests/:id/results` - Add results → LAB_RESULTS

### 7. `/routes/radiology.js`
**Endpoints:**
- `GET /tests` - List → RADIOLOGY_ORDER
- `POST /tests` - Create → RADIOLOGY_ORDER
- `PATCH /tests/:id` - Update → RADIOLOGY_PROCESS

### 8. `/routes/billing.js`
**Endpoints:**
- `GET /invoices` - List → BILLING_VIEW
- `POST /invoices` - Create → BILLING_MANAGE
- `POST /payments` - Create payment → BILLING_MANAGE
- `GET /statistics` → BILLING_REPORTS

### 9. `/routes/departments.js`
**Endpoints:**
- `GET /` - List → ALL staff
- `POST /` - Create → ADMINS only
- `GET /beds` - List beds → IPD_ACCESS

### 10. `/routes/organizations.js`
**Endpoints:**
- `GET /` - List → ORG_VIEW
- `POST /` - Create → SUPER_ADMIN only
- `GET /:id` - Get → ORG_VIEW (own org only)
- `PATCH /:id` - Update → ADMINS (own org only)

## Implementation Approach

For each route file:

1. **Add RBAC import** at top:
```javascript
const {
  requirePermission,
  requireRoleWithOrgScope,
  requireSuperAdmin,
  requireAdmin,
  enforceOrgScope
} = require('../middleware/rbac');
```

2. **Apply middleware to routes**:
```javascript
// Before (no RBAC)
router.get('/', authenticateToken, async (req, res) => {

// After (with RBAC)
router.get('/', authenticateToken, requirePermission('PATIENT_ACCESS'), enforceOrgScope(), async (req, res) => {
```

3. **Remove duplicate orgId logic** (enforceOrgScope handles it)

4. **Test each endpoint** with different roles

## Frontend RBAC Requirements

### User Creation/Management
1. Add user management routes to backend:
   - `POST /api/users` - Create user with role
   - `GET /api/users` - List users in organization
   - `PATCH /api/users/:id/role` - Update user role
   - Only ADMINS can manage users

2. Frontend user creation form:
   - Role dropdown (filtered by logged-in user's permissions)
   - HospitalAdmin can create: Doctor, Nurse, Receptionist, etc.
   - SuperAdmin can create: HospitalAdmin + all other roles

### UI Visibility Control
1. Create React hook: `usePermissions()`
2. Check user role from JWT/context
3. Hide/show menu items based on role
4. Disable buttons/features user can't access

### Example Frontend Components Needed:
- `<ProtectedRoute allowedRoles={['Doctor', 'Nurse']} />`
- `<RequirePermission permission="PATIENT_WRITE">...</RequirePermission>`
- `useHasPermission('BILLING_MANAGE')` hook

## Priority Order

1. ✅ Backend RBAC middleware (DONE)
2. ⏳ Apply RBAC to critical routes (patients, billing, pharmacy)
3. ⏳ Create user management API
4. ⏳ Test backend RBAC thoroughly
5. ⏳ Frontend RBAC implementation
6. ⏳ End-to-end testing

## Next Immediate Steps

1. Create user management routes
2. Apply RBAC to 3 most critical route files
3. Create test users with different roles
4. Test access control manually
5. Then tackle frontend RBAC
