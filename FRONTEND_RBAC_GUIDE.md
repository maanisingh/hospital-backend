# Frontend RBAC Implementation Guide

## Overview
This guide explains how to implement Role-Based Access Control in the Hospital SaaS frontend using React/Next.js.

---

## Backend Setup (✅ Complete)

The backend now has:
- ✅ 9 user roles with defined permissions
- ✅ RBAC middleware on all routes
- ✅ User management API
- ✅ Test users for each role

---

## Frontend Implementation Steps

### 1. Create Permission Constants

Create `lib/permissions.ts`:

```typescript
export const ROLES = {
  SUPER_ADMIN: 'SuperAdmin',
  HOSPITAL_ADMIN: 'HospitalAdmin',
  DOCTOR: 'Doctor',
  NURSE: 'Nurse',
  RECEPTIONIST: 'Receptionist',
  PHARMACIST: 'Pharmacist',
  LAB_TECHNICIAN: 'LabTechnician',
  RADIOLOGIST: 'Radiologist',
  BILLING: 'Billing'
} as const;

export type Role = typeof ROLES[keyof typeof ROLES];

export const PERMISSION_GROUPS = {
  // All users
  ALL_USERS: Object.values(ROLES),

  // Admin roles
  ADMINS: [ROLES.SUPER_ADMIN, ROLES.HOSPITAL_ADMIN],

  // Patient management
  PATIENT_ACCESS: [ROLES.SUPER_ADMIN, ROLES.HOSPITAL_ADMIN, ROLES.DOCTOR, ROLES.NURSE, ROLES.RECEPTIONIST],
  PATIENT_WRITE: [ROLES.SUPER_ADMIN, ROLES.HOSPITAL_ADMIN, ROLES.DOCTOR, ROLES.NURSE, ROLES.RECEPTIONIST],

  // OPD/Appointments
  OPD_ACCESS: [ROLES.SUPER_ADMIN, ROLES.HOSPITAL_ADMIN, ROLES.DOCTOR, ROLES.NURSE, ROLES.RECEPTIONIST],

  // Medical staff
  MEDICAL_STAFF: [ROLES.DOCTOR, ROLES.NURSE],

  // Pharmacy
  PHARMACY_READ: [ROLES.SUPER_ADMIN, ROLES.HOSPITAL_ADMIN, ROLES.DOCTOR, ROLES.PHARMACIST],
  PHARMACY_MANAGE: [ROLES.SUPER_ADMIN, ROLES.HOSPITAL_ADMIN, ROLES.PHARMACIST],

  // Lab
  LAB_ORDER: [ROLES.SUPER_ADMIN, ROLES.HOSPITAL_ADMIN, ROLES.DOCTOR, ROLES.NURSE],
  LAB_PROCESS: [ROLES.SUPER_ADMIN, ROLES.HOSPITAL_ADMIN, ROLES.NURSE, ROLES.LAB_TECHNICIAN],

  // Billing
  BILLING_VIEW: [ROLES.SUPER_ADMIN, ROLES.HOSPITAL_ADMIN, ROLES.DOCTOR, ROLES.RECEPTIONIST, ROLES.BILLING],
  BILLING_MANAGE: [ROLES.SUPER_ADMIN, ROLES.HOSPITAL_ADMIN, ROLES.RECEPTIONIST, ROLES.BILLING],

  // Organization
  ORG_VIEW: [ROLES.SUPER_ADMIN, ROLES.HOSPITAL_ADMIN],
  ORG_MANAGE: [ROLES.SUPER_ADMIN],

  // User management
  USER_MANAGE: [ROLES.SUPER_ADMIN, ROLES.HOSPITAL_ADMIN]
} as const;
```

---

### 2. Create Permission Hook

Create `hooks/usePermissions.ts`:

```typescript
import { useUser } from '@/contexts/UserContext'; // Your user context
import { PERMISSION_GROUPS, Role } from '@/lib/permissions';

export function usePermissions() {
  const { user } = useUser();

  const hasPermission = (permissionGroup: keyof typeof PERMISSION_GROUPS): boolean => {
    if (!user || !user.role) return false;

    const allowedRoles = PERMISSION_GROUPS[permissionGroup];
    return allowedRoles.includes(user.role as Role);
  };

  const hasRole = (role: Role): boolean => {
    if (!user) return false;
    return user.role === role;
  };

  const hasAnyRole = (roles: Role[]): boolean => {
    if (!user) return false;
    return roles.includes(user.role as Role);
  };

  const isAdmin = (): boolean => {
    return hasAnyRole([ROLES.SUPER_ADMIN, ROLES.HOSPITAL_ADMIN]);
  };

  const isSuperAdmin = (): boolean => {
    return hasRole(ROLES.SUPER_ADMIN);
  };

  return {
    hasPermission,
    hasRole,
    hasAnyRole,
    isAdmin,
    isSuperAdmin,
    userRole: user?.role
  };
}
```

---

### 3. Create Permission Components

Create `components/rbac/RequirePermission.tsx`:

