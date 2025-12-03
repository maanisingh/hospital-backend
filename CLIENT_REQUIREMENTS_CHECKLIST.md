# Client Requirements Checklist - Nalini Paras
## Based on Client Meeting Transcript

---

## ✅ Backend Requirements (Status)

### 1. Super Admin Features
- [x] **Hospital Management**
  - [x] Add new hospitals
  - [x] View all hospitals
  - [x] Edit hospital details
  - [x] Hospital activation/deactivation
  - [ ] **MISSING:** Hospital fields from file (need to review what fields are required)

- [x] **Subscription Plan Management**
  - [x] Create subscription plans (₹99, ₹1000, etc.)
  - [x] Dynamic plan creation
  - [x] Plans visible on website (already in API)
  - [ ] **NOTE:** Client wants MANUAL payment, not auto-subscription
  - [ ] **ACTION NEEDED:** Remove auto-subscription, keep manual payment tracking

- [x] **User Limits & Billing**
  - [x] Set user limits per hospital
  - [ ] **MISSING:** Track when hospital exceeds user limit
  - [ ] **MISSING:** Manual billing/payment tracking for extra users
  - [ ] **MISSING:** Validity/expiry date management

- [ ] **Settings Management**
  - [ ] WhatsApp API configuration
  - [ ] SMS Key configuration
  - [ ] Payment Gateway settings
  - [x] Payment history/records

- [x] **RBAC - What SuperAdmin SHOULD NOT DO**
  - [x] ✅ Cannot add doctors (hospital does this)
  - [x] ✅ Cannot add hospital staff (hospital does this)
  - [x] ✅ Only manages: hospitals, plans, billing

### 2. Hospital Admin Features
- [x] **Staff Management** (Role-Based)
  - [x] Add doctors
  - [x] Add nurses
  - [x] Add receptionist
  - [x] Add pharmacist
  - [x] Add lab technician
  - [x] Add radiologist
  - [x] Add billing staff
  - [x] User limit checking (backend)
  - [ ] **FRONTEND:** User limit warning UI

- [x] **Department Management**
  - [ ] **MISSING:** Master data for departments (10 fixed departments)
  - [ ] **MISSING:** Hospital selects which departments to enable
  - [x] Current: Hospital creates custom departments (needs to change?)

- [x] **Patient Management**
  - [x] Add patients
  - [x] Patient registration
  - [x] OPD token generation
  - [x] IPD admission

- [x] **Operational Features**
  - [x] OPD management
  - [x] IPD management
  - [x] Billing
  - [x] Pharmacy
  - [x] Lab tests
  - [x] Radiology

### 3. Data Isolation
- [x] ✅ SuperAdmin can access any hospital (with orgId)
- [x] ✅ Hospital admin can ONLY access their hospital
- [x] ✅ Staff can ONLY access their hospital
- [x] ✅ No cross-hospital data leaks

---

## ⏳ Frontend Requirements (Critical Missing)

### 1. Login Page Design
- [ ] **URGENT:** Redesign login page
  - [ ] Logo at top
  - [ ] Footer description
  - [ ] Right side: Login form
  - [ ] Left side: Image
  - [ ] 60-40 ratio (image:login)

### 2. SuperAdmin Dashboard
- [ ] **Hospital Management UI**
  - [ ] Add Hospital form with all required fields (from client file)
  - [ ] View All Hospitals table
  - [ ] Edit Hospital
  - [ ] Hospital status toggle (active/inactive)
  - [ ] Hospital details view

- [ ] **Subscription Plans UI**
  - [ ] Create Plan form (name, price, features, duration)
  - [ ] List Plans table
  - [ ] Edit Plan
  - [ ] Delete Plan
  - [ ] **NOTE:** Mark as "manual billing" not auto-subscription

- [ ] **Payment/Billing Tracking**
  - [ ] Manual payment entry form
  - [ ] Payment history per hospital
  - [ ] User limit tracking per hospital
  - [ ] Validity/expiry date display
  - [ ] Billing alerts when limit exceeded

- [ ] **Settings Page**
  - [ ] WhatsApp API configuration form
  - [ ] SMS Key configuration form
  - [ ] Payment Gateway settings form

### 3. Hospital Admin Dashboard
- [ ] **User Management UI**
  - [ ] Add User form with role selection
  - [ ] User limit warning (e.g., "5/10 users used")
  - [ ] List Users table (filtered by hospital)
  - [ ] Edit User
  - [ ] Deactivate User

- [ ] **Department Selection UI**
  - [ ] Master list of 10 departments (checkbox)
  - [ ] Hospital selects which to enable
  - [ ] Enabled departments show in system

