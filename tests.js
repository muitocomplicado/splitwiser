#!/usr/bin/env node

// ===== SPLITWISER LOGIC TESTS =====
// Node.js-compatible test suite for Splitwiser business logic
// Converted from tests.html to enable automated testing

// Import required modules
const { LOCALE, getLocale } = require('./locale.js');
const {
    ValidationLogic,
    NumberLogic,
    PersonLogic,
    TransactionLogic,
    CalculationLogic,
    ExpenseLogic,
    formatTemplate,
    CONSTANTS
} = require('./lib.js');

// Mock navigator for consistent test results
global.navigator = {
    language: 'en-US',
    userLanguage: 'en-US'
};

// Make LOCALE and getLocale globally available for lib.js functions
global.LOCALE = LOCALE;
global.getLocale = getLocale;

// Force locale to 'en-US' for consistent test results
LOCALE.currentLocale = 'en-US';

// Skip locale-specific formatting tests in Node.js environment
// The business logic is tested elsewhere, locale formatting is browser-specific

// Simple test framework for Node.js
class TestFramework {
    constructor() {
        this.tests = [];
        this.currentSuite = null;
        this.totalTests = 0;
        this.passedTests = 0;
        this.failedTests = 0;
        this.errors = [];
    }

    suite(name, fn) {
        this.currentSuite = { name, tests: [] };
        fn();
        this.tests.push(this.currentSuite);
        this.currentSuite = null;
    }

    test(name, fn) {
        if (!this.currentSuite) {
            throw new Error('Test must be inside a suite');
        }
        this.currentSuite.tests.push({ name, fn });
    }

    assertEqual(actual, expected, message = '') {
        if (JSON.stringify(actual) !== JSON.stringify(expected)) {
            throw new Error(`Expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}. ${message}`);
        }
    }

    assertTrue(condition, message = '') {
        if (!condition) {
            throw new Error(`Expected true, got false. ${message}`);
        }
    }

    assertFalse(condition, message = '') {
        if (condition) {
            throw new Error(`Expected false, got true. ${message}`);
        }
    }

    assertThrows(fn, expectedMessage = '', message = '') {
        let errorThrown = false;
        let actualError = null;
        try {
            fn();
        } catch (error) {
            errorThrown = true;
            actualError = error;
            if (expectedMessage && !error.message.includes(expectedMessage)) {
                throw new Error(`Expected error message to contain "${expectedMessage}", got "${error.message}". ${message}`);
            }
        }
        if (!errorThrown) {
            throw new Error(`Expected function to throw an error, but it didn't. ${message}`);
        }
        return actualError;
    }

    assertApproxEqual(actual, expected, tolerance = 0.01, message = '') {
        // Ensure tolerance is positive
        const absTolerance = Math.abs(tolerance);
        const difference = Math.abs(actual - expected);

        if (difference > absTolerance) {
            throw new Error(`Expected approximately ${expected} (±${absTolerance}), got ${actual} (difference: ${difference}). ${message}`);
        }
    }

    run() {
        this.tests.forEach(suite => {
            suite.tests.forEach(test => {
                this.totalTests++;
                try {
                    test.fn();
                    this.passedTests++;
                } catch (error) {
                    this.errors.push({ test: test.name, error: error.message });
                    this.failedTests++;
                }
            });
        });

        // Print summary
        console.log(`${this.passedTests}/${this.totalTests} tests passed`);

        if (this.failedTests > 0) {
            console.log('\nFailed tests:');
            this.errors.forEach(({ test, error }) => {
                console.log(`  ${test}: ${error}`);
            });
            process.exit(1);
        } else {
            process.exit(0);
        }
    }
}

const test = new TestFramework();

// ===== TEST CASES =====
// Copied from tests.html with identical logic

// NumberLogic Tests
test.suite('NumberLogic.parseNumber', () => {
    test.test('parses simple integers', () => {
        test.assertEqual(NumberLogic.parseNumber('123'), 123);
        test.assertEqual(NumberLogic.parseNumber('0'), 0);
    });

    test.test('parses US format decimals', () => {
        test.assertEqual(NumberLogic.parseNumber('123.45'), 123.45);
        test.assertEqual(NumberLogic.parseNumber('0.99'), 0.99);
    });

    test.test('parses European format decimals', () => {
        test.assertEqual(NumberLogic.parseNumber('123,45'), 123.45);
        test.assertEqual(NumberLogic.parseNumber('0,99'), 0.99);
    });

    test.test('parses US format with thousands separator', () => {
        test.assertEqual(NumberLogic.parseNumber('1,234.56'), 1234.56);
        test.assertEqual(NumberLogic.parseNumber('12,345'), 12345);
    });

    test.test('parses European format with thousands separator', () => {
        test.assertEqual(NumberLogic.parseNumber('1.234,56'), 1234.56);
        test.assertEqual(NumberLogic.parseNumber('12.345'), 12345);
    });

    test.test('handles edge cases', () => {
        test.assertTrue(isNaN(NumberLogic.parseNumber('')));
        test.assertTrue(isNaN(NumberLogic.parseNumber('abc')));
        test.assertEqual(NumberLogic.parseNumber('  123.45  '), 123.45);
    });
});

test.suite('NumberLogic.formatNumber', () => {
    test.test('formats basic numbers (Node.js simplified)', () => {
        // In Node.js, we just test that formatting works without locale specifics
        LOCALE.currentLocale = 'en-US';
        const result = NumberLogic.formatNumber(123.45);
        test.assertTrue(result.includes('123'), 'Should contain the number');
        test.assertTrue(result.includes('.'), 'Should contain decimal separator');
    });

    test.test('handles zero correctly', () => {
        LOCALE.currentLocale = 'en-US';
        test.assertEqual(NumberLogic.formatNumber(0), '0.00');
        test.assertEqual(NumberLogic.formatNumber(-0), '0.00');
    });

    test.test('rounds correctly', () => {
        LOCALE.currentLocale = 'en-US';
        const result = NumberLogic.formatNumber(123.456);
        test.assertTrue(result.includes('123.46'), 'Should round to 2 decimal places');
    });

    test.test('handles negative numbers', () => {
        LOCALE.currentLocale = 'en-US';
        const result = NumberLogic.formatNumber(-123.45);
        test.assertTrue(result.includes('-123'), 'Should handle negative numbers');
    });

    test.test('cleanup', () => {
        LOCALE.currentLocale = 'en-US';
        test.assertTrue(true);
    });
});