```typescript
import { ReactNode } from 'react';
import { usePermissions } from '@/hooks/usePermissions';
import { PERMISSION_GROUPS } from '@/lib/permissions';

interface RequirePermissionProps {
  permission: keyof typeof PERMISSION_GROUPS;
  children: ReactNode;
  fallback?: ReactNode;
}

export function RequirePermission({ permission, children, fallback = null }: RequirePermissionProps) {
  const { hasPermission } = usePermissions();

  if (!hasPermission(permission)) {
    return <>{fallback}</>;
  }

  return <>{children}</>;
}
```

Create `components/rbac/RequireRole.tsx`:

```typescript
import { ReactNode } from 'react';
import { usePermissions } from '@/hooks/usePermissions';
import { Role } from '@/lib/permissions';

interface RequireRoleProps {
  roles: Role[];
  children: ReactNode;
  fallback?: ReactNode;
}

export function RequireRole({ roles, children, fallback = null }: RequireRoleProps) {
  const { hasAnyRole } = usePermissions();

  if (!hasAnyRole(roles)) {
    return <>{fallback}</>;
  }

  return <>{children}</>;
}
```

---

### 4. Create Protected Route Component

Create `components/rbac/ProtectedRoute.tsx`:

```typescript
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { usePermissions } from '@/hooks/usePermissions';
import { Role } from '@/lib/permissions';

interface ProtectedRouteProps {
  children: React.ReactNode;
  allowedRoles?: Role[];
  permission?: keyof typeof PERMISSION_GROUPS;
  redirectTo?: string;
}

export function ProtectedRoute({
  children,
  allowedRoles,
  permission,
  redirectTo = '/unauthorized'
}: ProtectedRouteProps) {
  const router = useRouter();
  const { hasAnyRole, hasPermission } = usePermissions();

  useEffect(() => {
    // Check role-based access
    if (allowedRoles && !hasAnyRole(allowedRoles)) {
      router.push(redirectTo);
      return;
    }

    // Check permission-based access
    if (permission && !hasPermission(permission)) {
      router.push(redirectTo);
      return;
    }
  }, [allowedRoles, permission, redirectTo]);

  // Show loading or check access
  if (allowedRoles && !hasAnyRole(allowedRoles)) {
    return null;
  }

  if (permission && !hasPermission(permission)) {
    return null;
  }

  return <>{children}</>;
}
```

---

### 5. Update Navigation Menu

In `components/nav/Sidebar.tsx` or similar:

```typescript
import { usePermissions } from '@/hooks/usePermissions';

export function Sidebar() {
  const { hasPermission, isAdmin } = usePermissions();

  const menuItems = [
    {
      label: 'Dashboard',
      href: '/dashboard',
      icon: HomeIcon,
      show: true // Everyone can see dashboard
    },
    {
      label: 'Patients',
      href: '/patients',
      icon: UsersIcon,
      show: hasPermission('PATIENT_ACCESS')
    },
    {
      label: 'Appointments',
      href: '/appointments',
      icon: CalendarIcon,
      show: hasPermission('OPD_ACCESS')
    },
    {
      label: 'Pharmacy',
      href: '/pharmacy',
      icon: PillIcon,
      show: hasPermission('PHARMACY_READ')
    },
    {
      label: 'Lab Tests',
      href: '/lab',
      icon: TestTubeIcon,
      show: hasPermission('LAB_ORDER')
    },
    {
      label: 'Billing',
      href: '/billing',
      icon: DollarIcon,
      show: hasPermission('BILLING_VIEW')
    },
    {
      label: 'User Management',
      href: '/users',
      icon: UsersIcon,
      show: hasPermission('USER_MANAGE')
    },
    {
      label: 'Settings',
      href: '/settings',
      icon: SettingsIcon,
      show: isAdmin()
    }
  ];

  return (
    <nav>
      {menuItems
        .filter(item => item.show)
        .map(item => (
          <Link key={item.href} href={item.href}>
            <item.icon />
            {item.label}
          </Link>
        ))
      }
    </nav>
  );
}
```

---

### 6. Usage Examples

#### Hide/Show Buttons Based on Permissions

```typescript
import { RequirePermission } from '@/components/rbac/RequirePermission';

export function PatientList() {
  return (
    <div>
      <h1>Patients</h1>

      {/* Only show to users with PATIENT_WRITE permission */}
      <RequirePermission permission="PATIENT_WRITE">
        <Button onClick={handleCreatePatient}>
          Create New Patient
        </Button>
      </RequirePermission>

      {/* Patient list visible to all with PATIENT_ACCESS */}
      <PatientTable />
    </div>
  );
}
```

#### Protect Entire Pages

```typescript
// app/(dashboard)/users/page.tsx
import { ProtectedRoute } from '@/components/rbac/ProtectedRoute';

export default function UsersPage() {
  return (
    <ProtectedRoute permission="USER_MANAGE">
      <div>
        <h1>User Management</h1>
        <UserList />
      </div>
    </ProtectedRoute>
  );
}
```

#### Conditional Rendering in Components

