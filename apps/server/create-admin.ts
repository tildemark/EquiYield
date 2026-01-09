import { prisma } from './src/prisma.js';
import { hashPassword } from './src/services/auth.js';

async function createAdmin() {
  const email = 'admin@equiyield.local';
  const password = 'Admin@123456';
  const fullName = 'Administrator';

  try {
    // Check if admin already exists
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      console.log(`Admin user already exists: ${email}`);
      return;
    }

    // Create admin user
    const passwordHash = await hashPassword(password);
    const admin = await prisma.user.create({
      data: {
        email,
        full_name: fullName,
        passwordHash,
        role: 'ADMIN',
        phone_number: '555-ADMIN',
        share_count: 0,
      },
    });

    console.log('\n✓ Admin user created successfully!\n');
    console.log('Email:    ' + email);
    console.log('Password: ' + password);
    console.log('Login at: http://localhost:3000/admin/login\n');
  } catch (error) {
    console.error('Error creating admin:', error);
  } finally {
    await prisma.$disconnect();
  }
}

createAdmin();
