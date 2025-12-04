// Reset all test user passwords to admin123
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcrypt');

const prisma = new PrismaClient();

async function resetPasswords() {
  try {
    const testPassword = 'admin123';
    const hashedPassword = await bcrypt.hash(testPassword, 10);
    
    const testUsers = [
      'superadmin@hospital.com',
      'admin@hospital.com',
      'hospitaladmin@hospital.com',
      'doctor@hospital.com',
      'nurse@hospital.com',
      'receptionist@hospital.com',
      'pharmacist@hospital.com',
      'labtech@hospital.com',
      'radiologist@hospital.com',
      'billing@hospital.com',
      'admin@citygeneralhospital.com',
      'doctor@citygeneralhospital.com',
      'nurse@citygeneralhospital.com',
      'reception@citygeneralhospital.com',
      'pharmacy@citygeneralhospital.com',
      'lab@citygeneralhospital.com'
    ];
    
    console.log('Resetting passwords for test users...\n');
    
    for (const email of testUsers) {
      try {
        const result = await prisma.user.updateMany({
          where: { email },
          data: { password: hashedPassword }
        });
        
        if (result.count > 0) {
          console.log(`✅ ${email} - password reset to: admin123`);
        } else {
          console.log(`⚠️  ${email} - user not found`);
        }
      } catch (error) {
        console.log(`❌ ${email} - error: ${error.message}`);
      }
    }
    
    console.log('\n✅ Password reset complete!');
    console.log('All users can now login with password: admin123');
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

resetPasswords();
