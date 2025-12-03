const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcrypt');

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting database seed...');

  // Create default organization
  const org = await prisma.organization.upsert({
    where: { code: 'h001' },
    update: {},
    create: {
      code: 'h001',
      name: 'Demo Hospital',
      businessName: 'Demo Hospital Pvt Ltd',
      address: '123 Medical Street',
      city: 'Demo City',
      state: 'Demo State',
      pincode: '123456',
      country: 'Demo Country',
      phone: '+1234567890',
      email: 'info@demohospital.com',
      status: 'active'
    }
  });

  console.log('✅ Created/Updated organization:', org.name);

  // Create super admin user
  const hashedPassword = await bcrypt.hash('admin123', 10);

  const superAdmin = await prisma.user.upsert({
    where: { email: 'superadmin@hospital.com' },
    update: {},
    create: {
      email: 'superadmin@hospital.com',
      password: hashedPassword,
      firstName: 'Super',
      lastName: 'Admin',
      role: 'SuperAdmin',
      phone: '+1234567890',
      status: 'active'
    }
  });

  console.log('✅ Created/Updated super admin:', superAdmin.email);

  // Create demo admin user for the organization
  const adminPassword = await bcrypt.hash('admin123', 10);

  const admin = await prisma.user.upsert({
    where: { email: 'admin@demohospital.com' },
    update: {},
    create: {
      email: 'admin@demohospital.com',
      password: adminPassword,
      firstName: 'Hospital',
      lastName: 'Admin',
      role: 'HospitalAdmin',
      phone: '+1234567891',
      status: 'active',
      orgId: org.id
    }
  });

  console.log('✅ Created/Updated hospital admin:', admin.email);

  console.log('');
  console.log('🎉 Seed completed successfully!');
  console.log('');
  console.log('📝 Login Credentials:');
  console.log('');
  console.log('Super Admin:');
  console.log('  Email: superadmin@hospital.com');
  console.log('  Password: admin123');
  console.log('');
  console.log('Hospital Admin:');
  console.log('  Email: admin@demohospital.com');
  console.log('  Password: admin123');
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
