# Hospital SaaS - RBAC (Role-Based Access Control) Design

## User Roles

Based on the schema and typical hospital operations, we define the following roles:

### 1. SuperAdmin
- **Scope:** System-wide access
- **Purpose:** Platform administrator, manages all organizations
- **Access:** ALL endpoints across ALL organizations

### 2. HospitalAdmin
- **Scope:** Single organization (hospital/clinic)
- **Purpose:** Hospital owner/manager
- **Access:** Full access to their organization's data

### 3. Doctor
- **Scope:** Single organization
- **Purpose:** Medical professional
- **Access:** Patients, OPD, IPD, Prescriptions, Lab orders, Radiology orders

### 4. Nurse
- **Scope:** Single organization
- **Purpose:** Nursing staff
- **Access:** Patients (read/update), OPD queue, IPD management, Lab samples

### 5. Receptionist
- **Scope:** Single organization
- **Purpose:** Front desk operations
- **Access:** Appointments, OPD tokens, Patient registration, Billing (view only)

### 6. Pharmacist
- **Scope:** Single organization
- **Purpose:** Pharmacy operations
- **Access:** Medicines, Prescriptions, Pharmacy orders

### 7. LabTechnician
- **Scope:** Single organization
- **Purpose:** Laboratory operations
- **Access:** Lab tests (processing), Lab results entry

### 8. Radiologist
- **Scope:** Single organization
- **Purpose:** Radiology operations
- **Access:** Radiology tests, Imaging results

### 9. Billing
- **Scope:** Single organization
- **Purpose:** Billing and accounts
- **Access:** Invoices, Payments, Billing reports

---

## Permissions Matrix

### Authentication Endpoints
| Endpoint | SuperAdmin | HospitalAdmin | Doctor | Nurse | Receptionist | Pharmacist | LabTech | Radiologist | Billing |
|----------|-----------|---------------|--------|-------|--------------|------------|---------|-------------|---------|
| POST /auth/login | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| GET /auth/me | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| POST /auth/logout | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |

### Organization Management
| Endpoint | SuperAdmin | HospitalAdmin | Others |
|----------|-----------|---------------|--------|
| GET /api/organizations | ✅ | ✅ (own only) | ❌ |
| POST /api/organizations | ✅ | ❌ | ❌ |
| GET /api/organizations/:id | ✅ | ✅ (own only) | ❌ |
| PATCH /api/organizations/:id | ✅ | ✅ (own only) | ❌ |
| DELETE /api/organizations/:id | ✅ | ❌ | ❌ |

### Patient Management
| Endpoint | SuperAdmin | HospitalAdmin | Doctor | Nurse | Receptionist | Others |
|----------|-----------|---------------|--------|-------|--------------|--------|
| GET /api/patients | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ |
| POST /api/patients | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ |
| GET /api/patients/:id | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ |
| PATCH /api/patients/:id | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ |
| DELETE /api/patients/:id | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |

### OPD (Outpatient Department)
| Endpoint | SuperAdmin | HospitalAdmin | Doctor | Nurse | Receptionist | Others |
|----------|-----------|---------------|--------|-------|--------------|--------|
| GET /api/opd/tokens | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ |
| POST /api/opd/tokens | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ |
| GET /api/opd/queue | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ |
| POST /api/opd/call-next | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ |
| POST /api/opd/complete | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ |

### Appointments
| Endpoint | SuperAdmin | HospitalAdmin | Doctor | Nurse | Receptionist | Others |
|----------|-----------|---------------|--------|-------|--------------|--------|
| GET /api/appointments | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ |
| POST /api/appointments | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ |
| PATCH /api/appointments/:id | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ |
| DELETE /api/appointments/:id | ✅ | ✅ | ✅ | ❌ | ✅ | ❌ |

### IPD (Inpatient Department)
| Endpoint | SuperAdmin | HospitalAdmin | Doctor | Nurse | Others |
|----------|-----------|---------------|--------|-------|--------|
| GET /api/ipd/admissions | ✅ | ✅ | ✅ | ✅ | ❌ |
| POST /api/ipd/admissions | ✅ | ✅ | ✅ | ✅ | ❌ |
| PATCH /api/ipd/admissions/:id | ✅ | ✅ | ✅ | ✅ | ❌ |
| POST /api/ipd/discharge | ✅ | ✅ | ✅ | ❌ | ❌ |

