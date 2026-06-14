const { calculateGroupBalances, calculateUserBreakdown, calculateOwedAmount } = require('../utils/balanceEngine');

describe('Balance Engine', () => {
  const members = [
    { userId: 'u1', user: { name: 'Alice' } },
    { userId: 'u2', user: { name: 'Bob' } },
    { userId: 'u3', user: { name: 'Charlie' } }
  ];

  test('EQUAL split calculation', () => {
    const expenses = [
      {
        id: 'e1',
        amount: '300.00',
        payerId: 'u1',
        splitType: 'EQUAL',
        participants: [
          { userId: 'u1' },
          { userId: 'u2' },
          { userId: 'u3' }
        ]
      }
    ];

    const balances = calculateGroupBalances(expenses, members);
    
    // Alice paid 300, owes 100 -> net +200
    // Bob paid 0, owes 100 -> net -100
    // Charlie paid 0, owes 100 -> net -100
    
    expect(balances.find(b => b.userId === 'u1').netBalance).toBe(200);
    expect(balances.find(b => b.userId === 'u2').netBalance).toBe(-100);
    expect(balances.find(b => b.userId === 'u3').netBalance).toBe(-100);
  });

  test('EXACT split calculation', () => {
    const expenses = [
      {
        id: 'e2',
        amount: '150.00',
        payerId: 'u2', // Bob paid
        splitType: 'EXACT',
        participants: [
          { userId: 'u1', shareValue: '50.00' },
          { userId: 'u2', shareValue: '100.00' }
        ]
      }
    ];

    const balances = calculateGroupBalances(expenses, members);
    
    // Alice paid 0, owes 50 -> net -50
    // Bob paid 150, owes 100 -> net +50
    // Charlie not involved -> net 0
    
    expect(balances.find(b => b.userId === 'u1').netBalance).toBe(-50);
    expect(balances.find(b => b.userId === 'u2').netBalance).toBe(50);
    expect(balances.find(b => b.userId === 'u3').netBalance).toBe(0);
  });

  test('PERCENTAGE split calculation', () => {
    const expenses = [
      {
        id: 'e3',
        amount: '200.00',
        payerId: 'u3', // Charlie paid
        splitType: 'PERCENTAGE',
        participants: [
          { userId: 'u1', shareValue: '25' }, // 25% of 200 = 50
          { userId: 'u3', shareValue: '75' }  // 75% of 200 = 150
        ]
      }
    ];

    const balances = calculateGroupBalances(expenses, members);
    
    // Alice paid 0, owes 50 -> net -50
    // Bob paid 0, owes 0 -> net 0
    // Charlie paid 200, owes 150 -> net +50
    
    expect(balances.find(b => b.userId === 'u1').netBalance).toBe(-50);
    expect(balances.find(b => b.userId === 'u2').netBalance).toBe(0);
    expect(balances.find(b => b.userId === 'u3').netBalance).toBe(50);
  });

  test('User breakdown calculation', () => {
    const expenses = [
      {
        id: 'e1',
        description: 'Dinner',
        amount: '300.00',
        payerId: 'u1',
        payer: { name: 'Alice' },
        splitType: 'EQUAL',
        expenseDate: '2026-06-14',
        participants: [
          { userId: 'u1' },
          { userId: 'u2' },
          { userId: 'u3' }
        ]
      }
    ];

    const breakdown = calculateUserBreakdown(expenses, 'u1');
    expect(breakdown.totalPaid).toBe(300);
    expect(breakdown.totalOwed).toBe(100);
    expect(breakdown.netBalance).toBe(200);
    expect(breakdown.breakdown[0].impact).toBe(200); // Paid 300, owed 100 -> +200 impact
  });
});
