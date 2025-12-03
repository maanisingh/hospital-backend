// Create test users for Hospital SaaS
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcrypt');

const prisma = new PrismaClient();

async function main() {
  console.log('Creating test users...');

  // Password: admin123
  const hashedPassword = await bcrypt.hash('admin123', 10);

  const users = [
    {
      email: 'superadmin@hospital.com',
      password: hashedPassword,
      firstName: 'Super',
      lastName: 'Admin',
      role: 'SuperAdmin',
      orgId: null,
      status: 'active'
    },
    {
      email: 'admin@hospital.com',
      password: hashedPassword,
      firstName: 'Hospital',
      lastName: 'Admin',
      role: 'Hospital Admin',
      orgId: '00000000-0000-0000-0000-000000000001', // Demo org
      status: 'active'
    },
    {
      email: 'doctor@hospital.com',
      password: hashedPassword,
      firstName: 'Dr. John',
      lastName: 'Smith',
      role: 'Doctor',
      orgId: '00000000-0000-0000-0000-000000000001',
      status: 'active'
    },
    {
      email: 'nurse@hospital.com',
      password: hashedPassword,
      firstName: 'Jane',
      lastName: 'Doe',
      role: 'Nurse',
      orgId: '00000000-0000-0000-0000-000000000001',
      status: 'active'
    }
  ];

  for (const userData of users) {
    try {
      const user = await prisma.user.upsert({
        where: { email: userData.email },
        update: userData,
        create: userData
      });
      console.log(`✅ Created/Updated user: ${user.email} (${user.role})`);
    } catch (error) {
      console.error(`❌ Error creating user ${userData.email}:`, error.message);
    }
  }

  console.log('\n📝 Test Credentials:');
  console.log('Email: superadmin@hospital.com | Password: admin123 | Role: SuperAdmin');
  console.log('Email: admin@hospital.com     | Password: admin123 | Role: Hospital Admin');
  console.log('Email: doctor@hospital.com    | Password: admin123 | Role: Doctor');
  console.log('Email: nurse@hospital.com     | Password: admin123 | Role: Nurse');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