test.suite('PersonLogic.parsePersonName', () => {
    test.test('parses simple name', () => {
        const result = PersonLogic.parsePersonName('John');
        test.assertEqual(result.displayName, 'John');
        test.assertEqual(result.baseName, 'John');
        test.assertEqual(result.parts, 1);
        test.assertFalse(result.isExcluded);
    });

    test.test('parses name with parts', () => {
        const result = PersonLogic.parsePersonName('John 3');
        test.assertEqual(result.displayName, 'John');
        test.assertEqual(result.baseName, 'John');
        test.assertEqual(result.parts, 3);
        test.assertFalse(result.isExcluded);
    });

    test.test('parses name with parentheses parts', () => {
        const result = PersonLogic.parsePersonName('John (2)');
        test.assertEqual(result.displayName, 'John');
        test.assertEqual(result.baseName, 'John');
        test.assertEqual(result.parts, 2);
        test.assertFalse(result.isExcluded);
    });

    test.test('parses excluded name', () => {
        const result = PersonLogic.parsePersonName('John!');
        test.assertEqual(result.displayName, 'John!');
        test.assertEqual(result.baseName, 'John');
        test.assertEqual(result.parts, 1);
        test.assertTrue(result.isExcluded);
    });

    test.test('parses excluded name with parts', () => {
        const result = PersonLogic.parsePersonName('John! 2');
        test.assertEqual(result.displayName, 'John!');
        test.assertEqual(result.baseName, 'John');
        test.assertEqual(result.parts, 2);
        test.assertTrue(result.isExcluded);
    });

    test.test('handles complex names', () => {
        const result = PersonLogic.parsePersonName('Mary Jane 4');
        test.assertEqual(result.displayName, 'Mary Jane');
        test.assertEqual(result.baseName, 'Mary Jane');
        test.assertEqual(result.parts, 4);
        test.assertFalse(result.isExcluded);
    });
});

test.suite('ValidationLogic.validatePersonReference', () => {
    const people = ['John', 'Jane', 'Jack'];
    const personData = {
        'John': { displayName: 'John' },
        'Jane': { displayName: 'Jane' },
        'Jack': { displayName: 'Jack' }
    };

    test.test('validates exact match', () => {
        const result = ValidationLogic.validatePersonReference('John', people, personData);
        test.assertTrue(result.isValid);
        test.assertEqual(result.matches, ['John']);
        test.assertFalse(result.isAmbiguous);
        test.assertFalse(result.notFound);
    });

    test.test('validates partial match', () => {
        const result = ValidationLogic.validatePersonReference('Jo', people, personData);
        test.assertTrue(result.isValid);
        test.assertEqual(result.matches, ['John']);
    });

    test.test('detects ambiguous match', () => {
        const result = ValidationLogic.validatePersonReference('Ja', people, personData);
        test.assertFalse(result.isValid);
        test.assertTrue(result.isAmbiguous);
        test.assertEqual(result.matches.sort(), ['Jack', 'Jane'].sort());
    });

    test.test('detects not found', () => {
        const result = ValidationLogic.validatePersonReference('Bob', people, personData);
        test.assertFalse(result.isValid);
        test.assertTrue(result.notFound);
        test.assertEqual(result.matches, []);
    });

    test.test('handles empty reference', () => {
        const result = ValidationLogic.validatePersonReference('', people, personData);
        test.assertTrue(result.isValid);
        test.assertEqual(result.matches, []);
    });
});

test.suite('TransactionLogic.parseTransaction', () => {
    const allNames = ['John', 'Jane', 'Alice', 'David'];
    const personData = {
        'John': { displayName: 'John' },
        'Jane': { displayName: 'Jane' },
        'Alice': { displayName: 'Alice' },
        'David': { displayName: 'David' }
    };

    test.test('parses basic expense', () => {
        const result = TransactionLogic.parseTransaction('50 Dinner', allNames, personData);
        test.assertEqual(result.type, 'expense');
        test.assertEqual(result.amount, 50);
        test.assertEqual(result.description, 'Dinner');
        test.assertEqual(result.sharedWith, []);
    });

    test.test('parses expense with participants', () => {
        const result = TransactionLogic.parseTransaction('30 Lunch - John, Jane', allNames, personData);
        test.assertEqual(result.type, 'expense');
        test.assertEqual(result.amount, 30);
        test.assertEqual(result.description, 'Lunch');
        test.assertEqual(result.sharedWith, ['John', 'Jane']);
    });

    test.test('parses expense with initials for participants', () => {
        const result = TransactionLogic.parseTransaction('20 Lunch - A,D', allNames, personData);
        test.assertEqual(result.type, 'expense');
        test.assertEqual(result.amount, 20);
        test.assertEqual(result.description, 'Lunch');
        test.assertEqual(result.sharedWith, ['Alice', 'David']);
    });

    test.test('parses percentage fee', () => {
        const result = TransactionLogic.parseTransaction('10% Service fee', allNames, personData);
        test.assertEqual(result.type, 'percentage');
        test.assertEqual(result.percentage, 10);
        test.assertEqual(result.description, 'Service fee');
        test.assertEqual(result.sharedWith, []);
    });

    test.test('parses percentage fee without description', () => {
        const result = TransactionLogic.parseTransaction('15%', allNames, personData);
        test.assertEqual(result.type, 'percentage');
        test.assertEqual(result.percentage, 15);
        test.assertEqual(result.description, '');
        test.assertEqual(result.sharedWith, []);
    });

    test.test('parses settlement', () => {
        const result = TransactionLogic.parseTransaction('25 > John', allNames, personData);
        test.assertEqual(result.type, 'settlement');
        test.assertEqual(result.amount, 25);
        test.assertEqual(result.settleTo, 'John');
    });

    test.test('handles invalid input', () => {
        const result = TransactionLogic.parseTransaction('invalid', allNames, personData);
        test.assertEqual(result, null);
    });

    test.test('parses amount only', () => {
        const result = TransactionLogic.parseTransaction('75', allNames, personData);
        test.assertEqual(result.type, 'expense');
        test.assertEqual(result.amount, 75);
        test.assertEqual(result.description, '');
    });
});

