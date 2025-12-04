// Add additional hospital roles
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcrypt');

const prisma = new PrismaClient();

async function addAdditionalRoles() {
  try {
    const password = await bcrypt.hash('admin123', 10);
    
    // Get Test Hospital org ID
    const testOrg = await prisma.organization.findFirst({
      where: { code: 'TH001' }
    });
    
    if (!testOrg) {
      console.log('❌ Test Hospital organization not found');
      return;
    }
    
    console.log('Adding additional hospital roles...\n');
    
    const newUsers = [
      {
        email: 'accountant@hospital.com',
        firstName: 'Robert',
        lastName: 'Taylor',
        role: 'Accountant',
        phone: '+1234567900'
      },
      {
        email: 'hr@hospital.com',
        firstName: 'Jennifer',
        lastName: 'Anderson',
        role: 'HR Manager',
        phone: '+1234567901'
      },
      {
        email: 'records@hospital.com',
        firstName: 'Patricia',
        lastName: 'White',
        role: 'Medical Records',
        phone: '+1234567902'
      },
      {
        email: 'inventory@hospital.com',
        firstName: 'Michael',
        lastName: 'Brown',
        role: 'Inventory Manager',
        phone: '+1234567903'
      },
      {
        email: 'dietitian@hospital.com',
        firstName: 'Laura',
        lastName: 'Martinez',
        role: 'Dietitian',
        phone: '+1234567904'
      },
      {
        email: 'physiotherapist@hospital.com',
        firstName: 'David',
        lastName: 'Garcia',
        role: 'Physiotherapist',
        phone: '+1234567905'
      },
      {
        email: 'patient@test.com',
        firstName: 'Test',
        lastName: 'Patient',
        role: 'Patient',
        phone: '+1234567906'
      }
    ];
    
    for (const userData of newUsers) {
      try {
        const existingUser = await prisma.user.findUnique({
          where: { email: userData.email }
        });
        
        if (existingUser) {
          console.log(`⚠️  ${userData.role} - ${userData.email} already exists`);
          continue;
        }
        
        const user = await prisma.user.create({
          data: {
            ...userData,
            password,
            status: 'active',
            orgId: userData.role === 'Patient' ? null : testOrg.id
          }
        });
        
        console.log(`✅ ${userData.role} - ${userData.email}`);
      } catch (error) {
        console.log(`❌ ${userData.role} - ${error.message}`);
      }
    }
    
    console.log('\n✅ Additional roles added successfully!');
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

addAdditionalRoles();
