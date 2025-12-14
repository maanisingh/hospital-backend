const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcrypt');

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting database seed...');

  // Create Demo Hospital organization
  const demoOrg = await prisma.organization.upsert({
    where: { code: 'DEMO001' },
    update: {},
    create: {
      code: 'DEMO001',
      name: 'Demo Hospital',
      businessName: 'Demo Hospital Pvt Ltd',
      address: '123 Healthcare Street',
      city: 'Demo City',
      state: 'Demo State',
      pincode: '100001',
      country: 'Country',
      phone: '+1234567890',
      email: 'info@demohospital.com',
      status: 'active'
    }
  });

  console.log('✅ Created/Updated organization:', demoOrg.name);
  console.log('   Organization ID:', demoOrg.id);

  // Hash password for all users (admin123)
  const hashedPassword = await bcrypt.hash('admin123', 10);

  // All 15 users matching the login page
  const users = [
    {
      email: 'superadmin@hospital.com',
      firstName: 'Super',
      lastName: 'Admin',
      role: 'SuperAdmin',
      orgId: null // SuperAdmin is not tied to any organization
    },
    {
      email: 'admin@hospital.com',
      firstName: 'Admin',
      lastName: 'User',
      role: 'HospitalAdmin',
      orgId: demoOrg.id
    },
    {
      email: 'doctor@hospital.com',
      firstName: 'John',
      lastName: 'Smith',
      role: 'Doctor',
      orgId: demoOrg.id
    },
    {
      email: 'nurse@hospital.com',
      firstName: 'Mary',
      lastName: 'Johnson',
      role: 'Nurse',
      orgId: demoOrg.id
    },
    {
      email: 'receptionist@hospital.com',
      firstName: 'Lisa',
      lastName: 'Brown',
      role: 'Receptionist',
      orgId: demoOrg.id
    },
    {
      email: 'pharmacist@hospital.com',
      firstName: 'Mike',
      lastName: 'Wilson',
      role: 'Pharmacist',
      orgId: demoOrg.id
    },
    {
      email: 'labtech@hospital.com',
      firstName: 'Sarah',
      lastName: 'Davis',
      role: 'LabTechnician',
      orgId: demoOrg.id
    },
    {
      email: 'radiologist@hospital.com',
      firstName: 'James',
      lastName: 'Miller',
      role: 'Radiologist',
      orgId: demoOrg.id
    },
    {
      email: 'billing@hospital.com',
      firstName: 'Emily',
      lastName: 'Garcia',
      role: 'Billing',
      orgId: demoOrg.id
    },
    {
      email: 'accountant@hospital.com',
      firstName: 'Robert',
      lastName: 'Taylor',
      role: 'Accountant',
      orgId: demoOrg.id
    },
    {
      email: 'hr@hospital.com',
      firstName: 'Jennifer',
      lastName: 'Anderson',
      role: 'HRManager',
      orgId: demoOrg.id
    },
    {
      email: 'records@hospital.com',
      firstName: 'Patricia',
      lastName: 'White',
      role: 'MedicalRecords',
      orgId: demoOrg.id
    },
    {
      email: 'inventory@hospital.com',
      firstName: 'Michael',
      lastName: 'Brown',
      role: 'InventoryManager',
      orgId: demoOrg.id
    },
    {
      email: 'dietitian@hospital.com',
      firstName: 'Laura',
      lastName: 'Martinez',
      role: 'Dietitian',
      orgId: demoOrg.id
    },
    {
      email: 'physiotherapist@hospital.com',
      firstName: 'David',
      lastName: 'Garcia',
      role: 'Physiotherapist',
      orgId: demoOrg.id
    },
    {
      email: 'patient@hospital.com',
      firstName: 'John',
      lastName: 'Patient',
      role: 'Patient',
      orgId: demoOrg.id
    }
  ];

  // Create all users
  for (const userData of users) {
    const user = await prisma.user.upsert({
      where: { email: userData.email },
      update: {},
      create: {
        email: userData.email,
        password: hashedPassword,
        firstName: userData.firstName,
        lastName: userData.lastName,
        role: userData.role,
        phone: '+1234567890',
        status: 'active',
        orgId: userData.orgId
      }
    });

    console.log(`✅ Created/Updated ${userData.role}: ${user.email}`);
  }

  console.log('');
  console.log('🎉 Seed completed successfully!');
  console.log('');
  console.log('📝 Login Credentials:');
  console.log('');
  console.log('All users use password: admin123');
  console.log('');
  console.log('SuperAdmin:');
  console.log('  Email: superadmin@hospital.com');
  console.log('');
  console.log('Hospital Roles (Demo Hospital):');
  console.log('  Hospital Admin: admin@hospital.com');
  console.log('  Doctor: doctor@hospital.com');
  console.log('  Nurse: nurse@hospital.com');
  console.log('  Receptionist: receptionist@hospital.com');
  console.log('  Pharmacist: pharmacist@hospital.com');
  console.log('  Lab Technician: labtech@hospital.com');
  console.log('  Radiologist: radiologist@hospital.com');
  console.log('  Billing: billing@hospital.com');
  console.log('  Accountant: accountant@hospital.com');
  console.log('  HR Manager: hr@hospital.com');
  console.log('  Medical Records: records@hospital.com');
  console.log('  Inventory Manager: inventory@hospital.com');
  console.log('  Dietitian: dietitian@hospital.com');
  console.log('  Physiotherapist: physiotherapist@hospital.com');
  console.log('');
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