test.suite('CalculationLogic', () => {
    test.test('calculateTotalExpenses with basic expenses', () => {
        const transactions = [
            { type: 'expense', amount: 50 },
            { type: 'expense', amount: 30 },
            { type: 'settlement', amount: 20 }
        ];
        const result = CalculationLogic.calculateTotalExpenses(transactions);
        test.assertEqual(result, 80);
    });

    test.test('calculateTotalExpenses with percentage fees', () => {
        const transactions = [
            { type: 'expense', amount: 100 },
            { type: 'percentage', percentage: 10 }
        ];
        const result = CalculationLogic.calculateTotalExpenses(transactions);
        test.assertEqual(result, 110);
    });

    test.test('calculateFairShares with equal parts', () => {
        const names = ['John', 'Jane'];
        const transactions = [
            { type: 'expense', amount: 100, sharedWith: [], paidBy: 'John' }
        ];
        const peopleData = {
            'John': { parts: 1, isExcluded: false },
            'Jane': { parts: 1, isExcluded: false }
        };
        const result = CalculationLogic.calculateFairShares(names, transactions, peopleData);
        test.assertEqual(result.John, 50);
        test.assertEqual(result.Jane, 50);
    });

    test.test('calculateFairShares with different parts', () => {
        const names = ['John', 'Jane'];
        const transactions = [
            { type: 'expense', amount: 100, sharedWith: [], paidBy: 'John' }
        ];
        const peopleData = {
            'John': { parts: 2, isExcluded: false },
            'Jane': { parts: 1, isExcluded: false }
        };
        const result = CalculationLogic.calculateFairShares(names, transactions, peopleData);
        test.assertEqual(result.John, 66.67);
        test.assertEqual(result.Jane, 33.33);
    });

    test.test('calculateFairShares excludes excluded people', () => {
        const names = ['John', 'Jane', 'Restaurant'];
        const transactions = [
            { type: 'expense', amount: 100, sharedWith: [], paidBy: 'John' }
        ];
        const peopleData = {
            'John': { parts: 1, isExcluded: false },
            'Jane': { parts: 1, isExcluded: false },
            'Restaurant': { parts: 1, isExcluded: true }
        };
        const result = CalculationLogic.calculateFairShares(names, transactions, peopleData);
        test.assertEqual(result.John, 50);
        test.assertEqual(result.Jane, 50);
        test.assertEqual(result.Restaurant, 0);
    });

    test.test('getExpenseTransactions filters correctly', () => {
        const transactions = [
            { type: 'expense', amount: 50 },
            { type: 'settlement', amount: 20 },
            { type: 'percentage', percentage: 10 }
        ];
        const result = CalculationLogic.getExpenseTransactions(transactions);
        test.assertEqual(result.length, 1);
        test.assertEqual(result[0].amount, 50);
    });

    test.test('getSettlementTransactions filters correctly', () => {
        const transactions = [
            { type: 'expense', amount: 50 },
            { type: 'settlement', amount: 20 },
            { type: 'percentage', percentage: 10 }
        ];
        const result = CalculationLogic.getSettlementTransactions(transactions);
        test.assertEqual(result.length, 1);
        test.assertEqual(result[0].amount, 20);
    });

    test.test('getPercentageTransactions filters correctly', () => {
        const transactions = [
            { type: 'expense', amount: 50 },
            { type: 'settlement', amount: 20 },
            { type: 'percentage', percentage: 10 }
        ];
        const result = CalculationLogic.getPercentageTransactions(transactions);
        test.assertEqual(result.length, 1);
        test.assertEqual(result[0].percentage, 10);
    });
});

test.suite('CalculationLogic with specific sharedWith participants', () => {
    test.test('calculateFairShares with expense shared by specific people', () => {
        const names = ['John', 'Jane', 'Bob'];
        const transactions = [
            { type: 'expense', amount: 60, sharedWith: ['John', 'Jane'], paidBy: 'John' }
        ];
        const peopleData = {
            'John': { parts: 1, isExcluded: false },
            'Jane': { parts: 1, isExcluded: false },
            'Bob': { parts: 1, isExcluded: false }
        };
        const result = CalculationLogic.calculateFairShares(names, transactions, peopleData);
        test.assertEqual(result.John, 30);
        test.assertEqual(result.Jane, 30);
        test.assertEqual(result.Bob, 0);
    });

    test.test('calculateFairShares with expense shared by specific people with different parts', () => {
        const names = ['John', 'Jane', 'Bob'];
        const transactions = [
            { type: 'expense', amount: 90, sharedWith: ['John', 'Jane'], paidBy: 'John' }
        ];
        const peopleData = {
            'John': { parts: 2, isExcluded: false },
            'Jane': { parts: 1, isExcluded: false },
            'Bob': { parts: 1, isExcluded: false }
        };
        const result = CalculationLogic.calculateFairShares(names, transactions, peopleData);
        test.assertEqual(result.John, 60);
        test.assertEqual(result.Jane, 30);
        test.assertEqual(result.Bob, 0);
    });

    test.test('calculateFairShares with single participant expense', () => {
        const names = ['John', 'Jane', 'Bob'];
        const transactions = [
            { type: 'expense', amount: 45, sharedWith: ['John'], paidBy: 'John' }
        ];
        const peopleData = {
            'John': { parts: 1, isExcluded: false },
            'Jane': { parts: 1, isExcluded: false },
            'Bob': { parts: 1, isExcluded: false }
        };
        const result = CalculationLogic.calculateFairShares(names, transactions, peopleData);
        test.assertEqual(result.John, 45);
        test.assertEqual(result.Jane, 0);
        test.assertEqual(result.Bob, 0);
    });

    test.test('calculateFairShares with percentage fee on single participant', () => {
        const names = ['John', 'Jane', 'Bob'];
        const transactions = [
            { type: 'expense', amount: 100, sharedWith: ['John'], paidBy: 'John' },
            { type: 'percentage', percentage: 15, sharedWith: ['John'], paidBy: 'John' }
        ];
        const peopleData = {
            'John': { parts: 1, isExcluded: false },
            'Jane': { parts: 1, isExcluded: false },
            'Bob': { parts: 1, isExcluded: false }
        };
        const result = CalculationLogic.calculateFairShares(names, transactions, peopleData);
        test.assertEqual(result.John, 115); // 100 + 15% of 100
        test.assertEqual(result.Jane, 0);
        test.assertEqual(result.Bob, 0);
    });
});

