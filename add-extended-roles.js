// Add extended hospital roles
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcrypt');

const prisma = new PrismaClient();

async function addExtendedRoles() {
  try {
    const password = await bcrypt.hash('admin123', 10);
    const testOrgId = '137161a0-8e87-4147-85c7-a703bc15372d';
    
    console.log('Adding extended hospital roles...\n');
    
    const newUsers = [
      {
        email: 'accountant@hospital.com',
        firstName: 'Robert',
        lastName: 'Taylor',
        role: 'Accountant',
        phone: '+1234567900',
        orgId: testOrgId
      },
      {
        email: 'hr@hospital.com',
        firstName: 'Jennifer',
        lastName: 'Anderson',
        role: 'HRManager',
        phone: '+1234567901',
        orgId: testOrgId
      },
      {
        email: 'records@hospital.com',
        firstName: 'Patricia',
        lastName: 'White',
        role: 'MedicalRecords',
        phone: '+1234567902',
        orgId: testOrgId
      },
      {
        email: 'inventory@hospital.com',
        firstName: 'Michael',
        lastName: 'Brown',
        role: 'InventoryManager',
        phone: '+1234567903',
        orgId: testOrgId
      },
      {
        email: 'dietitian@hospital.com',
        firstName: 'Laura',
        lastName: 'Martinez',
        role: 'Dietitian',
        phone: '+1234567904',
        orgId: testOrgId
      },
      {
        email: 'physiotherapist@hospital.com',
        firstName: 'David',
        lastName: 'Garcia',
        role: 'Physiotherapist',
        phone: '+1234567905',
        orgId: testOrgId
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
            status: 'active'
          }
        });
        
        console.log(`✅ Created: ${userData.role} - ${userData.email}`);
      } catch (error) {
        console.log(`❌ ${userData.role} - ${error.message}`);
      }
    }
    
    console.log('\n✅ Extended roles added successfully!');
    console.log('Password for all new users: admin123');
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

addExtendedRoles();