```typescript
import { usePermissions } from '@/hooks/usePermissions';

export function PatientActions({ patient }: { patient: Patient }) {
  const { hasPermission, hasRole } = usePermissions();

  return (
    <div className="flex gap-2">
      {/* Everyone with PATIENT_ACCESS can view */}
      <Button onClick={() => viewPatient(patient)}>
        View
      </Button>

      {/* Only users with PATIENT_WRITE can edit */}
      {hasPermission('PATIENT_WRITE') && (
        <Button onClick={() => editPatient(patient)}>
          Edit
        </Button>
      )}

      {/* Only admins can delete */}
      {hasRole('HospitalAdmin') || hasRole('SuperAdmin') ? (
        <Button onClick={() => deletePatient(patient)} variant="destructive">
          Delete
        </Button>
      ) : null}
    </div>
  );
}
```

---

### 7. User Management Page

Create `app/(dashboard)/users/page.tsx`:

```typescript
'use client';

import { useState, useEffect } from 'react';
import { ProtectedRoute } from '@/components/rbac/ProtectedRoute';
import { usePermissions } from '@/hooks/usePermissions';
import { api } from '@/lib/api';

export default function UsersPage() {
  const [users, setUsers] = useState([]);
  const [availableRoles, setAvailableRoles] = useState([]);
  const { isSuperAdmin } = usePermissions();

  useEffect(() => {
    // Fetch users
    api.get('/users').then(res => setUsers(res.data.data));

    // Fetch available roles
    api.get('/users/roles/available').then(res => setAvailableRoles(res.data.data));
  }, []);

  return (
    <ProtectedRoute permission="USER_MANAGE">
      <div className="p-6">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-3xl font-bold">User Management</h1>
          <Button onClick={handleCreateUser}>
            Create New User
          </Button>
        </div>

        <UsersTable users={users} availableRoles={availableRoles} />
      </div>
    </ProtectedRoute>
  );
}
```

---

## Test User Credentials

Use these credentials to test different role permissions:

| Role | Email | Password | Access Level |
|------|-------|----------|--------------|
| SuperAdmin | superadmin@hospital.com | admin123 | Full access |
| HospitalAdmin | hospitaladmin@hospital.com | admin123 | Organization admin |
| Doctor | doctor@hospital.com | doctor123 | Clinical access |
| Nurse | nurse@hospital.com | nurse123 | Clinical support |
| Receptionist | receptionist@hospital.com | reception123 | Front desk |
| Pharmacist | pharmacist@hospital.com | pharma123 | Pharmacy only |
| LabTechnician | labtech@hospital.com | lab123 | Lab only |
| Radiologist | radiologist@hospital.com | radio123 | Radiology only |
| Billing | billing@hospital.com | billing123 | Billing only |

---

## Implementation Checklist

### Backend (✅ Complete)
- [x] RBAC middleware created
- [x] Permissions matrix defined
- [x] User management API created
- [x] Test users for all 9 roles created
- [x] RBAC imports added to all route files

### Frontend (⏳ To Do)
- [ ] Create `lib/permissions.ts` with role constants
- [ ] Create `hooks/usePermissions.ts` hook
- [ ] Create `RequirePermission` component
- [ ] Create `RequireRole` component
- [ ] Create `ProtectedRoute` component
- [ ] Update navigation menu to show/hide based on permissions
- [ ] Create User Management page
- [ ] Update all pages to use RBAC components
- [ ] Test with different user roles
- [ ] Document role assignments for client

---

## Quick Start

1. **Copy** the permission constants to your frontend: `lib/permissions.ts`
2. **Create** the usePermissions hook: `hooks/usePermissions.ts`
3. **Create** RBAC components: `RequirePermission`, `RequireRole`, `ProtectedRoute`
4. **Update** your navigation/sidebar to filter menu items by permission
5. **Wrap** sensitive pages/components with permission checks
6. **Test** by logging in as different roles

---

## API Endpoints for Frontend

### User Management
- `GET /api/users` - List users (Admin only)
- `GET /api/users/:id` - Get user details (Admin only)
- `POST /api/users` - Create new user (Admin only)
- `PATCH /api/users/:id` - Update user (Admin only)
- `DELETE /api/users/:id` - Delete user (Admin only)
- `GET /api/users/roles/available` - Get roles current user can assign

### Authentication
- `POST /auth/login` - Login with email/password
- `GET /auth/me` - Get current user info
- `POST /auth/logout` - Logout

---

## Best Practices

1. **Always check permissions on both frontend AND backend**
   - Frontend: UX (hide buttons/pages)
   - Backend: Security (enforce access control)

2. **Use permission groups, not individual roles**
   - ✅ `hasPermission('PATIENT_WRITE')`
   - ❌ `hasRole('Doctor') || hasRole('Nurse') || ...`

3. **Fail securely**
   - Default to denying access
   - Show appropriate error messages
   - Log permission denials for audit

4. **Test thoroughly**
   - Login as each role
   - Try accessing restricted pages
   - Verify API calls are blocked

---

## Support

For questions or issues with RBAC implementation:
1. Check `RBAC_DESIGN.md` for permissions matrix
2. Review `middleware/rbac.js` for backend implementation
3. Test with provided test user credentials
4. Verify JWT token includes correct role

---

*Generated for Hospital SaaS Platform - December 3, 2025*