test.suite('ExpenseLogic.parseExpenses - Complete User Input', () => {
    test.test('parses simple expense list with names and amounts', () => {
        const input = `
John
50 Dinner
30 Lunch

Jane
25 Coffee
15 Snacks`;

        const result = ExpenseLogic.parseExpenses(input);

        test.assertEqual(Object.keys(result.people).length, 2);
        test.assertEqual(result.people['John'].expenses.length, 2);
        test.assertEqual(result.people['Jane'].expenses.length, 2);
        test.assertEqual(result.people['John'].total, 80);
        test.assertEqual(result.people['Jane'].total, 40);
    });

    test.test('parses expenses with descriptions', () => {
        const input = `
Alice
100 Restaurant dinner
25.50 Taxi ride
15 Coffee shop`;

        const result = ExpenseLogic.parseExpenses(input);

        test.assertEqual(result.people['Alice'].expenses.length, 3);
        test.assertEqual(result.people['Alice'].expenses[0].description, 'Restaurant dinner');
        test.assertEqual(result.people['Alice'].expenses[1].description, 'Taxi ride');
        test.assertEqual(result.people['Alice'].expenses[2].description, 'Coffee shop');
        test.assertEqual(result.people['Alice'].total, 140.50);
    });

    test.test('parses expenses with specific participants', () => {
        const input = `
John
60 Dinner - Jane, Bob
30 Lunch

Jane

Bob`;

        const result = ExpenseLogic.parseExpenses(input);

        test.assertEqual(result.transactions.length, 2);
        test.assertEqual(result.transactions[0].sharedWith, ['Jane', 'Bob']);
        test.assertEqual(result.transactions[1].sharedWith, []);
    });

    test.test('parses expenses with person parts', () => {
        const input = `
John 2
90 Hotel room

Jane

Bob (3)`;

        const result = ExpenseLogic.parseExpenses(input);

        test.assertEqual(result.people['John 2'].parts, 2);
        test.assertEqual(result.people['Jane'].parts, 1);
        test.assertEqual(result.people['Bob (3)'].parts, 3);
    });

    test.test('parses expenses with excluded persons', () => {
        const input = `
John
100 Dinner
20 Tip

Jane!

Restaurant!`;

        const result = ExpenseLogic.parseExpenses(input);

        test.assertFalse(result.people['John'].isExcluded);
        test.assertTrue(result.people['Jane!'].isExcluded);
        test.assertTrue(result.people['Restaurant!'].isExcluded);
    });

    test.test('parses settlements', () => {
        const input = `
John
50 > Jane
25 Dinner

Jane`;

        const result = ExpenseLogic.parseExpenses(input);

        test.assertEqual(result.transactions.length, 2);
        test.assertEqual(result.transactions[0].type, 'settlement');
        test.assertEqual(result.transactions[0].settleTo, 'Jane');
        test.assertEqual(result.transactions[1].type, 'expense');
    });

    test.test('parses percentage fees', () => {
        const input = `
John
100 Dinner
10% Service fee
5% Tax

Jane`;

        const result = ExpenseLogic.parseExpenses(input);

        test.assertEqual(result.transactions.length, 3);
        test.assertEqual(result.transactions[1].type, 'percentage');
        test.assertEqual(result.transactions[1].percentage, 10);
        test.assertEqual(result.transactions[2].type, 'percentage');
        test.assertEqual(result.transactions[2].percentage, 5);
    });

    test.test('parses mixed European and US number formats', () => {
        const input = `
John
1,234.56 Expensive dinner
123,45 European format
1.234 Thousands only`;

        const result = ExpenseLogic.parseExpenses(input);

        test.assertEqual(result.people['John'].expenses.length, 3);
        test.assertEqual(result.people['John'].expenses[0].amount, 1234.56);
        test.assertEqual(result.people['John'].expenses[1].amount, 123.45);
        test.assertEqual(result.people['John'].expenses[2].amount, 1234);
    });

    test.test('handles non-validation invalid inputs gracefully', () => {
        const input = `
John
@invalid line
50 Valid expense
Jane
-50 Invalid amount
25 Valid expense`;

        const result = ExpenseLogic.parseExpenses(input);

        // Should parse valid parts and ignore invalid lines
        test.assertEqual(result.people['John'].expenses.length, 1);
        test.assertEqual(result.people['Jane'].expenses.length, 1);
        test.assertEqual(result.people['John'].total, 50);
        test.assertEqual(result.people['Jane'].total, 25);
    });

    test.test('parses complex real-world scenario', () => {
        const input = `
John 2
150 Hotel room - John, Jane
45.50 Taxi to airport
25 > Jane

Jane
80 Dinner - John, Jane, Bob
12% Service fee - John, Jane, Bob
30 Coffee

Bob!
20 > Restaurant

Restaurant!`;

        const result = ExpenseLogic.parseExpenses(input);

        // Check people setup
        test.assertEqual(Object.keys(result.people).length, 4);
        test.assertEqual(result.people['John 2'].parts, 2);
        test.assertTrue(result.people['Bob!'].isExcluded);
        test.assertTrue(result.people['Restaurant!'].isExcluded);

        // Check transactions
        test.assertEqual(result.transactions.length, 7);

        // Check specific transaction types
        const expenseTransactions = result.transactions.filter(t => t.type === 'expense');
        const settlementTransactions = result.transactions.filter(t => t.type === 'settlement');
        const percentageTransactions = result.transactions.filter(t => t.type === 'percentage');

        test.assertEqual(expenseTransactions.length, 4);
        test.assertEqual(settlementTransactions.length, 2);
        test.assertEqual(percentageTransactions.length, 1);
    });

    test.test('handles empty lines and whitespace', () => {
        const input = `
John

50 Dinner


Jane

25 Coffee

30 Lunch

`;

        const result = ExpenseLogic.parseExpenses(input);

        test.assertEqual(Object.keys(result.people).length, 2);
        test.assertEqual(result.people['John'].expenses.length, 1);
        test.assertEqual(result.people['Jane'].expenses.length, 2);
    });

    test.test('parses initials in participant lists', () => {
        const input = `
John Smith
60 Dinner - Jo, Bo
30 Lunch - Jane

Jane Doe

Bob Wilson`;

        const result = ExpenseLogic.parseExpenses(input);

        test.assertEqual(result.transactions[0].sharedWith.length, 2);
        test.assertEqual(result.transactions[1].sharedWith, ['Jane Doe']);
    });
});

