# Hospital SaaS Backend - Complete API Documentation

**Version:** 1.0
**Base URL:** `https://hospital-api.alexandratechlab.com`
**Date:** December 2, 2025

---

## Table of Contents

1. [Overview](#overview)
2. [Authentication](#authentication)
3. [Common Patterns](#common-patterns)
4. [Error Handling](#error-handling)
5. [API Endpoints](#api-endpoints)
   - [Authentication & User Management](#authentication--user-management)
   - [Organization Management](#organization-management)
   - [Patient Management](#patient-management)
   - [Department & Bed Management](#department--bed-management)
   - [OPD Module](#opd-module)
   - [IPD Module](#ipd-module)
   - [Appointments](#appointments)
   - [Billing Module](#billing-module)
   - [Lab Module](#lab-module)
   - [Radiology Module](#radiology-module)
   - [Pharmacy Module](#pharmacy-module)
   - [Subscription Plans](#subscription-plans)
   - [Promotions](#promotions)
   - [Surgical History](#surgical-history)
   - [Payment History](#payment-history)
   - [Dashboard Statistics](#dashboard-statistics)

---

## Overview

The Hospital SaaS Backend is a comprehensive RESTful API built with Express.js and Prisma ORM, providing complete hospital management functionality including patient management, clinical modules (OPD, IPD, Lab, Radiology, Pharmacy), billing, and administrative features.

**Key Features:**
- JWT-based authentication
- Multi-tenancy support with organization isolation
- Role-based access control (SuperAdmin, HospitalAdmin, Doctor, Nurse, etc.)
- Auto-generated order numbers for invoices, prescriptions, lab tests, etc.
- Transaction-based operations for data consistency
- Comprehensive statistics and analytics
- Status-based workflows for clinical processes

**Technology Stack:**
- Node.js with Express.js
- PostgreSQL with Prisma ORM
- JWT for authentication
- PM2 for process management

---

## Authentication

All endpoints except `/health` and `/auth/login` require authentication using JWT Bearer tokens.

### Login

**Endpoint:** `POST /auth/login`

**Request Body:**
```json
{
  "email": "admin@hospital.com",
  "password": "your-password"
}
```

**Success Response (200):**
```json
{
  "data": {
    "access_token": "eyJhbGciOiJIUzI1NiIs...",
    "refresh_token": "eyJhbGciOiJIUzI1NiIs...",
    "expires": 604800000,
    "expires_at": 1701734400000
  }
}
```

**Error Response (401):**
```json
{
  "errors": [
    { "message": "Invalid email or password" }
  ]
}
```

### Using Authentication

Include the access token in the Authorization header for all authenticated requests:

```
Authorization: Bearer eyJhbGciOiJIUzI1NiIs...
```

### Current User

**Endpoint:** `GET /users/me`

**Headers:**
```
Authorization: Bearer {access_token}
```

**Success Response (200):**
```json
{
  "data": {
    "id": "cb2cd2f9-19b4-4d1b-9325-0f23317f5c46",
    "email": "admin@hospital.com",
    "first_name": "John",
    "last_name": "Doe",
    "role": {
      "id": "SuperAdmin",
      "name": "SuperAdmin"
    },
    "org_id": "137161a0-8e87-4147-85c7-a703bc15372d",
    "status": "active",
    "avatar": null
  }
}
```

---

## Common Patterns

### Multi-Tenancy

All resources are scoped to organizations using `orgId`:
- **SuperAdmin** users can access data across all organizations
- Other roles can only access data within their assigned organization
- Query parameter `orgId` is required for SuperAdmin when creating/filtering resources

### Pagination

List endpoints support pagination with query parameters:

```
GET /api/patients?page=1&limit=20
```

**Response includes meta:**
```json
{
  "data": [...],
  "meta": {
    "total": 150,
    "page": 1,
    "limit": 20,
    "totalPages": 8
  }
}
```

### Auto-Generated Numbers

The system automatically generates formatted numbers for various entities:

| Entity | Format | Example |
|--------|--------|---------|
| Invoice | INV{year}{000001} | INV2025000001 |
| Receipt | RCP{year}{000001} | RCP2025000001 |
| Lab Test | LAB{year}{000001} | LAB2025000001 |
| Radiology Test | RAD{year}{000001} | RAD2025000001 |
| Prescription | PRE{year}{000001} | PRE2025000001 |
| Pharmacy Order | PHO{year}{000001} | PHO2025000001 |
| Patient Code | PAT{year}{000001} | PAT2025000001 |
| OPD Token | Generated per department | OPD-001 |

### Status Workflows

#### Invoice Status
- `pending` → `partial` → `paid`

#### Lab Test Status
- `ordered` → `sample_collected` → `processing` → `completed`

#### Radiology Test Status
- `ordered` → `scheduled` → `image_captured` → `completed`

#### Prescription Status
- `pending` → `fulfilled` | `cancelled`

#### Appointment Status
- `scheduled` → `confirmed` → `completed` | `cancelled`

### Date Filtering

Many endpoints support date range filtering:

```
GET /api/billing/invoices?startDate=2025-01-01&endDate=2025-01-31
```

---

## Error Handling

All errors follow a consistent format:

**Error Response:**
```json
{
  "errors": [
    { "message": "Error description" }
  ]
}
```

**Common HTTP Status Codes:**
- `200` - Success
- `201` - Created
- `400` - Bad Request
- `401` - Unauthorized (missing or invalid token)
- `403` - Forbidden (valid token but insufficient permissions)
- `404` - Not Found
- `500` - Internal Server Error

---

## API Endpoints

### Authentication & User Management

#### POST /auth/login
Login with email and password.

**Request:**
```json
{
  "email": "admin@hospital.com",
  "password": "password123"
}
```

**Response (200):**
```json
{
  "data": {
    "access_token": "eyJhbGciOiJIUzI1NiIs...",
    "refresh_token": "eyJhbGciOiJIUzI1NiIs...",
    "expires": 604800000,
    "expires_at": 1701734400000
  }
}
```

#### POST /auth/logout
Logout current user (client-side token invalidation).

**Response (200):**
```json
{
  "data": {
    "message": "Logged out successfully"
  }
}
```

#### GET /users/me
Get current authenticated user details.

**Authentication:** Required

**Response (200):**
```json
{
  "data": {
    "id": "user-id",
    "email": "admin@hospital.com",
    "first_name": "John",
    "last_name": "Doe",
    "role": {
      "id": "SuperAdmin",
      "name": "SuperAdmin"
    },
    "org_id": "org-id",
    "status": "active",
    "avatar": null
  }
}
```

---

### Organization Management

#### GET /api/organizations
List all organizations.

**Authentication:** Required
**Query Parameters:**
- `page` (number, default: 1)
- `limit` (number, default: 20)
- `search` (string) - Search by name

**Response (200):**
```json
{
  "data": [
    {
      "id": "org-id",
      "name": "City General Hospital",
      "email": "info@cityhospital.com",
      "phone": "+1234567890",
      "address": "123 Main St",
      "city": "New York",
      "state": "NY",
      "country": "USA",
      "zipCode": "10001",
      "status": "active",
      "subscriptionStatus": "active",
      "subscriptionExpiry": "2025-12-31T00:00:00.000Z",
      "dateCreated": "2025-01-01T00:00:00.000Z"
    }
  ],
  "meta": {
    "total": 50,
    "page": 1,
    "limit": 20,
    "totalPages": 3
  }
}
```

#### POST /api/organizations
Create a new organization.

**Authentication:** Required (SuperAdmin only)

**Request:**
```json
{
  "name": "New Hospital",
  "email": "contact@newhospital.com",
  "phone": "+1234567890",
  "address": "456 Oak Ave",
  "city": "Boston",
  "state": "MA",
  "country": "USA",
  "zipCode": "02108"
}
```

**Response (201):**
```json
{
  "data": {
    "id": "new-org-id",
    "name": "New Hospital",
    "email": "contact@newhospital.com",
    "status": "active",
    "subscriptionStatus": "trial",
    "dateCreated": "2025-12-02T00:00:00.000Z"
  }
}
```

#### GET /api/organizations/:id
Get organization by ID.

**Authentication:** Required

**Response (200):** Same as organization object above

#### PATCH /api/organizations/:id
Update organization details.

**Authentication:** Required (SuperAdmin or HospitalAdmin of that org)

**Request:**
```json
{
  "name": "Updated Hospital Name",
  "phone": "+9876543210"
}
```

**Response (200):** Updated organization object

#### DELETE /api/organizations/:id
Delete organization (soft delete - sets status to inactive).

**Authentication:** Required (SuperAdmin only)

**Response (200):**
```json
{
  "message": "Organization deleted successfully"
}
```

#### GET /api/organizations/:id/stats
Get statistics for a specific organization.

**Authentication:** Required

**Response (200):**
```json
{
  "data": {
    "totalPatients": 250,
    "activeDepartments": 12,
    "totalBeds": 100,
    "occupiedBeds": 75,
    "availableBeds": 25,
    "todayOPD": 45,
    "currentIPD": 60,
    "todayAppointments": 30
  }
}
```

---

### Patient Management

#### GET /api/patients
List all patients.

**Authentication:** Required
**Query Parameters:**
- `orgId` (string) - Filter by organization (SuperAdmin only)
- `page` (number, default: 1)
- `limit` (number, default: 20)
- `search` (string) - Search by name, code, phone
- `status` (string) - Filter by status: active, inactive

**Response (200):**
```json
{
  "data": [
    {
      "id": "patient-id",
      "patientCode": "PAT2025000001",
      "firstName": "John",
      "lastName": "Smith",
      "dateOfBirth": "1980-05-15T00:00:00.000Z",
      "gender": "male",
      "bloodGroup": "O+",
      "phone": "+1234567890",
      "email": "john.smith@email.com",
      "address": "789 Pine St",
      "city": "Chicago",
      "emergencyContact": "+0987654321",
      "status": "active",
      "registrationDate": "2025-01-15T00:00:00.000Z"
    }
  ],
  "meta": {
    "total": 250,
    "page": 1,
    "limit": 20,
    "totalPages": 13
  }
}
```

#### POST /api/patients
Create a new patient.

**Authentication:** Required

**Request:**
```json
{
  "orgId": "org-id",
  "firstName": "Jane",
  "lastName": "Doe",
  "dateOfBirth": "1992-08-20",
  "gender": "female",
  "bloodGroup": "A+",
  "phone": "+1234567890",
  "email": "jane.doe@email.com",
  "address": "123 Elm St",
  "city": "Seattle",
  "state": "WA",
  "country": "USA",
  "zipCode": "98101",
  "emergencyContact": "+0987654321",
  "emergencyContactName": "John Doe"
}
```

**Response (201):**
```json
{
  "data": {
    "id": "new-patient-id",
    "patientCode": "PAT2025000250",
    "firstName": "Jane",
    "lastName": "Doe",
    "dateOfBirth": "1992-08-20T00:00:00.000Z",
    "gender": "female",
    "bloodGroup": "A+",
    "phone": "+1234567890",
    "status": "active",
    "registrationDate": "2025-12-02T00:00:00.000Z"
  }
}
```

#### GET /api/patients/:id
Get patient by ID with full details.

**Authentication:** Required

**Response (200):** Full patient object

#### GET /api/patients/code/:code
Get patient by patient code.

**Authentication:** Required

**Response (200):** Full patient object

#### PATCH /api/patients/:id
Update patient details.

**Authentication:** Required

**Request:** Partial patient object

**Response (200):** Updated patient object

#### DELETE /api/patients/:id
Delete patient (soft delete).

**Authentication:** Required

**Response (200):**
```json
{
  "message": "Patient deleted successfully"
}
```

#### GET /api/patients/:id/history
Get complete patient history including visits, tests, prescriptions.

**Authentication:** Required

**Response (200):**
```json
{
  "data": {
    "patient": { /* patient object */ },
    "opdVisits": [ /* OPD tokens */ ],
    "ipdAdmissions": [ /* IPD admissions */ ],
    "appointments": [ /* appointments */ ],
    "labTests": [ /* lab tests */ ],
    "radiologyTests": [ /* radiology tests */ ],
    "prescriptions": [ /* prescriptions */ ],
    "invoices": [ /* billing invoices */ ],
    "surgicalHistory": [ /* surgical records */ ]
  }
}
```

---

### Department & Bed Management

#### GET /api/departments
List all departments.

**Authentication:** Required
**Query Parameters:**
- `orgId` (string) - Filter by organization

**Response (200):**
```json
{
  "data": [
    {
      "id": "dept-id",
      "name": "Cardiology",
      "code": "CARD",
      "description": "Heart and cardiovascular care",
      "floor": "3rd Floor",
      "status": "active",
      "totalBeds": 20,
      "occupiedBeds": 15,
      "dateCreated": "2025-01-01T00:00:00.000Z"
    }
  ]
}
```

#### POST /api/departments
Create a new department.

**Authentication:** Required

**Request:**
```json
{
  "orgId": "org-id",
  "name": "Neurology",
  "code": "NEURO",
  "description": "Brain and nervous system care",
  "floor": "4th Floor"
}
```

**Response (201):** Created department object

#### GET /api/departments/:id
Get department by ID.

**Authentication:** Required

**Response (200):** Department object with bed statistics

#### PATCH /api/departments/:id
Update department details.

**Authentication:** Required

**Request:** Partial department object

**Response (200):** Updated department object

#### DELETE /api/departments/:id
Delete department (if no active beds).

**Authentication:** Required

**Response (200):**
```json
{
  "message": "Department deleted successfully"
}
```

#### GET /api/departments/:deptId/beds
Get all beds in a department.

**Authentication:** Required

**Response (200):**
```json
{
  "data": [
    {
      "id": "bed-id",
      "bedNumber": "301",
      "bedType": "general",
      "status": "occupied",
      "departmentId": "dept-id",
      "currentAssignment": {
        "id": "assignment-id",
        "patientId": "patient-id",
        "patient": {
          "firstName": "John",
          "lastName": "Smith",
          "patientCode": "PAT2025000001"
        },
        "assignedAt": "2025-12-01T10:00:00.000Z"
      }
    }
  ]
}
```

#### POST /api/departments/:deptId/beds
Create a new bed in a department.

**Authentication:** Required

**Request:**
```json
{
  "bedNumber": "405",
  "bedType": "icu",
  "description": "ICU bed with ventilator"
}
```

**Response (201):** Created bed object

#### PATCH /api/departments/beds/:id
Update bed details.

**Authentication:** Required

**Request:**
```json
{
  "bedType": "private",
  "status": "maintenance"
}
```

**Response (200):** Updated bed object

#### GET /api/departments/beds/available
Get all available beds across departments.

**Authentication:** Required
**Query Parameters:**
- `orgId` (string) - Filter by organization
- `departmentId` (string) - Filter by department
- `bedType` (string) - Filter by type: general, private, icu, emergency

**Response (200):**
```json
{
  "data": [
    {
      "id": "bed-id",
      "bedNumber": "302",
      "bedType": "general",
      "status": "available",
      "department": {
        "id": "dept-id",
        "name": "Cardiology",
        "code": "CARD"
      }
    }
  ],
  "count": 25
}
```

#### POST /api/departments/beds/:bedId/assign
Assign a bed to a patient.

**Authentication:** Required

**Request:**
```json
{
  "patientId": "patient-id",
  "assignedBy": "doctor-id",
  "notes": "Post-surgery recovery"
}
```

**Response (201):**
```json
{
  "data": {
    "id": "assignment-id",
    "bedId": "bed-id",
    "patientId": "patient-id",
    "assignedBy": "doctor-id",
    "assignedAt": "2025-12-02T10:00:00.000Z",
    "status": "active",
    "notes": "Post-surgery recovery"
  }
}
```

#### POST /api/departments/beds/assignments/:id/release
Release a bed (patient discharge).

**Authentication:** Required

**Request:**
```json
{
  "releasedBy": "doctor-id",
  "releaseNotes": "Patient recovered and discharged"
}
```

**Response (200):**
```json
{
  "data": {
    "id": "assignment-id",
    "status": "released",
    "releasedAt": "2025-12-02T15:00:00.000Z",
    "releasedBy": "doctor-id",
    "releaseNotes": "Patient recovered and discharged"
  }
}
```

#### POST /api/departments/beds/:bedId/transfer
Transfer patient to another bed.

**Authentication:** Required

**Request:**
```json
{
  "fromBedId": "old-bed-id",
  "toBedId": "new-bed-id",
  "transferredBy": "doctor-id",
  "reason": "Better monitoring required"
}
```

**Response (201):** Transfer record and new assignment

#### GET /api/departments/beds/assignments/history
Get bed assignment history.

**Authentication:** Required
**Query Parameters:**
- `orgId` (string)
- `patientId` (string)
- `bedId` (string)
- `status` (string): active, released

**Response (200):** Array of assignment records with patient and bed details

---

### OPD Module

#### GET /api/opd/tokens
List OPD tokens.

**Authentication:** Required
**Query Parameters:**
- `orgId` (string)
- `date` (string) - Filter by date (YYYY-MM-DD)
- `departmentId` (string)
- `status` (string): waiting, called, in_consultation, completed, cancelled

**Response (200):**
```json
{
  "data": [
    {
      "id": "token-id",
      "tokenNumber": "OPD-001",
      "patientId": "patient-id",
      "patient": {
        "firstName": "John",
        "lastName": "Smith",
        "patientCode": "PAT2025000001"
      },
      "departmentId": "dept-id",
      "department": {
        "name": "Cardiology",
        "code": "CARD"
      },
      "doctorId": "doctor-id",
      "visitDate": "2025-12-02",
      "status": "waiting",
      "priority": "normal",
      "chiefComplaint": "Chest pain",
      "generatedAt": "2025-12-02T09:00:00.000Z"
    }
  ]
}
```

#### POST /api/opd/tokens
Generate new OPD token.

**Authentication:** Required

**Request:**
```json
{
  "orgId": "org-id",
  "patientId": "patient-id",
  "departmentId": "dept-id",
  "doctorId": "doctor-id",
  "chiefComplaint": "Chest pain",
  "priority": "normal"
}
```

**Response (201):** Created token object with auto-generated token number

#### GET /api/opd/tokens/:id
Get OPD token by ID.

**Authentication:** Required

**Response (200):** Full token object with patient and doctor details

#### PATCH /api/opd/tokens/:id
Update OPD token.

**Authentication:** Required

**Request:**
```json
{
  "status": "in_consultation",
  "vitals": {
    "bp": "120/80",
    "pulse": 72,
    "temperature": 98.6,
    "weight": 70,
    "height": 175
  }
}
```

**Response (200):** Updated token object

#### POST /api/opd/tokens/:id/call
Call next patient (change status to called).

**Authentication:** Required

**Response (200):** Updated token with status "called"

#### POST /api/opd/tokens/:id/complete
Complete consultation.

**Authentication:** Required

**Request:**
```json
{
  "diagnosis": "Hypertension",
  "prescriptionNotes": "Medication advised",
  "followUpDate": "2025-12-09",
  "consultationNotes": "Patient responding well to treatment"
}
```

**Response (200):** Updated token with status "completed"

#### DELETE /api/opd/tokens/:id
Cancel OPD token.

**Authentication:** Required

**Response (200):**
```json
{
  "message": "Token cancelled successfully"
}
```

#### GET /api/opd/queue
Get current queue status for a department.

**Authentication:** Required
**Query Parameters:**
- `orgId` (string)
- `departmentId` (string, required)
- `date` (string) - Default: today

**Response (200):**
```json
{
  "data": {
    "department": {
      "id": "dept-id",
      "name": "Cardiology",
      "code": "CARD"
    },
    "date": "2025-12-02",
    "totalTokens": 45,
    "waiting": 12,
    "inConsultation": 3,
    "completed": 28,
    "cancelled": 2,
    "queue": [
      /* Array of waiting tokens */
    ]
  }
}
```

#### GET /api/opd/queue/next
Get next patient in queue.

**Authentication:** Required
**Query Parameters:**
- `departmentId` (string, required)

**Response (200):** Next waiting token or null

#### GET /api/opd/stats
Get OPD statistics.

**Authentication:** Required
**Query Parameters:**
- `orgId` (string)
- `startDate` (string)
- `endDate` (string)

**Response (200):**
```json
{
  "data": {
    "totalVisits": 1250,
    "byStatus": {
      "completed": 1000,
      "waiting": 50,
      "in_consultation": 10,
      "cancelled": 190
    },
    "byDepartment": [
      {
        "departmentName": "Cardiology",
        "count": 450
      }
    ],
    "averageWaitTime": "25 minutes",
    "dailyTrend": [
      /* Daily visit counts */
    ]
  }
}
```

---

### IPD Module

#### GET /api/ipd/admissions
List IPD admissions.

**Authentication:** Required
**Query Parameters:**
- `orgId` (string)
- `status` (string): admitted, discharged
- `departmentId` (string)

**Response (200):**
```json
{
  "data": [
    {
      "id": "admission-id",
      "admissionNumber": "IPD2025000001",
      "patientId": "patient-id",
      "patient": {
        "firstName": "John",
        "lastName": "Smith",
        "patientCode": "PAT2025000001"
      },
      "departmentId": "dept-id",
      "department": {
        "name": "Cardiology"
      },
      "bedAssignmentId": "bed-assignment-id",
      "admittingDoctorId": "doctor-id",
      "admissionDate": "2025-12-01T10:00:00.000Z",
      "provisionalDiagnosis": "Acute myocardial infarction",
      "status": "admitted"
    }
  ]
}
```

#### POST /api/ipd/admissions
Create new IPD admission.

**Authentication:** Required

**Request:**
```json
{
  "orgId": "org-id",
  "patientId": "patient-id",
  "departmentId": "dept-id",
  "bedId": "bed-id",
  "admittingDoctorId": "doctor-id",
  "provisionalDiagnosis": "Pneumonia",
  "admissionNotes": "Patient presents with severe respiratory distress",
  "emergencyContact": "+1234567890"
}
```

**Response (201):** Created admission with auto-generated admission number and bed assignment

#### GET /api/ipd/admissions/:id
Get admission by ID.

**Authentication:** Required

**Response (200):** Full admission object with patient, bed, and daily records

#### PATCH /api/ipd/admissions/:id
Update admission details.

**Authentication:** Required

**Request:**
```json
{
  "finalDiagnosis": "Bacterial pneumonia",
  "treatmentPlan": "IV antibiotics for 7 days"
}
```

**Response (200):** Updated admission object

#### POST /api/ipd/admissions/:id/discharge
Discharge patient from IPD.

**Authentication:** Required

**Request:**
```json
{
  "dischargeDate": "2025-12-05T15:00:00Z",
  "dischargeSummary": "Patient recovered well, no complications",
  "dischargeInstructions": "Complete oral antibiotics course, follow-up in 2 weeks",
  "finalDiagnosis": "Resolved bacterial pneumonia"
}
```

**Response (200):**
```json
{
  "data": {
    "id": "admission-id",
    "status": "discharged",
    "dischargeDate": "2025-12-05T15:00:00.000Z",
    "dischargeSummary": "Patient recovered well, no complications",
    "bedReleased": true
  }
}
```

#### POST /api/ipd/admissions/:id/transfer
Transfer patient to another bed/department.

**Authentication:** Required

**Request:**
```json
{
  "newBedId": "new-bed-id",
  "newDepartmentId": "new-dept-id",
  "transferReason": "Requires ICU monitoring",
  "transferredBy": "doctor-id"
}
```

**Response (200):** Updated admission with new bed assignment

#### GET /api/ipd/admissions/:id/daily-records
Get daily care records for an admission.

**Authentication:** Required

**Response (200):**
```json
{
  "data": [
    {
      "id": "record-id",
      "admissionId": "admission-id",
      "recordDate": "2025-12-02",
      "vitals": {
        "bp": "120/80",
        "pulse": 72,
        "temperature": 98.6,
        "respiratoryRate": 16,
        "oxygenSaturation": 98
      },
      "symptoms": "Mild cough, improving",
      "treatmentGiven": "IV antibiotics continued",
      "doctorNotes": "Patient showing good response to treatment",
      "recordedBy": "nurse-id",
      "recordedAt": "2025-12-02T08:00:00.000Z"
    }
  ]
}
```

#### POST /api/ipd/admissions/:id/daily-records
Add daily care record.

**Authentication:** Required

**Request:**
```json
{
  "recordDate": "2025-12-02",
  "vitals": {
    "bp": "120/80",
    "pulse": 72,
    "temperature": 98.6,
    "respiratoryRate": 16,
    "oxygenSaturation": 98
  },
  "symptoms": "Improving",
  "treatmentGiven": "IV antibiotics, oxygen therapy",
  "doctorNotes": "Continue current treatment"
}
```

**Response (201):** Created daily record

#### GET /api/ipd/stats
Get IPD statistics.

**Authentication:** Required
**Query Parameters:**
- `orgId` (string)
- `startDate` (string)
- `endDate` (string)

**Response (200):**
```json
{
  "data": {
    "totalAdmissions": 450,
    "currentAdmissions": 75,
    "discharges": 375,
    "averageLengthOfStay": "5.2 days",
    "bedOccupancyRate": "85%",
    "byDepartment": [
      {
        "departmentName": "Cardiology",
        "admissions": 120,
        "currentPatients": 20
      }
    ]
  }
}
```

---

### Appointments

#### GET /api/appointments
List appointments.

**Authentication:** Required
**Query Parameters:**
- `orgId` (string)
- `status` (string): scheduled, confirmed, completed, cancelled
- `date` (string) - Filter by date
- `doctorId` (string)
- `patientId` (string)

**Response (200):**
```json
{
  "data": [
    {
      "id": "appointment-id",
      "patientId": "patient-id",
      "patient": {
        "firstName": "John",
        "lastName": "Smith",
        "patientCode": "PAT2025000001"
      },
      "doctorId": "doctor-id",
      "doctor": {
        "firstName": "Dr. Sarah",
        "lastName": "Johnson"
      },
      "appointmentDate": "2025-12-05",
      "appointmentTime": "10:00",
      "appointmentType": "consultation",
      "status": "scheduled",
      "reason": "Follow-up checkup",
      "notes": "Annual physical"
    }
  ]
}
```

#### POST /api/appointments
Create new appointment.

**Authentication:** Required

**Request:**
```json
{
  "orgId": "org-id",
  "patientId": "patient-id",
  "doctorId": "doctor-id",
  "appointmentDate": "2025-12-10",
  "appointmentTime": "14:30",
  "appointmentType": "consultation",
  "reason": "Chest pain evaluation",
  "notes": "Patient reports intermittent chest discomfort"
}
```

**Response (201):** Created appointment object

#### GET /api/appointments/:id
Get appointment by ID.

**Authentication:** Required

**Response (200):** Full appointment object

#### PATCH /api/appointments/:id
Update appointment.

**Authentication:** Required

**Request:**
```json
{
  "appointmentDate": "2025-12-11",
  "appointmentTime": "15:00",
  "status": "confirmed"
}
```

**Response (200):** Updated appointment object

#### POST /api/appointments/:id/confirm
Confirm appointment.

**Authentication:** Required

**Response (200):**
```json
{
  "data": {
    "id": "appointment-id",
    "status": "confirmed",
    "confirmedAt": "2025-12-02T10:00:00.000Z"
  }
}
```

#### POST /api/appointments/:id/cancel
Cancel appointment.

**Authentication:** Required

**Request:**
```json
{
  "cancellationReason": "Patient unavailable"
}
```

**Response (200):** Updated appointment with status "cancelled"

#### POST /api/appointments/:id/complete
Mark appointment as completed.

**Authentication:** Required

**Request:**
```json
{
  "consultationNotes": "Regular checkup completed, all vitals normal",
  "followUpRequired": true,
  "followUpDate": "2026-01-05"
}
```

**Response (200):** Updated appointment with status "completed"

#### DELETE /api/appointments/:id
Delete appointment.

**Authentication:** Required

**Response (200):**
```json
{
  "message": "Appointment deleted successfully"
}
```

#### GET /api/appointments/availability/:doctorId
Get doctor availability.

**Authentication:** Required
**Query Parameters:**
- `date` (string, required) - Date to check (YYYY-MM-DD)

**Response (200):**
```json
{
  "data": {
    "doctorId": "doctor-id",
    "date": "2025-12-10",
    "workingHours": {
      "start": "09:00",
      "end": "17:00"
    },
    "bookedSlots": [
      "10:00",
      "11:30",
      "14:00"
    ],
    "availableSlots": [
      "09:00",
      "09:30",
      "10:30",
      "11:00",
      "12:00",
      "12:30",
      "13:00",
      "13:30",
      "14:30",
      "15:00",
      "15:30",
      "16:00",
      "16:30"
    ]
  }
}
```

#### GET /api/appointments/stats/summary
Get appointment statistics.

**Authentication:** Required
**Query Parameters:**
- `orgId` (string)
- `startDate` (string)
- `endDate` (string)

**Response (200):**
```json
{
  "data": {
    "totalAppointments": 850,
    "byStatus": {
      "scheduled": 120,
      "confirmed": 80,
      "completed": 600,
      "cancelled": 50
    },
    "byType": {
      "consultation": 500,
      "follow_up": 250,
      "emergency": 100
    },
    "upcomingToday": 25,
    "completionRate": "88%"
  }
}
```

---

### Billing Module

#### GET /api/billing/invoices
List invoices.

**Authentication:** Required
**Query Parameters:**
- `orgId` (string)
- `patientId` (string)
- `status` (string): pending, partial, paid
- `startDate` (string)
- `endDate` (string)
- `page` (number)
- `limit` (number)

**Response (200):**
```json
{
  "data": [
    {
      "id": "invoice-id",
      "invoiceNumber": "INV2025000001",
      "patientId": "patient-id",
      "patient": {
        "firstName": "John",
        "lastName": "Smith",
        "patientCode": "PAT2025000001"
      },
      "invoiceDate": "2025-12-02",
      "dueDate": "2025-12-09",
      "totalAmount": 5000.00,
      "paidAmount": 2000.00,
      "balanceAmount": 3000.00,
      "status": "partial",
      "items": [
        {
          "description": "Consultation Fee",
          "quantity": 1,
          "unitPrice": 500.00,
          "amount": 500.00
        },
        {
          "description": "Lab Tests",
          "quantity": 5,
          "unitPrice": 200.00,
          "amount": 1000.00
        }
      ],
      "payments": [
        {
          "id": "payment-id",
          "receiptNumber": "RCP2025000001",
          "amount": 2000.00,
          "paymentDate": "2025-12-02",
          "paymentMethod": "card"
        }
      ]
    }
  ],
  "meta": {
    "total": 450,
    "page": 1,
    "limit": 20,
    "totalPages": 23
  }
}
```

#### POST /api/billing/invoices
Create new invoice.

**Authentication:** Required

**Request:**
```json
{
  "orgId": "org-id",
  "patientId": "patient-id",
  "invoiceDate": "2025-12-02",
  "dueDate": "2025-12-09",
  "items": [
    {
      "description": "Consultation Fee",
      "quantity": 1,
      "unitPrice": 500.00,
      "taxRate": 0,
      "discountRate": 0
    },
    {
      "description": "X-Ray Chest",
      "quantity": 1,
      "unitPrice": 1500.00,
      "taxRate": 0,
      "discountRate": 10
    }
  ],
  "notes": "Payment terms: 7 days",
  "taxRate": 0,
  "discountRate": 0
}
```

**Response (201):**
```json
{
  "data": {
    "id": "invoice-id",
    "invoiceNumber": "INV2025000450",
    "totalAmount": 1850.00,
    "taxAmount": 0,
    "discountAmount": 150.00,
    "status": "pending",
    "items": [ /* invoice items */ ]
  }
}
```

#### GET /api/billing/invoices/:id
Get invoice by ID.

**Authentication:** Required

**Response (200):** Full invoice object with items and payments

#### PATCH /api/billing/invoices/:id
Update invoice.

**Authentication:** Required

**Request:**
```json
{
  "dueDate": "2025-12-15",
  "notes": "Extended payment terms"
}
```

**Response (200):** Updated invoice object

#### DELETE /api/billing/invoices/:id
Delete invoice (only if no payments made).

**Authentication:** Required

**Response (200):**
```json
{
  "message": "Invoice deleted successfully"
}
```

#### GET /api/billing/payments
List payments.

**Authentication:** Required
**Query Parameters:**
- `orgId` (string)
- `patientId` (string)
- `invoiceId` (string)
- `startDate` (string)
- `endDate` (string)

**Response (200):**
```json
{
  "data": [
    {
      "id": "payment-id",
      "receiptNumber": "RCP2025000001",
      "invoiceId": "invoice-id",
      "invoice": {
        "invoiceNumber": "INV2025000001"
      },
      "patientId": "patient-id",
      "patient": {
        "firstName": "John",
        "lastName": "Smith"
      },
      "amount": 2000.00,
      "paymentDate": "2025-12-02",
      "paymentMethod": "card",
      "transactionId": "TXN123456789",
      "notes": "Partial payment"
    }
  ]
}
```

#### POST /api/billing/payments
Record new payment.

**Authentication:** Required

**Request:**
```json
{
  "invoiceId": "invoice-id",
  "amount": 3000.00,
  "paymentDate": "2025-12-03",
  "paymentMethod": "cash",
  "transactionId": "CASH20251203001",
  "notes": "Final payment"
}
```

**Response (201):**
```json
{
  "data": {
    "id": "payment-id",
    "receiptNumber": "RCP2025000125",
    "amount": 3000.00,
    "paymentDate": "2025-12-03T00:00:00.000Z",
    "invoice": {
      "invoiceNumber": "INV2025000001",
      "totalAmount": 5000.00,
      "paidAmount": 5000.00,
      "balanceAmount": 0,
      "status": "paid"
    }
  }
}
```

#### GET /api/billing/payments/:id
Get payment by ID.

**Authentication:** Required

**Response (200):** Full payment object with invoice details

#### DELETE /api/billing/payments/:id
Delete payment (reverses payment and updates invoice).

**Authentication:** Required

**Response (200):**
```json
{
  "message": "Payment deleted and invoice updated successfully"
}
```

#### GET /api/billing/patients/:patientId/outstanding
Get patient's outstanding balance.

**Authentication:** Required

**Response (200):**
```json
{
  "data": {
    "patientId": "patient-id",
    "patient": {
      "firstName": "John",
      "lastName": "Smith",
      "patientCode": "PAT2025000001"
    },
    "totalInvoiced": 15000.00,
    "totalPaid": 12000.00,
    "outstandingBalance": 3000.00,
    "invoices": [
      {
        "invoiceNumber": "INV2025000001",
        "totalAmount": 5000.00,
        "paidAmount": 2000.00,
        "balanceAmount": 3000.00,
        "status": "partial",
        "dueDate": "2025-12-09"
      }
    ]
  }
}
```

#### GET /api/billing/stats/summary
Get billing statistics.

**Authentication:** Required
**Query Parameters:**
- `orgId` (string)
- `startDate` (string)
- `endDate` (string)

**Response (200):**
```json
{
  "data": {
    "totalInvoices": 450,
    "totalRevenue": 2250000.00,
    "collectedAmount": 1800000.00,
    "outstandingAmount": 450000.00,
    "byStatus": {
      "paid": 350,
      "partial": 75,
      "pending": 25
    },
    "averageInvoiceValue": 5000.00,
    "collectionRate": "80%"
  }
}
```

#### GET /api/billing/reports/revenue
Get revenue report with date grouping.

**Authentication:** Required
**Query Parameters:**
- `orgId` (string)
- `startDate` (string, required)
- `endDate` (string, required)
- `groupBy` (string): day, week, month - Default: month

**Response (200):**
```json
{
  "data": {
    "startDate": "2025-01-01",
    "endDate": "2025-12-31",
    "groupBy": "month",
    "revenue": [
      {
        "period": "2025-01",
        "invoiced": 185000.00,
        "collected": 150000.00,
        "outstanding": 35000.00
      },
      {
        "period": "2025-02",
        "invoiced": 195000.00,
        "collected": 160000.00,
        "outstanding": 35000.00
      }
    ],
    "totals": {
      "invoiced": 2250000.00,
      "collected": 1800000.00,
      "outstanding": 450000.00
    }
  }
}
```

---

### Lab Module

#### GET /api/lab/tests
List lab tests.

**Authentication:** Required
**Query Parameters:**
- `orgId` (string)
- `patientId` (string)
- `status` (string): ordered, sample_collected, processing, completed, cancelled
- `priority` (string): routine, urgent
- `startDate` (string)
- `endDate` (string)

**Response (200):**
```json
{
  "data": [
    {
      "id": "test-id",
      "labOrderNumber": "LAB2025000001",
      "patientId": "patient-id",
      "patient": {
        "firstName": "John",
        "lastName": "Smith",
        "patientCode": "PAT2025000001"
      },
      "testName": "Complete Blood Count",
      "testCategory": "Hematology",
      "orderedBy": "doctor-id",
      "orderDate": "2025-12-02",
      "priority": "routine",
      "status": "sample_collected",
      "sampleCollectionDate": "2025-12-02T10:30:00.000Z",
      "cost": 500.00
    }
  ]
}
```

#### POST /api/lab/tests
Order new lab test.

**Authentication:** Required

**Request:**
```json
{
  "orgId": "org-id",
  "patientId": "patient-id",
  "testName": "Lipid Profile",
  "testCategory": "Biochemistry",
  "testDescription": "Complete lipid panel",
  "orderedBy": "doctor-id",
  "priority": "routine",
  "clinicalNotes": "Patient has family history of heart disease",
  "cost": 800.00
}
```

**Response (201):**
```json
{
  "data": {
    "id": "test-id",
    "labOrderNumber": "LAB2025000125",
    "patientId": "patient-id",
    "testName": "Lipid Profile",
    "status": "ordered",
    "orderDate": "2025-12-02",
    "priority": "routine"
  }
}
```

#### GET /api/lab/tests/:id
Get lab test by ID.

**Authentication:** Required

**Response (200):** Full test object with samples and results

#### PATCH /api/lab/tests/:id
Update lab test.

**Authentication:** Required

**Request:**
```json
{
  "status": "processing",
  "clinicalNotes": "Sample quality good"
}
```

**Response (200):** Updated test object

#### POST /api/lab/tests/:id/cancel
Cancel lab test.

**Authentication:** Required

**Request:**
```json
{
  "cancellationReason": "Patient request"
}
```

**Response (200):** Updated test with status "cancelled"

#### GET /api/lab/tests/:testId/samples
Get sample collection records for a test.

**Authentication:** Required

**Response (200):**
```json
{
  "data": [
    {
      "id": "sample-id",
      "labTestId": "test-id",
      "sampleType": "blood",
      "sampleId": "SMPL20250001",
      "collectionDate": "2025-12-02T10:30:00.000Z",
      "collectedBy": "nurse-id",
      "collectionNotes": "Sample collected without complications",
      "status": "collected"
    }
  ]
}
```

#### POST /api/lab/tests/:testId/samples
Record sample collection.

**Authentication:** Required

**Request:**
```json
{
  "sampleType": "blood",
  "collectionDate": "2025-12-02T10:30:00Z",
  "collectedBy": "nurse-id",
  "collectionNotes": "2 vials collected, fasting sample"
}
```

**Response (201):** Created sample record with auto-generated sample ID

#### PATCH /api/lab/samples/:id
Update sample record.

**Authentication:** Required

**Request:**
```json
{
  "status": "processing",
  "processingNotes": "Sample centrifuged and ready for analysis"
}
```

**Response (200):** Updated sample object

#### POST /api/lab/tests/:testId/results
Submit lab test results.

**Authentication:** Required

**Request:**
```json
{
  "resultDate": "2025-12-03",
  "parameters": [
    {
      "parameterName": "Hemoglobin",
      "value": "14.5",
      "unit": "g/dL",
      "normalRange": "13.5-17.5",
      "isAbnormal": false
    },
    {
      "parameterName": "WBC Count",
      "value": "12500",
      "unit": "/µL",
      "normalRange": "4000-11000",
      "isAbnormal": true
    }
  ],
  "interpretation": "Slightly elevated WBC count, may indicate mild infection",
  "verifiedBy": "pathologist-id",
  "recommendations": "Recommend follow-up if symptoms persist"
}
```

**Response (201):**
```json
{
  "data": {
    "id": "result-id",
    "labTestId": "test-id",
    "resultDate": "2025-12-03",
    "parameters": [ /* array of parameters */ ],
    "interpretation": "Slightly elevated WBC count...",
    "status": "completed",
    "verifiedBy": "pathologist-id",
    "verifiedAt": "2025-12-03T15:00:00.000Z"
  }
}
```

#### GET /api/lab/tests/:testId/results
Get lab test results.

**Authentication:** Required

**Response (200):**
```json
{
  "data": {
    "id": "result-id",
    "labTestId": "test-id",
    "test": {
      "labOrderNumber": "LAB2025000001",
      "testName": "Complete Blood Count",
      "patient": {
        "firstName": "John",
        "lastName": "Smith"
      }
    },
    "resultDate": "2025-12-03",
    "parameters": [
      {
        "parameterName": "Hemoglobin",
        "value": "14.5",
        "unit": "g/dL",
        "normalRange": "13.5-17.5",
        "isAbnormal": false
      }
    ],
    "interpretation": "All values within normal limits",
    "verifiedBy": "pathologist-id",
    "verifiedAt": "2025-12-03T15:00:00.000Z"
  }
}
```

#### GET /api/lab/tests/:testId/report
Generate comprehensive lab report.

**Authentication:** Required

**Response (200):**
```json
{
  "data": {
    "reportId": "test-id",
    "labOrderNumber": "LAB2025000001",
    "reportDate": "2025-12-03T15:00:00.000Z",
    "patient": {
      "patientCode": "PAT2025000001",
      "name": "John Smith",
      "age": 45,
      "gender": "male"
    },
    "test": {
      "testName": "Complete Blood Count",
      "testCategory": "Hematology",
      "orderDate": "2025-12-02",
      "sampleCollectionDate": "2025-12-02T10:30:00.000Z",
      "resultDate": "2025-12-03"
    },
    "results": {
      "parameters": [ /* all test parameters with values */ ],
      "interpretation": "All values within normal limits",
      "recommendations": "No immediate action required"
    },
    "verifiedBy": {
      "name": "Dr. Sarah Pathologist",
      "qualifications": "MD, Pathology"
    }
  }
}
```

#### GET /api/lab/stats/summary
Get lab module statistics.

**Authentication:** Required
**Query Parameters:**
- `orgId` (string)
- `startDate` (string)
- `endDate` (string)

**Response (200):**
```json
{
  "data": {
    "totalTests": 1250,
    "byStatus": {
      "ordered": 45,
      "sample_collected": 30,
      "processing": 25,
      "completed": 1100,
      "cancelled": 50
    },
    "byCategory": {
      "Hematology": 450,
      "Biochemistry": 380,
      "Microbiology": 220,
      "Serology": 200
    },
    "byPriority": {
      "routine": 1000,
      "urgent": 250
    },
    "averageTurnaroundTime": "24 hours",
    "revenue": 625000.00
  }
}
```

---

### Radiology Module

#### GET /api/radiology/tests
List radiology tests.

**Authentication:** Required
**Query Parameters:**
- `orgId` (string)
- `patientId` (string)
- `status` (string): ordered, scheduled, image_captured, completed, cancelled
- `modality` (string): x-ray, ct, mri, ultrasound, mammography, fluoroscopy, pet, dexa
- `startDate` (string)
- `endDate` (string)

**Response (200):**
```json
{
  "data": [
    {
      "id": "test-id",
      "radiologyOrderNumber": "RAD2025000001",
      "patientId": "patient-id",
      "patient": {
        "firstName": "John",
        "lastName": "Smith",
        "patientCode": "PAT2025000001"
      },
      "testName": "Chest X-Ray",
      "modality": "x-ray",
      "bodyPart": "chest",
      "orderedBy": "doctor-id",
      "orderDate": "2025-12-02",
      "status": "image_captured",
      "scheduledDate": "2025-12-02T14:00:00.000Z",
      "cost": 1500.00
    }
  ]
}
```

#### POST /api/radiology/tests
Order new radiology test.

**Authentication:** Required

**Request:**
```json
{
  "orgId": "org-id",
  "patientId": "patient-id",
  "testName": "CT Scan Brain",
  "modality": "ct",
  "bodyPart": "brain",
  "testDescription": "Non-contrast CT scan of brain",
  "orderedBy": "doctor-id",
  "clinicalIndication": "Suspected stroke",
  "scheduledDate": "2025-12-03T10:00:00Z",
  "cost": 5000.00,
  "urgency": "urgent"
}
```

**Response (201):**
```json
{
  "data": {
    "id": "test-id",
    "radiologyOrderNumber": "RAD2025000125",
    "patientId": "patient-id",
    "testName": "CT Scan Brain",
    "modality": "ct",
    "status": "ordered",
    "orderDate": "2025-12-02",
    "scheduledDate": "2025-12-03T10:00:00.000Z"
  }
}
```

#### GET /api/radiology/tests/:id
Get radiology test by ID.

**Authentication:** Required

**Response (200):** Full test object with images and results

#### PATCH /api/radiology/tests/:id
Update radiology test.

**Authentication:** Required

**Request:**
```json
{
  "status": "image_captured",
  "scheduledDate": "2025-12-03T11:00:00Z"
}
```

**Response (200):** Updated test object

#### POST /api/radiology/tests/:id/cancel
Cancel radiology test.

**Authentication:** Required

**Request:**
```json
{
  "cancellationReason": "Patient unable to attend"
}
```

**Response (200):** Updated test with status "cancelled"

#### GET /api/radiology/tests/:testId/images
Get DICOM images for a test.

**Authentication:** Required

**Response (200):**
```json
{
  "data": [
    {
      "id": "image-id",
      "radiologyTestId": "test-id",
      "imageUrl": "https://storage.example.com/images/img001.dcm",
      "imageType": "dicom",
      "seriesNumber": 1,
      "instanceNumber": 1,
      "viewPosition": "AP",
      "captureDate": "2025-12-02T14:30:00.000Z",
      "technician": "tech-id",
      "fileSize": 2048576,
      "metadata": {
        "studyInstanceUID": "1.2.840.113619.2.55",
        "seriesInstanceUID": "1.2.840.113619.2.55.1",
        "manufacturer": "Siemens",
        "kvp": 120,
        "exposure": 250
      }
    }
  ]
}
```

#### POST /api/radiology/tests/:testId/images
Upload DICOM image.

**Authentication:** Required

**Request:**
```json
{
  "imageUrl": "https://storage.example.com/images/img002.dcm",
  "imageType": "dicom",
  "seriesNumber": 1,
  "instanceNumber": 2,
  "viewPosition": "LAT",
  "captureDate": "2025-12-02T14:35:00Z",
  "technician": "tech-id",
  "fileSize": 2150400,
  "metadata": {
    "studyInstanceUID": "1.2.840.113619.2.55",
    "seriesInstanceUID": "1.2.840.113619.2.55.1",
    "manufacturer": "Siemens",
    "kvp": 120,
    "exposure": 250
  }
}
```

**Response (201):** Created image record

#### DELETE /api/radiology/images/:id
Delete DICOM image.

**Authentication:** Required

**Response (200):**
```json
{
  "message": "Image deleted successfully"
}
```

#### POST /api/radiology/tests/:testId/results
Submit radiology findings.

**Authentication:** Required

**Request:**
```json
{
  "reportDate": "2025-12-03",
  "findings": "Clear lung fields bilaterally. No evidence of infiltrates, consolidation, or pleural effusion. Heart size normal. No acute bony abnormalities.",
  "impression": "Normal chest radiograph",
  "recommendations": "No further imaging required at this time",
  "reportedBy": "radiologist-id",
  "criticalFindings": false
}
```

**Response (201):**
```json
{
  "data": {
    "id": "result-id",
    "radiologyTestId": "test-id",
    "reportDate": "2025-12-03",
    "findings": "Clear lung fields bilaterally...",
    "impression": "Normal chest radiograph",
    "recommendations": "No further imaging required",
    "reportedBy": "radiologist-id",
    "reportedAt": "2025-12-03T16:00:00.000Z",
    "criticalFindings": false,
    "status": "completed"
  }
}
```

#### GET /api/radiology/tests/:testId/results
Get radiology results.

**Authentication:** Required

**Response (200):**
```json
{
  "data": {
    "id": "result-id",
    "radiologyTestId": "test-id",
    "test": {
      "radiologyOrderNumber": "RAD2025000001",
      "testName": "Chest X-Ray",
      "modality": "x-ray",
      "patient": {
        "firstName": "John",
        "lastName": "Smith"
      }
    },
    "reportDate": "2025-12-03",
    "findings": "Clear lung fields bilaterally...",
    "impression": "Normal chest radiograph",
    "recommendations": "No further imaging required",
    "criticalFindings": false,
    "reportedBy": "radiologist-id",
    "reportedAt": "2025-12-03T16:00:00.000Z"
  }
}
```

#### GET /api/radiology/tests/:testId/report
Generate comprehensive radiology report.

**Authentication:** Required

**Response (200):**
```json
{
  "data": {
    "reportId": "test-id",
    "radiologyOrderNumber": "RAD2025000001",
    "reportDate": "2025-12-03T16:00:00.000Z",
    "patient": {
      "patientCode": "PAT2025000001",
      "name": "John Smith",
      "age": 45,
      "gender": "male"
    },
    "study": {
      "testName": "Chest X-Ray",
      "modality": "x-ray",
      "bodyPart": "chest",
      "orderDate": "2025-12-02",
      "studyDate": "2025-12-02T14:30:00.000Z",
      "clinicalIndication": "Cough and fever"
    },
    "images": [
      {
        "seriesNumber": 1,
        "instanceNumber": 1,
        "viewPosition": "AP",
        "imageUrl": "https://storage.example.com/images/img001.dcm"
      }
    ],
    "report": {
      "findings": "Clear lung fields bilaterally...",
      "impression": "Normal chest radiograph",
      "recommendations": "No further imaging required",
      "criticalFindings": false
    },
    "radiologist": {
      "name": "Dr. Michael Radiologist",
      "qualifications": "MD, Radiology"
    }
  }
}
```

#### GET /api/radiology/stats/summary
Get radiology statistics.

**Authentication:** Required
**Query Parameters:**
- `orgId` (string)
- `startDate` (string)
- `endDate` (string)

**Response (200):**
```json
{
  "data": {
    "totalTests": 850,
    "byStatus": {
      "ordered": 35,
      "scheduled": 25,
      "image_captured": 20,
      "completed": 750,
      "cancelled": 20
    },
    "byModality": {
      "x-ray": 400,
      "ct": 200,
      "mri": 120,
      "ultrasound": 100,
      "mammography": 30
    },
    "byBodyPart": {
      "chest": 250,
      "brain": 150,
      "abdomen": 120,
      "spine": 100,
      "extremities": 230
    },
    "averageTurnaroundTime": "48 hours",
    "criticalFindings": 15,
    "revenue": 2550000.00
  }
}
```

---

### Pharmacy Module

#### GET /api/pharmacy/medicines
List medicines in inventory.

**Authentication:** Required
**Query Parameters:**
- `orgId` (string)
- `category` (string)
- `search` (string) - Search by name or generic name
- `lowStock` (boolean) - Filter medicines at/below reorder level
- `expired` (boolean) - Filter expired medicines
- `page` (number)
- `limit` (number)

**Response (200):**
```json
{
  "data": [
    {
      "id": "medicine-id",
      "medicineName": "Paracetamol",
      "genericName": "Acetaminophen",
      "category": "Analgesics",
      "manufacturer": "PharmaCorp",
      "batchNumber": "BATCH20250001",
      "expiryDate": "2026-12-31",
      "stockQuantity": 500,
      "unitPrice": 5.00,
      "reorderLevel": 100,
      "dosageForm": "Tablet",
      "strength": "500mg",
      "status": "active",
      "lastRestockedAt": "2025-11-15T00:00:00.000Z"
    }
  ],
  "meta": {
    "total": 250,
    "page": 1,
    "limit": 20,
    "totalPages": 13
  }
}
```

#### POST /api/pharmacy/medicines
Add new medicine to inventory.

**Authentication:** Required

**Request:**
```json
{
  "orgId": "org-id",
  "medicineName": "Amoxicillin",
  "genericName": "Amoxicillin",
  "category": "Antibiotics",
  "manufacturer": "MedLife",
  "batchNumber": "BATCH20250125",
  "expiryDate": "2027-06-30",
  "stockQuantity": 300,
  "unitPrice": 15.00,
  "reorderLevel": 50,
  "dosageForm": "Capsule",
  "strength": "500mg",
  "description": "Broad-spectrum antibiotic"
}
```

**Response (201):** Created medicine object

#### GET /api/pharmacy/medicines/:id
Get medicine by ID.

**Authentication:** Required

**Response (200):** Full medicine object

#### PATCH /api/pharmacy/medicines/:id
Update medicine details.

**Authentication:** Required

**Request:**
```json
{
  "unitPrice": 16.50,
  "reorderLevel": 75,
  "status": "active"
}
```

**Response (200):** Updated medicine object

#### DELETE /api/pharmacy/medicines/:id
Delete medicine from inventory.

**Authentication:** Required

**Response (200):**
```json
{
  "message": "Medicine deleted successfully"
}
```

#### POST /api/pharmacy/medicines/:id/stock
Adjust medicine stock.

**Authentication:** Required

**Request:**
```json
{
  "type": "add",
  "quantity": 200,
  "reason": "New stock received",
  "notes": "Shipment ID: SHIP20250001"
}
```

**Response (200):**
```json
{
  "data": {
    "id": "medicine-id",
    "medicineName": "Paracetamol",
    "stockQuantity": 700,
    "lastRestockedAt": "2025-12-02T10:00:00.000Z"
  },
  "message": "Stock added successfully"
}
```

#### GET /api/pharmacy/prescriptions
List prescriptions.

**Authentication:** Required
**Query Parameters:**
- `orgId` (string)
- `patientId` (string)
- `doctorId` (string)
- `status` (string): pending, fulfilled, cancelled
- `startDate` (string)
- `endDate` (string)

**Response (200):**
```json
{
  "data": [
    {
      "id": "prescription-id",
      "prescriptionNumber": "PRE2025000001",
      "patientId": "patient-id",
      "patient": {
        "firstName": "John",
        "lastName": "Smith",
        "patientCode": "PAT2025000001"
      },
      "doctorId": "doctor-id",
      "doctor": {
        "firstName": "Dr. Sarah",
        "lastName": "Johnson"
      },
      "prescriptionDate": "2025-12-02",
      "diagnosis": "Upper respiratory infection",
      "status": "pending",
      "prescriptionItems": [
        {
          "id": "item-id",
          "medicineId": "medicine-id",
          "medicine": {
            "medicineName": "Amoxicillin",
            "strength": "500mg"
          },
          "quantity": 21,
          "dosage": "500mg",
          "frequency": "Three times daily",
          "duration": "7 days",
          "instructions": "Take after meals"
        }
      ],
      "totalAmount": 315.00
    }
  ]
}
```

#### POST /api/pharmacy/prescriptions
Create new prescription.

**Authentication:** Required

**Request:**
```json
{
  "orgId": "org-id",
  "patientId": "patient-id",
  "doctorId": "doctor-id",
  "prescriptionDate": "2025-12-02",
  "diagnosis": "Hypertension",
  "prescriptionItems": [
    {
      "medicineId": "medicine-id-1",
      "quantity": 30,
      "dosage": "10mg",
      "frequency": "Once daily",
      "duration": "30 days",
      "instructions": "Take in the morning"
    },
    {
      "medicineId": "medicine-id-2",
      "quantity": 60,
      "dosage": "5mg",
      "frequency": "Twice daily",
      "duration": "30 days",
      "instructions": "Take with food"
    }
  ],
  "notes": "Follow-up after 30 days"
}
```

**Response (201):**
```json
{
  "data": {
    "id": "prescription-id",
    "prescriptionNumber": "PRE2025000125",
    "patientId": "patient-id",
    "doctorId": "doctor-id",
    "prescriptionDate": "2025-12-02",
    "diagnosis": "Hypertension",
    "status": "pending",
    "prescriptionItems": [ /* array of items */ ],
    "totalAmount": 450.00
  }
}
```

#### GET /api/pharmacy/prescriptions/:id
Get prescription by ID.

**Authentication:** Required

**Response (200):** Full prescription with items and patient details

#### PATCH /api/pharmacy/prescriptions/:id
Update prescription.

**Authentication:** Required

**Request:**
```json
{
  "notes": "Updated instructions: Monitor blood pressure weekly"
}
```

**Response (200):** Updated prescription object

#### POST /api/pharmacy/prescriptions/:id/cancel
Cancel prescription.

**Authentication:** Required

**Request:**
```json
{
  "cancellationReason": "Patient allergic to prescribed medicine"
}
```

**Response (200):** Updated prescription with status "cancelled"

#### GET /api/pharmacy/orders
List pharmacy orders.

**Authentication:** Required
**Query Parameters:**
- `orgId` (string)
- `prescriptionId` (string)
- `startDate` (string)
- `endDate` (string)

**Response (200):**
```json
{
  "data": [
    {
      "id": "order-id",
      "orderNumber": "PHO2025000001",
      "prescriptionId": "prescription-id",
      "prescription": {
        "prescriptionNumber": "PRE2025000001",
        "patient": {
          "firstName": "John",
          "lastName": "Smith"
        }
      },
      "orderDate": "2025-12-02T11:00:00.000Z",
      "dispensedBy": "pharmacist-id",
      "totalAmount": 315.00,
      "status": "fulfilled",
      "notes": "All medicines dispensed"
    }
  ]
}
```

#### POST /api/pharmacy/orders
Create pharmacy order (fulfills prescription).

**Authentication:** Required

**Request:**
```json
{
  "prescriptionId": "prescription-id",
  "dispensedBy": "pharmacist-id",
  "notes": "Patient counseled on medication usage"
}
```

**Response (201):**
```json
{
  "data": {
    "id": "order-id",
    "orderNumber": "PHO2025000125",
    "prescriptionId": "prescription-id",
    "orderDate": "2025-12-02T11:00:00.000Z",
    "dispensedBy": "pharmacist-id",
    "totalAmount": 315.00,
    "status": "fulfilled",
    "prescription": {
      "prescriptionNumber": "PRE2025000001",
      "status": "fulfilled",
      "prescriptionItems": [ /* items with stock deducted */ ]
    }
  }
}
```

**Note:** Creating an order automatically:
- Validates stock availability for all items
- Deducts stock quantities
- Updates prescription status to "fulfilled"
- All operations are wrapped in a transaction

#### GET /api/pharmacy/orders/:id
Get pharmacy order by ID.

**Authentication:** Required

**Response (200):** Full order object with prescription details

#### PATCH /api/pharmacy/orders/:id
Update pharmacy order.

**Authentication:** Required

**Request:**
```json
{
  "notes": "Patient returned for additional counseling"
}
```

**Response (200):** Updated order object

#### GET /api/pharmacy/stats/summary
Get pharmacy statistics.

**Authentication:** Required
**Query Parameters:**
- `orgId` (string)
- `startDate` (string)
- `endDate` (string)

**Response (200):**
```json
{
  "data": {
    "totalMedicines": 250,
    "lowStockMedicines": 15,
    "expiredMedicines": 3,
    "totalPrescriptions": 1200,
    "fulfilledPrescriptions": 1050,
    "pendingPrescriptions": 120,
    "totalOrders": 1050,
    "revenue": 315000.00,
    "byCategory": {
      "Antibiotics": 35000.00,
      "Analgesics": 28000.00,
      "Antihypertensives": 45000.00,
      "Antihistamines": 12000.00
    },
    "topMedicines": [
      {
        "medicineName": "Paracetamol",
        "quantitySold": 5000,
        "revenue": 25000.00
      }
    ]
  }
}
```

#### GET /api/pharmacy/alerts/low-stock
Get low stock alerts.

**Authentication:** Required
**Query Parameters:**
- `orgId` (string)

**Response (200):**
```json
{
  "data": [
    {
      "id": "medicine-id",
      "medicineName": "Amoxicillin",
      "genericName": "Amoxicillin",
      "category": "Antibiotics",
      "stockQuantity": 45,
      "reorderLevel": 50,
      "deficit": 5,
      "lastRestockedAt": "2025-11-01T00:00:00.000Z"
    }
  ],
  "count": 15
}
```

#### GET /api/pharmacy/alerts/expired
Get expired medicines.

**Authentication:** Required
**Query Parameters:**
- `orgId` (string)

**Response (200):**
```json
{
  "data": [
    {
      "id": "medicine-id",
      "medicineName": "Cough Syrup",
      "genericName": "Dextromethorphan",
      "category": "Cough & Cold",
      "batchNumber": "BATCH20230001",
      "expiryDate": "2025-11-30",
      "stockQuantity": 25,
      "unitPrice": 8.00,
      "totalValue": 200.00
    }
  ],
  "count": 3,
  "totalValue": 450.00
}
```

---

### Subscription Plans

#### GET /api/subscription-plans
List all subscription plans.

**Authentication:** Not required (public)

**Response (200):**
```json
{
  "data": [
    {
      "id": "plan-id",
      "name": "Basic Plan",
      "description": "Perfect for small clinics",
      "price": 99.00,
      "billingCycle": "monthly",
      "features": [
        "Up to 100 patients",
        "5 users",
        "Basic reporting"
      ],
      "maxUsers": 5,
      "maxPatients": 100,
      "status": "active",
      "sort": 1
    }
  ],
  "count": 3
}
```

#### GET /api/subscription-plans/:id
Get subscription plan by ID.

**Authentication:** Not required

**Response (200):** Full plan object with payment history

#### POST /api/subscription-plans
Create new subscription plan.

**Authentication:** Required (SuperAdmin only)

**Request:**
```json
{
  "name": "Enterprise Plan",
  "description": "For large hospitals",
  "price": 499.00,
  "billingCycle": "monthly",
  "features": [
    "Unlimited patients",
    "Unlimited users",
    "Advanced analytics",
    "24/7 support",
    "API access"
  ],
  "maxUsers": -1,
  "maxPatients": -1,
  "sort": 3
}
```

**Response (201):** Created plan object

#### PATCH /api/subscription-plans/:id
Update subscription plan.

**Authentication:** Required (SuperAdmin only)

**Request:**
```json
{
  "price": 549.00,
  "features": [
    "Unlimited patients",
    "Unlimited users",
    "Advanced analytics",
    "24/7 support",
    "API access",
    "Custom integrations"
  ]
}
```

**Response (200):** Updated plan object

#### DELETE /api/subscription-plans/:id
Delete subscription plan.

**Authentication:** Required (SuperAdmin only)

**Response (200):**
```json
{
  "message": "Plan deleted successfully"
}
```

---

### Promotions

#### GET /api/promotions
List promotions.

**Authentication:** Not required
**Query Parameters:**
- `active` (boolean) - Filter active promotions

**Response (200):**
```json
{
  "data": [
    {
      "id": "promo-id",
      "code": "NEWYEAR2025",
      "name": "New Year Discount",
      "description": "20% off all annual plans",
      "discountType": "percentage",
      "discountValue": 20,
      "validFrom": "2025-01-01",
      "validUntil": "2025-01-31",
      "maxUses": 100,
      "usedCount": 25,
      "isActive": true
    }
  ],
  "count": 5
}
```

#### GET /api/promotions/:id
Get promotion by ID.

**Authentication:** Not required

**Response (200):** Full promotion object

#### GET /api/promotions/code/:code
Get promotion by code.

**Authentication:** Not required

**Response (200):**
```json
{
  "data": {
    "id": "promo-id",
    "code": "NEWYEAR2025",
    "name": "New Year Discount",
    "discountType": "percentage",
    "discountValue": 20,
    "validFrom": "2025-01-01",
    "validUntil": "2025-01-31",
    "isActive": true,
    "remainingUses": 75
  }
}
```

#### POST /api/promotions
Create new promotion.

**Authentication:** Required (SuperAdmin only)

**Request:**
```json
{
  "code": "SPRING2025",
  "name": "Spring Sale",
  "description": "30% off Enterprise plan",
  "discountType": "percentage",
  "discountValue": 30,
  "validFrom": "2025-03-01",
  "validUntil": "2025-03-31",
  "applicablePlans": ["enterprise-plan-id"],
  "maxUses": 50
}
```

**Response (201):** Created promotion object

#### PATCH /api/promotions/:id
Update promotion.

**Authentication:** Required (SuperAdmin only)

**Request:**
```json
{
  "isActive": false,
  "discountValue": 25
}
```

**Response (200):** Updated promotion object

#### DELETE /api/promotions/:id
Delete promotion.

**Authentication:** Required (SuperAdmin only)

**Response (200):**
```json
{
  "message": "Promotion deleted successfully"
}
```

---

### Surgical History

#### GET /api/surgical-history
List surgical history records.

**Authentication:** Required
**Query Parameters:**
- `patientId` (string) - Filter by patient

**Response (200):**
```json
{
  "data": [
    {
      "id": "history-id",
      "patientId": "patient-id",
      "surgeryName": "Appendectomy",
      "surgeryDate": "2024-06-15",
      "surgeon": "Dr. Michael Surgeon",
      "hospital": "City General Hospital",
      "complications": "None",
      "notes": "Laparoscopic appendectomy, uneventful recovery",
      "dateCreated": "2024-06-20T00:00:00.000Z"
    }
  ],
  "count": 5
}
```

#### GET /api/surgical-history/:id
Get surgical history record by ID.

**Authentication:** Required

**Response (200):** Full surgical history object

#### POST /api/surgical-history
Create surgical history record.

**Authentication:** Required

**Request:**
```json
{
  "patientId": "patient-id",
  "surgeryName": "Cholecystectomy",
  "surgeryDate": "2025-12-01",
  "surgeon": "Dr. Sarah Surgeon",
  "hospital": "Metro Hospital",
  "anesthesiaType": "General",
  "duration": 90,
  "complications": "None",
  "notes": "Laparoscopic cholecystectomy, patient tolerated well"
}
```

**Response (201):** Created surgical history object

#### PATCH /api/surgical-history/:id
Update surgical history record.

**Authentication:** Required

**Request:**
```json
{
  "notes": "Updated: Follow-up shows excellent recovery"
}
```

**Response (200):** Updated surgical history object

#### DELETE /api/surgical-history/:id
Delete surgical history record.

**Authentication:** Required

**Response (200):**
```json
{
  "message": "Record deleted successfully"
}
```

---

### Payment History

#### GET /api/payment-history
List payment history records.

**Authentication:** Required
**Query Parameters:**
- `hospitalId` (string) - Filter by hospital/organization
- `status` (string): completed, pending, failed

**Response (200):**
```json
{
  "data": [
    {
      "id": "payment-id",
      "hospitalId": "org-id",
      "subscriptionPlanId": "plan-id",
      "subscriptionPlan": {
        "name": "Professional Plan",
        "price": 299.00
      },
      "amount": 299.00,
      "paymentDate": "2025-12-01",
      "paymentMethod": "credit_card",
      "transactionId": "TXN20251201001",
      "status": "completed",
      "billingPeriodStart": "2025-12-01",
      "billingPeriodEnd": "2025-12-31"
    }
  ],
  "count": 50
}
```

#### GET /api/payment-history/:id
Get payment history record by ID.

**Authentication:** Required

**Response (200):** Full payment history object with subscription plan details

#### POST /api/payment-history
Create payment history record.

**Authentication:** Required

**Request:**
```json
{
  "hospitalId": "org-id",
  "subscriptionPlanId": "plan-id",
  "amount": 299.00,
  "paymentDate": "2025-12-02",
  "paymentMethod": "credit_card",
  "transactionId": "TXN20251202001",
  "status": "completed",
  "billingPeriodStart": "2025-12-02",
  "billingPeriodEnd": "2026-01-02"
}
```

**Response (201):** Created payment history object

#### PATCH /api/payment-history/:id
Update payment history record.

**Authentication:** Required

**Request:**
```json
{
  "status": "completed",
  "transactionId": "TXN20251202001"
}
```

**Response (200):** Updated payment history object

---

### Dashboard Statistics

#### GET /api/stats/dashboard
Get platform-wide dashboard statistics.

**Authentication:** Required (SuperAdmin only)

**Response (200):**
```json
{
  "data": {
    "subscriptionPlans": {
      "total": 5,
      "active": 5
    },
    "promotions": {
      "total": 8,
      "active": 3
    },
    "payments": {
      "total": 1250
    },
    "revenue": {
      "total": 373750.00
    }
  }
}
```

---

## Appendix

### Date Formats

All dates are in ISO 8601 format:
- Date only: `YYYY-MM-DD` (e.g., `2025-12-02`)
- DateTime: `YYYY-MM-DDTHH:mm:ss.sssZ` (e.g., `2025-12-02T10:30:00.000Z`)

### Payment Methods

Supported payment methods:
- `cash` - Cash payment
- `card` - Credit/debit card
- `online` - Online payment gateway
- `insurance` - Insurance claim
- `cheque` - Cheque payment

### User Roles

- `SuperAdmin` - Platform administrator with access to all organizations
- `HospitalAdmin` - Organization administrator
- `Doctor` - Medical practitioner
- `Nurse` - Nursing staff
- `Pharmacist` - Pharmacy staff
- `Receptionist` - Front desk staff
- `Lab Technician` - Laboratory staff
- `Radiologist` - Radiology staff

### Status Values

**Patient Status:**
- `active` - Active patient
- `inactive` - Inactive/archived patient

**Invoice Status:**
- `pending` - No payment received
- `partial` - Partial payment received
- `paid` - Fully paid

**Appointment Status:**
- `scheduled` - Appointment scheduled
- `confirmed` - Patient confirmed attendance
- `completed` - Appointment completed
- `cancelled` - Appointment cancelled

**Lab Test Status:**
- `ordered` - Test ordered
- `sample_collected` - Sample collected
- `processing` - Test in progress
- `completed` - Results available
- `cancelled` - Test cancelled

**Radiology Test Status:**
- `ordered` - Test ordered
- `scheduled` - Appointment scheduled
- `image_captured` - Images captured
- `completed` - Report available
- `cancelled` - Test cancelled

**Prescription Status:**
- `pending` - Not yet fulfilled
- `fulfilled` - Medicines dispensed
- `cancelled` - Prescription cancelled

---

## Support

For API support or questions:
- **Email:** support@hospital-saas.com
- **Documentation:** https://hospital-api.alexandratechlab.com/docs
- **Status:** https://status.alexandratechlab.com

---

**Hospital SaaS Backend API**
Version 1.0 | December 2, 2025
© 2025 Hospital SaaS Platform. All rights reserved.
