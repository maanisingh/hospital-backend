#!/usr/bin/env node

/**
 * Create test users for all RBAC roles
 * This creates one user for each role to test permissions
 */

const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcrypt');

const prisma = new PrismaClient();

// Test users for each role
const testUsers = [
  {
    email: 'superadmin@hospital.com',
    password: 'admin123',
    firstName: 'Super',
    lastName: 'Admin',
    role: 'SuperAdmin',
    orgId: null, // SuperAdmin has no specific org
    phone: '+1234567890',
    status: 'active'
  },
  {
    email: 'hospitaladmin@hospital.com',
    password: 'admin123',
    firstName: 'Hospital',
    lastName: 'Admin',
    role: 'HospitalAdmin',
    orgId: '137161a0-8e87-4147-85c7-a703bc15372d', // Will be set to test org
    phone: '+1234567891',
    status: 'active'
  },
  {
    email: 'doctor@hospital.com',
    password: 'doctor123',
    firstName: 'Dr. John',
    lastName: 'Smith',
    role: 'Doctor',
    orgId: '137161a0-8e87-4147-85c7-a703bc15372d',
    phone: '+1234567892',
    status: 'active'
  },
  {
    email: 'nurse@hospital.com',
    password: 'nurse123',
    firstName: 'Mary',
    lastName: 'Johnson',
    role: 'Nurse',
    orgId: '137161a0-8e87-4147-85c7-a703bc15372d',
    phone: '+1234567893',
    status: 'active'
  },
  {
    email: 'receptionist@hospital.com',
    password: 'reception123',
    firstName: 'Lisa',
    lastName: 'Brown',
    role: 'Receptionist',
    orgId: '137161a0-8e87-4147-85c7-a703bc15372d',
    phone: '+1234567894',
    status: 'active'
  },
  {
    email: 'pharmacist@hospital.com',
    password: 'pharma123',
    firstName: 'Mike',
    lastName: 'Wilson',
    role: 'Pharmacist',
    orgId: '137161a0-8e87-4147-85c7-a703bc15372d',
    phone: '+1234567895',
    status: 'active'
  },
  {
    email: 'labtech@hospital.com',
    password: 'lab123',
    firstName: 'Sarah',
    lastName: 'Davis',
    role: 'LabTechnician',
    orgId: '137161a0-8e87-4147-85c7-a703bc15372d',
    phone: '+1234567896',
    status: 'active'
  },
  {
    email: 'radiologist@hospital.com',
    password: 'radio123',
    firstName: 'Dr. James',
    lastName: 'Miller',
    role: 'Radiologist',
    orgId: '137161a0-8e87-4147-85c7-a703bc15372d',
    phone: '+1234567897',
    status: 'active'
  },
  {
    email: 'billing@hospital.com',
    password: 'billing123',
    firstName: 'Emily',
    lastName: 'Garcia',
    role: 'Billing',
    orgId: '137161a0-8e87-4147-85c7-a703bc15372d',
    phone: '+1234567898',
    status: 'active'
  }
];

async function createTestUsers() {
  console.log('🔒 Creating RBAC Test Users');
  console.log('============================\n');

  try {
    // Get or create test organization
    let org = await prisma.organization.findFirst({
      where: { code: 'h101' }
    });

    if (!org) {
      console.log('📋 Creating test organization...');
      org = await prisma.organization.create({
        data: {
          code: 'h101',
          name: 'Test Hospital',
          businessName: 'Test Hospital Inc.',
          address: '123 Test St',
          city: 'Test City',
          state: 'Test State',
          pincode: '123456',
          country: 'Test Country',
          phone: '+1234567899',
          email: 'test@hospital.com',
          status: 'active'
        }
      });
      console.log(`✅ Created organization: ${org.name} (${org.id})\n`);
    } else {
      console.log(`✅ Using existing organization: ${org.name} (${org.id})\n`);
    }

    // Update orgId for all non-SuperAdmin users
    testUsers.forEach(user => {
      if (user.role !== 'SuperAdmin') {
        user.orgId = org.id;
      }
    });

    // Create users
    console.log('👥 Creating test users...\n');

    for (const userData of testUsers) {
      try {
        // Check if user already exists
        const existingUser = await prisma.user.findUnique({
          where: { email: userData.email }
        });

        if (existingUser) {
          // Update existing user
          const hashedPassword = await bcrypt.hash(userData.password, 10);
          await prisma.user.update({
            where: { email: userData.email },
            data: {
              password: hashedPassword,
              firstName: userData.firstName,
              lastName: userData.lastName,
              role: userData.role,
              orgId: userData.orgId,
              phone: userData.phone,
              status: userData.status
            }
          });
          console.log(`🔄 Updated: ${userData.email} (${userData.role})`);
        } else {
          // Create new user
          const hashedPassword = await bcrypt.hash(userData.password, 10);
          await prisma.user.create({
            data: {
              email: userData.email,
              password: hashedPassword,
              firstName: userData.firstName,
              lastName: userData.lastName,
              role: userData.role,
              orgId: userData.orgId,
              phone: userData.phone,
              status: userData.status
            }
          });
          console.log(`✅ Created: ${userData.email} (${userData.role})`);
        }
      } catch (error) {
        console.error(`❌ Error creating ${userData.email}:`, error.message);
      }
    }

    console.log('\n✅ All test users created/updated successfully!\n');
    console.log('📋 Test User Credentials:');
    console.log('==========================');
    console.log('\nSuperAdmin:');
    console.log('  Email: superadmin@hospital.com');
    console.log('  Password: admin123');
    console.log('  Access: All organizations, all permissions\n');

    console.log('HospitalAdmin:');
    console.log('  Email: hospitaladmin@hospital.com');
    console.log('  Password: admin123');
    console.log('  Access: Own organization, admin permissions\n');

    console.log('Doctor:');
    console.log('  Email: doctor@hospital.com');
    console.log('  Password: doctor123');
    console.log('  Access: Patients, OPD, IPD, Prescriptions, Lab/Radiology orders\n');

    console.log('Nurse:');
    console.log('  Email: nurse@hospital.com');
    console.log('  Password: nurse123');
    console.log('  Access: Patients, OPD queue, IPD management, Lab samples\n');

    console.log('Receptionist:');
    console.log('  Email: receptionist@hospital.com');
    console.log('  Password: reception123');
    console.log('  Access: Appointments, OPD tokens, Patient registration\n');

    console.log('Pharmacist:');
    console.log('  Email: pharmacist@hospital.com');
    console.log('  Password: pharma123');
    console.log('  Access: Medicines, Prescriptions, Pharmacy orders\n');

    console.log('LabTechnician:');
    console.log('  Email: labtech@hospital.com');
    console.log('  Password: lab123');
    console.log('  Access: Lab tests processing, results entry\n');

    console.log('Radiologist:');
    console.log('  Email: radiologist@hospital.com');
    console.log('  Password: radio123');
    console.log('  Access: Radiology tests, imaging results\n');

    console.log('Billing:');
    console.log('  Email: billing@hospital.com');
    console.log('  Password: billing123');
    console.log('  Access: Invoices, payments, billing reports\n');

    console.log('🧪 Use these credentials to test RBAC permissions!');

  } catch (error) {
    console.error('\n❌ Error:', error.message);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Run the script
createTestUsers()
  .then(() => {
    console.log('\n✨ Done!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n💥 Script failed:', error);
    process.exit(1);
  });