test.suite('ValidationLogic.validateExpenses - Invalid Input Detection', () => {
    test.test('detects duplicate person names', () => {
        const input = `
John
Jane
john
Jane`;

        const warnings = ValidationLogic.validateExpenses(input);

        test.assertEqual(warnings.length, 2);
        test.assertTrue(warnings[0].error.includes('duplicate'));
        test.assertTrue(warnings[1].error.includes('duplicate'));
    });

    test.test('detects ambiguous person references in expenses', () => {
        const input = `
John Smith
50 Dinner - J

Jane Smith
Jack Wilson
`;

        const warnings = ValidationLogic.validateExpenses(input);

        test.assertEqual(warnings.length, 1);
        test.assertTrue(warnings[0].error.includes('ambiguous'));
    });

    test.test('detects person not found in expenses', () => {
        const input = `
John
50 Dinner - Bob

Jane
`;

        const warnings = ValidationLogic.validateExpenses(input);

        test.assertEqual(warnings.length, 1);
        test.assertTrue(warnings[0].error.includes('match'));
    });

    test.test('detects ambiguous person references in settlements', () => {
        const input = `
John Smith
50 > J

Jane Smith
`;

        const warnings = ValidationLogic.validateExpenses(input);

        test.assertEqual(warnings.length, 1);
        test.assertTrue(warnings[0].error.includes('ambiguous'));
    });

    test.test('detects person not found in settlements', () => {
        const input = `
John
50 > Bob

Jane
`;

        const warnings = ValidationLogic.validateExpenses(input);

        test.assertEqual(warnings.length, 1);
        test.assertTrue(warnings[0].error.includes('match'));
    });

    test.test('validates complex input with multiple errors', () => {
        const input = `
john
jane

John
50 Dinner - Bob, J
25 > Charlie
30 Lunch - jane`;

        const warnings = ValidationLogic.validateExpenses(input);

        test.assertTrue(warnings.length >= 3); // At least duplicate name, person not found, and ambiguous reference
    });

    test.test('handles valid input without warnings', () => {
        const input = `
John
50 Dinner - Jane, Bob
25 > Jane

Jane
30 Coffee

Bob`;

        const warnings = ValidationLogic.validateExpenses(input);

        test.assertEqual(warnings.length, 0);
    });

    test.test('handles empty participant lists correctly', () => {
        const input = `
John
50 Dinner -
25 Lunch -

Jane`;

        const warnings = ValidationLogic.validateExpenses(input);

        test.assertEqual(warnings.length, 0);
    });
});

test.suite('ExpenseLogic.parseExpenses - Validation Failure Tests', () => {
    test.test('throws error when duplicate names are present', () => {
        const input = `
John
Jane
john
Jane`;

        const error = test.assertThrows(() => {
            ExpenseLogic.parseExpenses(input);
        }, 'Validation failed');

        test.assertTrue(error.message.includes('duplicate'));
    });

    test.test('throws error when ambiguous person references exist', () => {
        const input = `
John Smith
Jane Smith
Jack Wilson

John Smith
50 Dinner - J`;

        const error = test.assertThrows(() => {
            ExpenseLogic.parseExpenses(input);
        }, 'Validation failed');

        test.assertTrue(error.message.includes('ambiguous'));
    });

    test.test('throws error when person not found in references', () => {
        const input = `
John
Jane

John
50 Dinner - Bob`;

        const error = test.assertThrows(() => {
            ExpenseLogic.parseExpenses(input);
        }, 'Validation failed');

        test.assertTrue(error.message.includes('match'));
    });

    test.test('throws error when settlement references invalid person', () => {
        const input = `
John
Jane

John
50 > Bob`;

        const error = test.assertThrows(() => {
            ExpenseLogic.parseExpenses(input);
        }, 'Validation failed');

        test.assertTrue(error.message.includes('match'));
    });

    test.test('throws error with multiple validation errors', () => {
        const input = `
John
jane
John Smith

John
50 Dinner - Bob, J
25 > Charlie`;

        const error = test.assertThrows(() => {
            ExpenseLogic.parseExpenses(input);
        }, 'Validation failed');

        // Should contain multiple error messages
        test.assertTrue(error.message.split('\n').length > 2);
    });

    test.test('succeeds with valid input', () => {
        const input = `
John
50 Dinner - Jane, Bob
25 > Jane

Jane
30 Coffee

Bob`;

        const result = ExpenseLogic.parseExpenses(input);
        test.assertEqual(Object.keys(result.people).length, 3);
        test.assertEqual(result.transactions.length, 3);
    });

    test.test('succeeds with empty participant lists', () => {
        const input = `
John
50 Dinner -
25 Lunch -

Jane`;

        const result = ExpenseLogic.parseExpenses(input);
        test.assertEqual(Object.keys(result.people).length, 2);
    });
});

