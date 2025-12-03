const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcrypt');

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting database seed...');

  // Create City General Hospital organization
  const cityGeneralOrg = await prisma.organization.upsert({
    where: { code: 'cgh001' },
    update: {},
    create: {
      code: 'cgh001',
      name: 'City General Hospital',
      businessName: 'City General Hospital Pvt Ltd',
      address: '456 Healthcare Ave',
      city: 'Metro City',
      state: 'State',
      pincode: '100001',
      country: 'Country',
      phone: '+1234567890',
      email: 'info@citygeneralhospital.com',
      subdomain: 'citygeneralhospital',
      status: 'active'
    }
  });

  console.log('✅ Created/Updated organization:', cityGeneralOrg.name);

  // Hash passwords for all users
  const superAdminPass = await bcrypt.hash('NovoraPlus@2024!', 10);
  const hospitalAdminPass = await bcrypt.hash('Hospital@2024!', 10);
  const staffPass = await bcrypt.hash('Staff@2024!', 10);

  // Create super admin user (NovoraPlus admin)
  const superAdmin = await prisma.user.upsert({
    where: { email: 'admin@novoraplus.com' },
    update: {},
    create: {
      email: 'admin@novoraplus.com',
      password: superAdminPass,
      firstName: 'NovoraPlus',
      lastName: 'Admin',
      role: 'SuperAdmin',
      phone: '+1234567890',
      status: 'active'
    }
  });

  console.log('✅ Created/Updated super admin:', superAdmin.email);

  // Create hospital admin for City General Hospital
  const hospitalAdmin = await prisma.user.upsert({
    where: { email: 'admin@citygeneralhospital.com' },
    update: {},
    create: {
      email: 'admin@citygeneralhospital.com',
      password: hospitalAdminPass,
      firstName: 'Hospital',
      lastName: 'Admin',
      role: 'HospitalAdmin',
      phone: '+1234567891',
      status: 'active',
      orgId: cityGeneralOrg.id
    }
  });

  console.log('✅ Created/Updated hospital admin:', hospitalAdmin.email);

  // Create doctor
  const doctor = await prisma.user.upsert({
    where: { email: 'doctor@citygeneralhospital.com' },
    update: {},
    create: {
      email: 'doctor@citygeneralhospital.com',
      password: staffPass,
      firstName: 'John',
      lastName: 'Smith',
      role: 'Doctor',
      phone: '+1234567892',
      status: 'active',
      orgId: cityGeneralOrg.id
    }
  });

  console.log('✅ Created/Updated doctor:', doctor.email);

  // Create nurse
  const nurse = await prisma.user.upsert({
    where: { email: 'nurse@citygeneralhospital.com' },
    update: {},
    create: {
      email: 'nurse@citygeneralhospital.com',
      password: staffPass,
      firstName: 'Sarah',
      lastName: 'Johnson',
      role: 'Nurse',
      phone: '+1234567893',
      status: 'active',
      orgId: cityGeneralOrg.id
    }
  });

  console.log('✅ Created/Updated nurse:', nurse.email);

  // Create receptionist
  const receptionist = await prisma.user.upsert({
    where: { email: 'reception@citygeneralhospital.com' },
    update: {},
    create: {
      email: 'reception@citygeneralhospital.com',
      password: staffPass,
      firstName: 'Emily',
      lastName: 'Davis',
      role: 'Receptionist',
      phone: '+1234567894',
      status: 'active',
      orgId: cityGeneralOrg.id
    }
  });

  console.log('✅ Created/Updated receptionist:', receptionist.email);

  // Create lab technician
  const labTech = await prisma.user.upsert({
    where: { email: 'lab@citygeneralhospital.com' },
    update: {},
    create: {
      email: 'lab@citygeneralhospital.com',
      password: staffPass,
      firstName: 'Mike',
      lastName: 'Wilson',
      role: 'LabTechnician',
      phone: '+1234567895',
      status: 'active',
      orgId: cityGeneralOrg.id
    }
  });

  console.log('✅ Created/Updated lab technician:', labTech.email);

  // Create pharmacist
  const pharmacist = await prisma.user.upsert({
    where: { email: 'pharmacy@citygeneralhospital.com' },
    update: {},
    create: {
      email: 'pharmacy@citygeneralhospital.com',
      password: staffPass,
      firstName: 'Lisa',
      lastName: 'Brown',
      role: 'Pharmacist',
      phone: '+1234567896',
      status: 'active',
      orgId: cityGeneralOrg.id
    }
  });

  console.log('✅ Created/Updated pharmacist:', pharmacist.email);

  console.log('');
  console.log('🎉 Seed completed successfully!');
  console.log('');
  console.log('📝 Login Credentials:');
  console.log('');
  console.log('SuperAdmin:');
  console.log('  Email: admin@novoraplus.com');
  console.log('  Password: NovoraPlus@2024!');
  console.log('');
  console.log('Hospital Admin (City General Hospital):');
  console.log('  Email: admin@citygeneralhospital.com');
  console.log('  Password: Hospital@2024!');
  console.log('');
  console.log('Staff (All use password: Staff@2024!):');
  console.log('  Doctor: doctor@citygeneralhospital.com');
  console.log('  Nurse: nurse@citygeneralhospital.com');
  console.log('  Receptionist: reception@citygeneralhospital.com');
  console.log('  Lab Tech: lab@citygeneralhospital.com');
  console.log('  Pharmacist: pharmacy@citygeneralhospital.com');
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
