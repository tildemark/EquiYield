import { prisma } from './src/prisma.js';

async function fixLoan() {
  // Find loans for user ID 7
  const loans = await prisma.loan.findMany({
    where: { userId: 7 },
    include: {
      payments: true,
    },
  });

  console.log('\nLoans for User ID 7:');
  loans.forEach(loan => {
    console.log(`\nLoan ID: ${loan.id}`);
    console.log(`Status: ${loan.status}`);
    console.log(`Principal: ${loan.principal}`);
    console.log(`Settled At: ${loan.settledAt}`);
    console.log(`Payments: ${loan.payments.length}`);
    const totalPaid = loan.payments.reduce((sum, p) => sum + p.amount, 0);
    console.log(`Total Paid: ${totalPaid}`);
    console.log(`Total Due: ${loan.principal + loan.interest}`);
  });

  // Find the PAID loan
  const paidLoan = loans.find(l => l.status === 'PAID');
  
  if (paidLoan) {
    console.log(`\n\nFound PAID loan (ID: ${paidLoan.id}). Updating to RELEASED status...`);
    
    await prisma.loan.update({
      where: { id: paidLoan.id },
      data: {
        status: 'RELEASED',
        settledAt: null,
      },
    });
    
    console.log('✓ Loan status updated to RELEASED and settledAt cleared.');
    console.log('This loan will now show as an active loan with outstanding balance.');
  } else {
    console.log('\nNo PAID loans found for this user.');
  }

  await prisma.$disconnect();
}

fixLoan();