test.suite('Rounding Logic and Fair Remainder Distribution', () => {
    test.test('perfect division gives equal shares to all', () => {
        const input = `
John
174.38 Food

Jane
35.98 Drinks

Bob
Charlie`;

        const result = ExpenseLogic.parseExpenses(input);
        const fairShares = CalculationLogic.calculateFairShares(
            Object.keys(result.people),
            result.transactions,
            result.people
        );

        // Total should be 210.36, which divides perfectly by 4
        const totalPaid = Object.values(fairShares).reduce((sum, amount) => sum + amount, 0);
        test.assertEqual(totalPaid, 210.36);

        // Each person should pay exactly 52.59 (210.36/4)
        test.assertEqual(fairShares.John, 52.59);
        test.assertEqual(fairShares.Jane, 52.59);
        test.assertEqual(fairShares.Bob, 52.59);
        test.assertEqual(fairShares.Charlie, 52.59);

    });

    test.test('remainder goes to non-payers first', () => {
        const input = `
John
174.39 Food

Jane
35.98 Drinks

Bob
Charlie`;

        const result = ExpenseLogic.parseExpenses(input);
        const fairShares = CalculationLogic.calculateFairShares(
            Object.keys(result.people),
            result.transactions,
            result.people
        );

        // Total should be 210.37, which has 1 cent remainder when divided by 4
        const totalPaid = Object.values(fairShares).reduce((sum, amount) => sum + amount, 0);
        test.assertEqual(totalPaid, 210.37);

        // John and Jane (payers) should have 52.59
        test.assertEqual(fairShares.John, 52.59);
        test.assertEqual(fairShares.Jane, 52.59);

        // Bob and Charlie (non-payers) should split the remainder - one gets 52.60, other gets 52.59
        test.assertTrue(
            (fairShares.Bob === 52.60 && fairShares.Charlie === 52.59) ||
            (fairShares.Bob === 52.59 && fairShares.Charlie === 52.60),
            'One of Bob or Charlie should get the extra cent'
        );

    });

    test.test('distributes rounding differences fairly across multiple expenses', () => {
        // Test with multiple expenses from different payers
        const input = `
John
33.33 Dinner
33.33 Lunch

Jane
33.34 Breakfast

Bob
Alice`;

        const result = ExpenseLogic.parseExpenses(input);
        const fairShares = CalculationLogic.calculateFairShares(
            Object.keys(result.people),
            result.transactions,
            result.people
        );

        // Total should be 100.00
        const totalPaid = Object.values(fairShares).reduce((sum, amount) => sum + amount, 0);
        test.assertEqual(totalPaid, 100.00);

        // Each person should pay 25.00
        test.assertEqual(fairShares.John, 25.00);
        test.assertEqual(fairShares.Jane, 25.00);
        test.assertEqual(fairShares.Bob, 25.00);
        test.assertEqual(fairShares.Alice, 25.00);
    });

    test.test('large remainder distributed equally first, then by priority', () => {
        const input = `
John
50.01 Small expense

Jane
Bob
Charlie`;

        const result = ExpenseLogic.parseExpenses(input);
        const fairShares = CalculationLogic.calculateFairShares(
            Object.keys(result.people),
            result.transactions,
            result.people
        );

        // Total should be 50.01, which when divided by 4 gives 12.5025 each
        // Floor gives 12.50 to everyone (50.00 total), 1 cent remainder
        const totalPaid = Object.values(fairShares).reduce((sum, amount) => sum + amount, 0);
        test.assertEqual(totalPaid, 50.01);

        // Three people should get 12.50, one person should get 12.51
        const values = Object.values(fairShares);
        const count1250 = values.filter(v => v === 12.50).length;
        const count1251 = values.filter(v => v === 12.51).length;

        test.assertEqual(count1250, 3, 'Three people should get 12.50');
        test.assertEqual(count1251, 1, 'One person should get 12.51');

        // The person who gets 12.51 should be a non-payer (Jane, Bob, or Charlie)
        test.assertTrue(
            fairShares.Jane === 12.51 || fairShares.Bob === 12.51 || fairShares.Charlie === 12.51,
            'Extra cent should go to a non-payer'
        );

    });
});