### Pharmacy
| Endpoint | SuperAdmin | HospitalAdmin | Doctor | Pharmacist | Others |
|----------|-----------|---------------|--------|------------|--------|
| GET /api/pharmacy/medicines | ✅ | ✅ | ✅ | ✅ | ❌ |
| POST /api/pharmacy/medicines | ✅ | ✅ | ❌ | ✅ | ❌ |
| PATCH /api/pharmacy/medicines/:id | ✅ | ✅ | ❌ | ✅ | ❌ |
| GET /api/pharmacy/prescriptions | ✅ | ✅ | ✅ | ✅ | ❌ |
| POST /api/pharmacy/prescriptions | ✅ | ✅ | ✅ | ❌ | ❌ |
| POST /api/pharmacy/orders | ✅ | ✅ | ❌ | ✅ | ❌ |

### Lab Tests
| Endpoint | SuperAdmin | HospitalAdmin | Doctor | Nurse | LabTech | Others |
|----------|-----------|---------------|--------|-------|---------|--------|
| GET /api/lab/tests | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ |
| POST /api/lab/tests | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ |
| PATCH /api/lab/tests/:id/sample | ✅ | ✅ | ❌ | ✅ | ✅ | ❌ |
| PATCH /api/lab/tests/:id/results | ✅ | ✅ | ❌ | ❌ | ✅ | ❌ |

### Radiology
| Endpoint | SuperAdmin | HospitalAdmin | Doctor | Radiologist | Others |
|----------|-----------|---------------|--------|-------------|--------|
| GET /api/radiology/tests | ✅ | ✅ | ✅ | ✅ | ❌ |
| POST /api/radiology/tests | ✅ | ✅ | ✅ | ❌ | ❌ |
| PATCH /api/radiology/tests/:id | ✅ | ✅ | ❌ | ✅ | ❌ |

### Billing
| Endpoint | SuperAdmin | HospitalAdmin | Doctor | Receptionist | Billing | Others |
|----------|-----------|---------------|--------|--------------|---------|--------|
| GET /api/billing/invoices | ✅ | ✅ | ✅ (view) | ✅ | ✅ | ❌ |
| POST /api/billing/invoices | ✅ | ✅ | ❌ | ✅ | ✅ | ❌ |
| POST /api/billing/payments | ✅ | ✅ | ❌ | ✅ | ✅ | ❌ |
| GET /api/billing/statistics | ✅ | ✅ | ❌ | ❌ | ✅ | ❌ |

### Dashboard & Reports
| Endpoint | SuperAdmin | HospitalAdmin | Doctor | Others |
|----------|-----------|---------------|--------|--------|
| GET /api/stats/dashboard | ✅ | ✅ | ✅ | ❌ |
| GET /api/departments | ✅ | ✅ | ✅ | ❌ |

---

## RBAC Implementation Strategy

### Phase 1: Create Middleware
1. Create `middleware/rbac.js` with role checking functions
2. Define permission groups (e.g., MEDICAL_STAFF, ADMIN_STAFF)
3. Create utility functions for role validation

### Phase 2: Apply to Routes
1. Update all route files with RBAC middleware
2. Apply appropriate role checks before handlers
3. Ensure orgId scoping for non-SuperAdmin roles

### Phase 3: Testing
1. Create test users for each role
2. Test each endpoint with each role
3. Verify access denied for unauthorized roles
4. Verify data scoping (can only see own org data)

### Phase 4: Documentation
1. Update API documentation with role requirements
2. Create role setup guide for hospital admins
3. Document permission groups

---

## Role Assignment Guidelines

### Default Roles by Position
- **Hospital Owner/Manager** → HospitalAdmin
- **Chief Medical Officer** → Doctor + elevated permissions
- **General Practitioner** → Doctor
- **Nursing Staff** → Nurse
- **Front Desk** → Receptionist
- **Pharmacy Manager** → Pharmacist
- **Lab Manager** → LabTechnician
- **Imaging Specialist** → Radiologist
- **Accountant** → Billing

### Role Hierarchy
```
SuperAdmin (Platform Level)
    └── HospitalAdmin (Organization Level)
            ├── Doctor (Clinical)
            ├── Nurse (Clinical Support)
            ├── Pharmacist (Pharmacy)
            ├── LabTechnician (Lab)
            ├── Radiologist (Imaging)
            ├── Receptionist (Administrative)
            └── Billing (Finance)
```

---

## Security Considerations

1. **OrgId Scoping:** All non-SuperAdmin users can only access data from their organization
2. **Token Validation:** JWT must contain valid user role
3. **Role Verification:** Check role on every request (no client-side only checks)
4. **Audit Logging:** Log all role-based denials for security monitoring
5. **Least Privilege:** Users get minimum permissions needed for their job

---

## Next Steps

1. ✅ Define roles and permissions (this document)
2. ⏳ Create RBAC middleware
3. ⏳ Apply RBAC to all routes
4. ⏳ Create test users for each role
5. ⏳ Test all endpoints with all roles
6. ⏳ Update API documentation
7. ⏳ Create role management UI (future)
