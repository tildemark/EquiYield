import { prisma } from './src/prisma.js';
import { hashPassword } from './src/services/auth.js';

async function seedDemoData() {
  console.log('🌱 Seeding demo data...\n');

  try {
    // Clear existing data
    console.log('🧹 Clearing existing data...');
    await prisma.loanPayment.deleteMany();
    await prisma.loanCoMaker.deleteMany();
    await prisma.loan.deleteMany();
    await prisma.contribution.deleteMany();
    await prisma.dividendPayout.deleteMany();
    await prisma.cycleDividendEligibility.deleteMany();
    await prisma.user.deleteMany({ where: { role: 'MEMBER' } });
    
    // Create system config
    console.log('⚙️  Setting up system config...');
    await prisma.systemConfig.upsert({
      where: { id: 1 },
      update: {},
      create: {
        min_shares: 1,
        max_shares: 100,
        share_value: 250,
        min_loan_amount: 1000,
        max_loan_amount: 100000,
      },
    });

    // Create profit pool
    const currentYear = new Date().getFullYear();
    await prisma.profitPool.upsert({
      where: { year: currentYear },
      update: { amount: 150000 },
      create: { year: currentYear, amount: 150000 },
    });

    // Create admin user
    console.log('👤 Creating admin user...');
    const adminPassword = await hashPassword('Admin@123456');
    await prisma.user.upsert({
      where: { email: 'admin@equiyield.local' },
      update: {},
      create: {
        email: 'admin@equiyield.local',
        full_name: 'Administrator',
        passwordHash: adminPassword,
        role: 'ADMIN',
        phone_number: '555-ADMIN',
        share_count: 0,
      },
    });

    // Create sample members
    console.log('👥 Creating sample members...');
    const memberPassword = await hashPassword('Member@123');
    
    const members = [
      {
        email: 'juan.delacruz@demo.com',
        full_name: 'Juan Dela Cruz',
        phone_number: '09171234567',
        share_count: 10,
        gcashNumber: '09171234567',
        bankName: 'BPI',
        bankAccountNumber: '1234567890',
      },
      {
        email: 'maria.santos@demo.com',
        full_name: 'Maria Santos',
        phone_number: '09181234567',
        share_count: 15,
        gcashNumber: '09181234567',
        bankName: 'BDO',
        bankAccountNumber: '9876543210',
      },
      {
        email: 'pedro.reyes@demo.com',
        full_name: 'Pedro Reyes',
        phone_number: '09191234567',
        share_count: 8,
        gcashNumber: '09191234567',
        bankName: 'Metrobank',
        bankAccountNumber: '5555666677',
      },
      {
        email: 'ana.garcia@demo.com',
        full_name: 'Ana Garcia',
        phone_number: '09201234567',
        share_count: 12,
        gcashNumber: '09201234567',
        bankName: 'UnionBank',
        bankAccountNumber: '4444333322',
      },
      {
        email: 'carlos.lopez@demo.com',
        full_name: 'Carlos Lopez',
        phone_number: '09211234567',
        share_count: 5,
        gcashNumber: '09211234567',
        bankName: 'Security Bank',
        bankAccountNumber: '7777888899',
      },
    ];

    const createdMembers = [];
    for (const member of members) {
      const user = await prisma.user.create({
        data: {
          ...member,
          passwordHash: memberPassword,
          role: 'MEMBER',
          is_dividend_eligible: true,
        },
      });
      createdMembers.push(user);
    }

    // Create contributions
    console.log('💰 Creating sample contributions...');
    const now = new Date();
    for (const member of createdMembers) {
      const expectedAmount = member.share_count * 250;
      
      // Current month - full payment
      await prisma.contribution.create({
        data: {
          userId: member.id,
          amount: expectedAmount,
          date_paid: new Date(now.getFullYear(), now.getMonth(), 15),
          status: 'FULL',
          method: 'GCASH',
          reference_number: `GC${Math.random().toString(36).substr(2, 9).toUpperCase()}`,
        },
      });

      // Last month - partial for one member
      if (member.email === 'carlos.lopez@demo.com') {
        await prisma.contribution.create({
          data: {
            userId: member.id,
            amount: expectedAmount * 0.7,
            date_paid: new Date(now.getFullYear(), now.getMonth() - 1, 28),
            status: 'PARTIAL',
            method: 'CASH',
            reference_number: 'CASH-' + Date.now(),
          },
        });
      } else {
        await prisma.contribution.create({
          data: {
            userId: member.id,
            amount: expectedAmount,
            date_paid: new Date(now.getFullYear(), now.getMonth() - 1, 28),
            status: 'FULL',
            method: Math.random() > 0.5 ? 'BANK_TRANSFER' : 'INSTAPAY',
            reference_number: `BT${Math.random().toString(36).substr(2, 9).toUpperCase()}`,
          },
        });
      }
    }

    // Create loans
    console.log('🏦 Creating sample loans...');
    
    // Active loan with payments
    const loan1 = await prisma.loan.create({
      data: {
        borrowerType: 'MEMBER',
        userId: createdMembers[0].id,
        borrowerName: createdMembers[0].full_name,
        borrowerEmail: createdMembers[0].email,
        borrowerPhone: createdMembers[0].phone_number,
        principal: 10000,
        interest: 2500,
        monthlyRateBps: 500,
        termMonths: 5,
        monthlyAmortization: 2500,
        dueDate: new Date(now.getFullYear(), now.getMonth() + 5, now.getDate()),
        status: 'RELEASED',
        releasedAt: new Date(now.getFullYear(), now.getMonth() - 2, 1),
      },
    });

    // Add co-maker
    await prisma.loanCoMaker.create({
      data: {
        loanId: loan1.id,
        userId: createdMembers[1].id,
      },
    });

    // Add payments
    await prisma.loanPayment.create({
      data: {
        loanId: loan1.id,
        amount: 2500,
        payment_method: 'GCASH',
        reference: 'GC-PAYMENT-001',
        date_paid: new Date(now.getFullYear(), now.getMonth() - 1, 15),
      },
    });

    // Pending loan
    await prisma.loan.create({
      data: {
        borrowerType: 'MEMBER',
        userId: createdMembers[2].id,
        borrowerName: createdMembers[2].full_name,
        borrowerEmail: createdMembers[2].email,
        borrowerPhone: createdMembers[2].phone_number,
        principal: 5000,
        interest: 1250,
        monthlyRateBps: 500,
        termMonths: 5,
        monthlyAmortization: 1250,
        dueDate: new Date(now.getFullYear(), now.getMonth() + 5, now.getDate()),
        status: 'PENDING',
      },
    });

    // Paid loan
    const loan3 = await prisma.loan.create({
      data: {
        borrowerType: 'MEMBER',
        userId: createdMembers[3].id,
        borrowerName: createdMembers[3].full_name,
        borrowerEmail: createdMembers[3].email,
        borrowerPhone: createdMembers[3].phone_number,
        principal: 3000,
        interest: 750,
        monthlyRateBps: 500,
        termMonths: 5,
        monthlyAmortization: 750,
        dueDate: new Date(now.getFullYear(), now.getMonth() - 1, now.getDate()),
        status: 'PAID',
        releasedAt: new Date(now.getFullYear(), now.getMonth() - 6, 1),
        settledAt: new Date(now.getFullYear(), now.getMonth() - 1, 15),
      },
    });

    // Add full payments for paid loan
    for (let i = 0; i < 5; i++) {
      await prisma.loanPayment.create({
        data: {
          loanId: loan3.id,
          amount: 750,
          payment_method: 'BANK_TRANSFER',
          reference: `BT-PMT-${i + 1}`,
          date_paid: new Date(now.getFullYear(), now.getMonth() - 6 + i, 15),
        },
      });
    }

    // Create dividend payouts
    console.log('💸 Creating sample dividend payouts...');
    const admin = await prisma.user.findUnique({ where: { email: 'admin@equiyield.local' } });
    
    for (const member of createdMembers.slice(0, 3)) {
      await prisma.dividendPayout.create({
        data: {
          userId: member.id,
          year: currentYear - 1,
          amount: member.share_count * 150,
          perShare: 150,
          shareCount: member.share_count,
          channel: Math.random() > 0.5 ? 'GCASH' : 'BANK',
          reference: `DIV-${currentYear - 1}-${Math.random().toString(36).substr(2, 6).toUpperCase()}`,
          gcashNumber: member.gcashNumber,
          bankName: member.bankName,
          bankAccountNumber: member.bankAccountNumber,
          depositedAt: new Date(currentYear - 1, 11, 20),
          createdByUserId: admin?.id,
        },
      });
    }

    console.log('\n✅ Demo data seeded successfully!\n');
    console.log('📊 Summary:');
    console.log(`   • Admin: admin@equiyield.local / Admin@123456`);
    console.log(`   • Members: ${createdMembers.length} (all use password: Member@123)`);
    console.log(`   • Contributions: ${createdMembers.length * 2}`);
    console.log(`   • Loans: 3 (1 active, 1 pending, 1 paid)`);
    console.log(`   • Dividend Payouts: 3`);
    console.log('\n🌐 Access the app:');
    console.log('   • Admin: http://localhost:3000/admin/login');
    console.log('   • Member: http://localhost:3000/member/login');
    console.log('\n⚠️  Remember to change the admin password after first login!\n');

  } catch (error) {
    console.error('❌ Error seeding demo data:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

seedDemoData();
