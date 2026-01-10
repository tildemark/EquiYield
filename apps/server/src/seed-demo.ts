import { prisma } from './prisma.js';
import { hashPassword } from './services/auth.js';

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
      update: {
        passwordHash: adminPassword,
        full_name: 'Administrator',
        role: 'ADMIN',
      },
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
        share_count: 20,
        gcashNumber: '09211234567',
        bankName: 'PNB',
        bankAccountNumber: '7777888899',
      },
    ];

    const createdMembers = await Promise.all(
      members.map(member =>
        prisma.user.create({
          data: {
            ...member,
            passwordHash: memberPassword,
            role: 'MEMBER',
          },
        })
      )
    );

    // Create sample contributions
    console.log('💰 Creating sample contributions...');
    const now = new Date();
    for (const member of createdMembers) {
      for (let i = 0; i < 2; i++) {
        await prisma.contribution.create({
          data: {
            userId: member.id,
            amount: (member.share_count * 250 * (i + 1)) / 100,
            date_paid: new Date(now.getFullYear(), now.getMonth() - 2 + i, 10),
            status: 'FULL',
            method: 'BANK_TRANSFER',
            reference_number: `CONTRIB-${member.id}-${i}`,
          },
        });
      }
    }

    // Create sample loans
    console.log('🏦 Creating sample loans...');
    const loanStatuses = ['PENDING', 'RELEASED', 'PAID'] as const;
    for (let i = 0; i < 3; i++) {
      const member = createdMembers[i];
      const principal = 5000 * (i + 1);
      const monthlyRateBps = 500 + (i * 50); // 5%, 5.5%, 6%
      const termMonths = 12;
      const totalInterest = Math.floor((principal * monthlyRateBps * termMonths) / 10000);
      const monthlyPayment = Math.floor((principal + totalInterest) / termMonths);
      
      await prisma.loan.create({
        data: {
          userId: member.id,
          borrowerType: 'MEMBER',
          borrowerName: member.full_name,
          borrowerEmail: member.email,
          borrowerPhone: member.phone_number,
          principal,
          monthlyRateBps,
          termMonths,
          interest: totalInterest,
          monthlyAmortization: monthlyPayment,
          status: loanStatuses[i],
          dueDate: new Date(now.getFullYear() + 1, now.getMonth(), 20),
          releasedAt: i > 0 ? new Date(now.getFullYear(), now.getMonth() - 2, 15) : null,
          settledAt: i === 2 ? new Date(now.getFullYear(), now.getMonth() - 1, 15) : null,
        },
      });
    }

    // Create sample payments
    console.log('💳 Creating sample loan payments...');
    const paidLoan = await prisma.loan.findFirst({ where: { status: 'PAID' } });
    if (paidLoan) {
      for (let i = 0; i < 2; i++) {
        await prisma.loanPayment.create({
          data: {
            loanId: paidLoan.id,
            amount: Math.floor(paidLoan.monthlyAmortization),
            date_paid: new Date(now.getFullYear(), now.getMonth() - 6 + i, 15),
            payment_method: 'BANK_TRANSFER',
            reference: `BT-PMT-${i + 1}`,
          },
        });
      }
    }

    // Create dividend payouts
    console.log('💸 Creating sample dividend payouts...');
    const admin = await prisma.user.findUnique({ where: { email: 'admin@equiyield.local' } });
    
    for (const member of createdMembers.slice(0, 3)) {
      await prisma.dividendPayout.create({
        data: {
          userId: member.id,
          createdByUserId: admin?.id,
          year: currentYear - 1,
          amount: member.share_count * 150,
          perShare: 150,
          sharesCount: member.share_count,
          channel: Math.random() > 0.5 ? 'GCASH' : 'BANK',
          reference: `DIV-${currentYear - 1}-${Math.random().toString(36).substr(2, 6).toUpperCase()}`,
          gcashNumber: member.gcashNumber,
          bankName: member.bankName,
          bankAccountNumber: member.bankAccountNumber,
          depositedAt: new Date(currentYear - 1, 11, 20),
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
    console.log('   • Admin: https://equiyield.sanchez.ph/admin/login');
    console.log('   • Member: https://equiyield.sanchez.ph/member/login');
    console.log('\n⚠️  Remember to change the admin password after first login!\n');

  } catch (error) {
    console.error('❌ Error seeding demo data:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

seedDemoData();