test.suite('CalculationLogic.createExpenseGroups', () => {
    test.test('creates groups for all-participant expenses', () => {
        const transactions = [
            { type: 'expense', amount: 100, paidBy: 'John', sharedWith: [] },
            { type: 'expense', amount: 50, paidBy: 'Jane', sharedWith: [] }
        ];
        const names = ['John', 'Jane', 'Bob'];
        const peopleData = {
            'John': { parts: 1, isExcluded: false },
            'Jane': { parts: 1, isExcluded: false },
            'Bob': { parts: 1, isExcluded: false }
        };

        const groups = CalculationLogic.createExpenseGroups(transactions, names, peopleData);

        test.assertEqual(Object.keys(groups).length, 1, 'Should create 1 group for all-participant expenses');
        const group = Object.values(groups)[0];
        test.assertEqual(group.participants.sort(), ['Bob', 'Jane', 'John'], 'All non-excluded participants should be included');
        test.assertEqual(group.totalAmount, 150, 'Total amount should be sum of expenses');
        test.assertEqual(group.payments.John, 10000, 'John should have paid 100.00 in cents');
        test.assertEqual(group.payments.Jane, 5000, 'Jane should have paid 50.00 in cents');
        test.assertEqual(group.payments.Bob, 0, 'Bob should have paid 0');
    });

    test.test('creates separate groups for specific participant expenses', () => {
        const transactions = [
            { type: 'expense', amount: 100, paidBy: 'John', sharedWith: ['John', 'Jane'] },
            { type: 'expense', amount: 50, paidBy: 'Alice', sharedWith: ['Alice', 'Bob'] }
        ];
        const names = ['John', 'Jane', 'Bob', 'Alice'];
        const peopleData = {
            'John': { parts: 1, isExcluded: false },
            'Jane': { parts: 1, isExcluded: false },
            'Bob': { parts: 1, isExcluded: false },
            'Alice': { parts: 1, isExcluded: false }
        };

        const groups = CalculationLogic.createExpenseGroups(transactions, names, peopleData);

        test.assertEqual(Object.keys(groups).length, 2, 'Should create 2 separate groups');

        const johnGroup = Object.values(groups).find(g => g.participants.includes('John') && g.participants.includes('Jane'));
        const aliceGroup = Object.values(groups).find(g => g.participants.includes('Alice') && g.participants.includes('Bob'));

        test.assertTrue(johnGroup, 'Should have John-Jane group');
        test.assertTrue(aliceGroup, 'Should have Alice-Bob group');
        test.assertEqual(johnGroup.participants.sort(), ['Jane', 'John'], 'John group should have John and Jane');
        test.assertEqual(aliceGroup.participants.sort(), ['Alice', 'Bob'], 'Alice group should have Alice and Bob');
        test.assertEqual(johnGroup.totalAmount, 100, 'John group total should be 100');
        test.assertEqual(aliceGroup.totalAmount, 50, 'Alice group total should be 50');
    });

    test.test('excludes excluded people from all-participant expenses', () => {
        const transactions = [
            { type: 'expense', amount: 100, paidBy: 'John', sharedWith: [] }
        ];
        const names = ['John', 'Jane', 'Restaurant!'];
        const peopleData = {
            'John': { parts: 1, isExcluded: false },
            'Jane': { parts: 1, isExcluded: false },
            'Restaurant!': { parts: 1, isExcluded: true }
        };

        const groups = CalculationLogic.createExpenseGroups(transactions, names, peopleData);

        test.assertEqual(Object.keys(groups).length, 1, 'Should create 1 group');
        const group = Object.values(groups)[0];
        test.assertEqual(group.participants.sort(), ['Jane', 'John'], 'Should exclude Restaurant!');
        test.assertEqual(group.totalAmount, 100, 'Total amount should be 100');
    });

    test.test('includes excluded people when explicitly specified', () => {
        const transactions = [
            { type: 'expense', amount: 100, paidBy: 'John', sharedWith: ['John', 'Restaurant!'] }
        ];
        const names = ['John', 'Jane', 'Restaurant!'];
        const peopleData = {
            'John': { parts: 1, isExcluded: false },
            'Jane': { parts: 1, isExcluded: false },
            'Restaurant!': { parts: 1, isExcluded: true }
        };

        const groups = CalculationLogic.createExpenseGroups(transactions, names, peopleData);

        test.assertEqual(Object.keys(groups).length, 1, 'Should create 1 group');
        const group = Object.values(groups)[0];
        test.assertEqual(group.participants.sort(), ['John', 'Restaurant!'], 'Should include Restaurant! when explicitly specified');
        test.assertEqual(group.totalAmount, 100, 'Total amount should be 100');
    });

    test.test('handles empty transactions array', () => {
        const groups = CalculationLogic.createExpenseGroups([], ['John', 'Jane'], { 'John': { parts: 1 }, 'Jane': { parts: 1 } });
        test.assertEqual(Object.keys(groups).length, 0, 'Should return empty object for no transactions');
    });

    test.test('filters out non-expense transactions', () => {
        const transactions = [
            { type: 'expense', amount: 100, paidBy: 'John', sharedWith: [] },
            { type: 'settlement', amount: 25, paidBy: 'John', settleTo: 'Jane' },
            { type: 'percentage', percentage: 10, paidBy: 'John', sharedWith: [] }
        ];
        const names = ['John', 'Jane'];
        const peopleData = { 'John': { parts: 1 }, 'Jane': { parts: 1 } };

        const groups = CalculationLogic.createExpenseGroups(transactions, names, peopleData);

        test.assertEqual(Object.keys(groups).length, 1, 'Should only process expense transactions');
        const group = Object.values(groups)[0];
        test.assertEqual(group.totalAmount, 100, 'Should only include expense amount');
    });
});

test.suite('Test Framework Validation', () => {
    test.test('assertApproxEqual works with positive tolerance', () => {
        // These should pass
        test.assertApproxEqual(1.001, 1.000, 0.01);
        test.assertApproxEqual(1.000, 1.001, 0.01);
        test.assertApproxEqual(10.05, 10.03, 0.05);
    });

    test.test('assertApproxEqual works with negative tolerance input', () => {
        // Should handle negative tolerance by taking absolute value
        test.assertApproxEqual(1.001, 1.000, -0.01);
        test.assertApproxEqual(1.000, 1.001, -0.01);
    });

    test.test('assertApproxEqual fails when difference exceeds tolerance', () => {
        let errorThrown = false;
        try {
            test.assertApproxEqual(1.1, 1.0, 0.05);
        } catch (error) {
            errorThrown = true;
            test.assertTrue(error.message.includes('Expected approximately 1'), 'Error message should contain expected value');
            test.assertTrue(error.message.includes('got 1.1'), 'Error message should contain actual value');
            test.assertTrue(error.message.includes('±0.05'), 'Error message should show tolerance');
            test.assertTrue(error.message.includes('difference: 0.1'), 'Error message should show actual difference');
        }
        test.assertTrue(errorThrown, 'Should throw error when difference exceeds tolerance');
    });

    test.test('assertApproxEqual works with zero values', () => {
        test.assertApproxEqual(0, 0, 0.01);
        test.assertApproxEqual(0.005, 0, 0.01);
        test.assertApproxEqual(-0.005, 0, 0.01);
    });

    test.test('assertApproxEqual works with negative values', () => {
        test.assertApproxEqual(-1.001, -1.000, 0.01);
        test.assertApproxEqual(-10.05, -10.03, 0.05);
    });

    test.test('assertThrows works correctly', () => {
        // Should catch thrown errors
        const error = test.assertThrows(() => {
            throw new Error('Test error message');
        }, 'Test error');

        test.assertTrue(error.message.includes('Test error message'));
    });

    test.test('assertThrows fails when no error is thrown', () => {
        let testFailed = false;
        try {
            test.assertThrows(() => {
                // This function doesn't throw
                return 42;
            });
        } catch (error) {
            testFailed = true;
            test.assertTrue(error.message.includes('Expected function to throw an error'));
        }
        test.assertTrue(testFailed, 'assertThrows should fail when function does not throw');
    });

    test.test('assertThrows validates error message', () => {
        let testFailed = false;
        try {
            test.assertThrows(() => {
                throw new Error('Wrong message');
            }, 'Expected message');
        } catch (error) {
            testFailed = true;
            test.assertTrue(error.message.includes('Expected error message to contain'));
        }
        test.assertTrue(testFailed, 'assertThrows should fail when error message does not match');
    });
});