- [ ] **Staff Dashboard**
  - [ ] Lightweight interface
  - [ ] Role-specific menu items (using RBAC)
  - [ ] Only show features they have permission for

### 4. RBAC in Frontend
- [ ] **Menu Filtering**
  - [ ] SuperAdmin sees: Hospitals, Plans, Billing, Settings
  - [ ] HospitalAdmin sees: Users, Patients, Departments, OPD, IPD, etc.
  - [ ] Doctor sees: Patients, OPD, IPD, Prescriptions
  - [ ] Nurse sees: Patients, OPD, IPD
  - [ ] Receptionist sees: Patients, Appointments, OPD
  - [ ] Pharmacist sees: Pharmacy only
  - [ ] LabTech sees: Lab only
  - [ ] Radiologist sees: Radiology only
  - [ ] Billing sees: Billing only

- [ ] **Component-Level Protection**
  - [ ] Hide "Add" buttons if user lacks permission
  - [ ] Hide "Edit" buttons if user lacks permission
  - [ ] Hide "Delete" buttons if user lacks permission
  - [ ] Show appropriate error if accessing unauthorized page

---

## 🔴 Critical Missing Items

### Backend
1. **Master Department Data** - Need to create fixed list of 10 departments
2. **User Limit Tracking** - Need to track and enforce user limits per hospital
3. **Manual Payment Tracking** - Need payment entry system for SuperAdmin
4. **Validity/Expiry Management** - Need subscription expiry tracking
5. **Settings API** - Need endpoints for WhatsApp, SMS, Payment Gateway config

### Frontend (Everything)
1. **Login Page Redesign** - Current login page doesn't match requirements
2. **SuperAdmin UI** - Need complete SuperAdmin interface
3. **Hospital Management UI** - Add/Edit/View hospitals
4. **Subscription Plans UI** - Plan management interface
5. **Manual Billing UI** - Payment tracking interface
6. **User Management UI** - Add users with role selection
7. **Department Selection UI** - Enable/disable departments
8. **RBAC Menu Filtering** - Hide/show menu based on role
9. **User Limit Warnings** - Show when approaching limit
10. **Settings UI** - WhatsApp, SMS, Payment Gateway config

---

## 📊 Implementation Priority

### Phase 1: Critical (Do First)
1. ✅ Backend RBAC (DONE)
2. ⏳ Master Department Data
3. ⏳ User Limit Tracking Backend
4. ⏳ Frontend RBAC (menu filtering)
5. ⏳ Login Page Redesign
6. ⏳ SuperAdmin: Hospital Management UI
7. ⏳ HospitalAdmin: User Management UI

### Phase 2: Important (Do Next)
1. ⏳ Subscription Plans UI
2. ⏳ Manual Payment/Billing UI
3. ⏳ Department Selection UI
4. ⏳ User Limit Warnings
5. ⏳ Settings UI (WhatsApp, SMS, Payment)

### Phase 3: Nice to Have (Do Later)
1. ⏳ Advanced reporting
2. ⏳ Analytics
3. ⏳ Automated notifications

---

## 🎯 What's Complete vs What's Missing

### ✅ Complete (Ready)
- Backend API for all modules (OPD, IPD, Pharmacy, Lab, Radiology, Billing)
- Backend RBAC (52 endpoints protected)
- User Management API
- Organization/Hospital API
- 100% test coverage (53/53 tests)
- 9 user roles with permissions
- Database schema

### ❌ Missing (Need to Build)
- **90% of Frontend UI** (only basic pages exist)
- SuperAdmin dashboard
- Hospital management UI
- Subscription plans UI
- User management UI (frontend)
- Department master data & selection UI
- User limit tracking & warnings
- Manual billing interface
- Settings configuration UI
- Login page redesign (60-40 layout)
- RBAC-based menu filtering

---

## 📝 Next Steps

1. **Immediate:**
   - Create master department data
   - Add user limit tracking to backend
   - Redesign login page

2. **Short Term:**
   - Build SuperAdmin dashboard
   - Build Hospital Management UI
   - Build User Management UI
   - Implement RBAC menu filtering

3. **Medium Term:**
   - Build Subscription Plans UI
   - Build Manual Billing UI
   - Build Settings UI
   - Add department selection feature

---

## ⚠️ Important Notes from Client

1. **NO AUTO-SUBSCRIPTION** - Client wants manual payment tracking only
2. **SuperAdmin CANNOT add hospital staff** - Only hospital can add their own staff
3. **Lightweight interface** - Keep it simple for hospital staff
4. **60-40 login page** - Left side image (60%), right side form (40%)
5. **Master departments** - 10 fixed departments, hospital enables what they need
6. **User limits** - Track and warn when exceeded, manual billing for extras

---

*Generated based on client meeting transcript*
*Date: December 3, 2025*