test.suite('Group-Based Settlement Logic', () => {
    test.test('correctly splits costs and settlements within expense groups', () => {
        const input = `
John
100.00 - John, Jane, Bob

Jane
Bob

Alice
100.00 - Alice, Carlos, Luan

Carlos
Luan`;

        const result = ExpenseLogic.parseExpenses(input);

        // Verify people setup
        test.assertEqual(Object.keys(result.people).length, 6);
        test.assertTrue(result.people['John'], 'John should be parsed');
        test.assertTrue(result.people['Jane'], 'Jane should be parsed');
        test.assertTrue(result.people['Bob'], 'Bob should be parsed');
        test.assertTrue(result.people['Alice'], 'Alice should be parsed');
        test.assertTrue(result.people['Carlos'], 'Carlos should be parsed');
        test.assertTrue(result.people['Luan'], 'Luan should be parsed');

        // Verify transactions
        test.assertEqual(result.transactions.length, 2);
        test.assertEqual(result.transactions[0].type, 'expense');
        test.assertEqual(result.transactions[0].amount, 100);
        test.assertEqual(result.transactions[0].paidBy, 'John');
        test.assertEqual(result.transactions[0].sharedWith.sort(), ['Bob', 'Jane', 'John']);

        test.assertEqual(result.transactions[1].type, 'expense');
        test.assertEqual(result.transactions[1].amount, 100);
        test.assertEqual(result.transactions[1].paidBy, 'Alice');
        test.assertEqual(result.transactions[1].sharedWith.sort(), ['Alice', 'Carlos', 'Luan']);

        // Calculate fair shares
        const names = Object.keys(result.people);
        const fairShares = CalculationLogic.calculateFairShares(names, result.transactions, result.people);

        // Verify total costs
        const totalCosts = Object.values(fairShares).reduce((sum, amount) => sum + amount, 0);
        test.assertEqual(totalCosts, 200.00, 'Total costs should be 200.00');

        // Verify expected fair shares with proper rounding
        test.assertEqual(fairShares.John, 33.33, 'John should pay 33.33');
        test.assertEqual(fairShares.Jane, 33.34, 'Jane should pay 33.34 (gets remainder cent)');
        test.assertEqual(fairShares.Bob, 33.33, 'Bob should pay 33.33');
        test.assertEqual(fairShares.Alice, 33.33, 'Alice should pay 33.33');
        test.assertEqual(fairShares.Carlos, 33.34, 'Carlos should pay 33.34 (gets remainder cent)');
        test.assertEqual(fairShares.Luan, 33.33, 'Luan should pay 33.33');

        // Use the helper function to verify expense groups structure
        const expenseGroups = CalculationLogic.createExpenseGroups(result.transactions, Object.keys(result.people), result.people);

        // Create a map for easier verification
        const settlementMap = {};
        const settlements = CalculationLogic.calculateSettlements(result.people, result.transactions);
        settlements.forEach(settlement => {
            const key = `${settlement.from}-${settlement.to}`;
            settlementMap[key] = settlement.amount;
        });

        // Verify expense groups are correctly structured
        const groupKeys = Object.keys(expenseGroups);
        test.assertEqual(groupKeys.length, 2, 'Should have 2 expense groups');

        // Find the groups
        const johnGroup = Object.values(expenseGroups).find(g => g.participants.includes('John') && g.participants.includes('Jane'));
        const aliceGroup = Object.values(expenseGroups).find(g => g.participants.includes('Alice') && g.participants.includes('Carlos'));

        test.assertTrue(johnGroup, 'Should have John\'s group with John, Jane, Bob');
        test.assertTrue(aliceGroup, 'Should have Alice\'s group with Alice, Carlos, Luan');
        test.assertEqual(johnGroup.participants.sort(), ['Bob', 'Jane', 'John'], 'John\'s group participants');
        test.assertEqual(aliceGroup.participants.sort(), ['Alice', 'Carlos', 'Luan'], 'Alice\'s group participants');

        // Verify we have the expected number of settlements
        test.assertEqual(settlements.length, 4, 'Should have 4 settlement transactions');

        // Verify settlements are within the correct groups
        // John's group: Jane and Bob should pay John
        // Alice's group: Carlos and Luan should pay Alice
        test.assertTrue(settlementMap['Jane-John'] !== undefined, 'Jane should pay John');
        test.assertTrue(settlementMap['Bob-John'] !== undefined, 'Bob should pay John');
        test.assertEqual(settlementMap['Jane-John'], 33.34, 'Jane should pay 33.34 to John');
        test.assertEqual(settlementMap['Bob-John'], 33.33, 'Bob should pay 33.33 to John');

        // Alice's group: Carlos and Luan should pay Alice
        test.assertTrue(settlementMap['Carlos-Alice'] !== undefined, 'Carlos should pay Alice');
        test.assertTrue(settlementMap['Luan-Alice'] !== undefined, 'Luan should pay Alice');
        test.assertEqual(settlementMap['Carlos-Alice'], 33.34, 'Carlos should pay 33.34 to Alice');
        test.assertEqual(settlementMap['Luan-Alice'], 33.33, 'Luan should pay 33.33 to Alice');

        // Verify no cross-group settlements
        test.assertTrue(settlementMap['Carlos-John'] === undefined, 'Carlos should NOT pay John (wrong group)');
        test.assertTrue(settlementMap['Luan-John'] === undefined, 'Luan should NOT pay John (wrong group)');
        test.assertTrue(settlementMap['Jane-Alice'] === undefined, 'Jane should NOT pay Alice (wrong group)');
        test.assertTrue(settlementMap['Bob-Alice'] === undefined, 'Bob should NOT pay Alice (wrong group)');
    });

    test.test('prioritizes original order for remainder distribution within groups', () => {
        const input = `
Adam
100.00 - Adam, Bob, Charlie

Bob
Charlie`;

        const result = ExpenseLogic.parseExpenses(input);
        const fairShares = CalculationLogic.calculateFairShares(
            Object.keys(result.people),
            result.transactions,
            result.people
        );

        // Adam paid, so Bob and Charlie should split the 100.00
        // Bob comes first in the original list, so should get the remainder cent
        test.assertEqual(fairShares.Adam, 33.33, 'Adam should pay 33.33');
        test.assertEqual(fairShares.Bob, 33.34, 'Bob should pay 33.34 (first in list, gets remainder)');
        test.assertEqual(fairShares.Charlie, 33.33, 'Charlie should pay 33.33');
    });
});

// Run all tests
if (require.main === module) {
    test.run();
}

module.exports = { test, TestFramework };