// ===== SPLITWISER CORE LOGIC LIBRARY =====
// Pure business logic functions with no DOM dependencies
// This file depends on locale.js and should be included after it

// Configuration constants
const CONFIG_CONSTANTS = {
    // Timing values (in milliseconds)
    DEBOUNCE_TIMEOUT: 300,
    COPY_SUCCESS_TIMEOUT: 2000,
    SETTLEMENT_SUCCESS_TIMEOUT: 800,

    // Animation delays (in milliseconds)
    PERSON_ANIMATION_DELAY: 50,

    // Transaction types
    TRANSACTION_TYPES: {
        EXPENSE: 'expense',
        SETTLEMENT: 'settlement',
        PERCENTAGE: 'percentage'
    },

    // LocalStorage
    STORAGE_KEY: 'expenseInputData',

};

// Keep CONSTANTS for configuration, LOCALE for localization
const CONSTANTS = CONFIG_CONSTANTS;

// ===== CORE LOGIC UTILITIES =====
// These utilities contain pure business logic without DOM manipulation

// Validation Logic Module
const ValidationLogic = {
    // Validate a person reference and return validation result
    validatePersonReference(personRef, people, personData) {
        // Skip empty references
        if (!personRef || personRef.trim() === '') {
            return { isValid: true, matches: [] };
        }

        const trimmedRef = personRef.trim();

        // Find potential matches
        const exactMatches = people.filter(name => name === trimmedRef);
        const partialMatches = people.filter(name =>
            name.toLowerCase().startsWith(trimmedRef.toLowerCase())
        );
        const displayMatches = people.filter(name => {
            const info = personData[name];
            return info && info.displayName.toLowerCase().startsWith(trimmedRef.toLowerCase());
        });

        // Get unique matches
        const allMatches = [...new Set([...exactMatches, ...partialMatches, ...displayMatches])];

        return {
            isValid: allMatches.length === 1,
            matches: allMatches,
            isAmbiguous: allMatches.length > 1,
            notFound: allMatches.length === 0,
            personRef: trimmedRef
        };
    },

    // Validate expenses and return warnings
    validateExpenses(text) {
        const lines = text.split('\n').map(line => line.trim());
        const warnings = [];
        const people = [];
        const personData = {};

        // First pass: collect all person names and detect duplicates
        const seenDisplayNames = new Map(); // Track display names case-insensitively
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            if (line === '') continue;

            const expenseMatch = line.match(/^(\d+(?:[.,]\d+)*(?:[.,]\d{1,2})?)/);
            const startsWithLetter = /^\s*[a-zA-ZÀ-ÿ]/i.test(line);

            if (!expenseMatch && startsWithLetter && line.length > 0) {
                people.push(line);

                const personInfo = PersonLogic.parsePersonName(line);
                const displayName = personInfo.displayName;
                const baseName = personInfo.baseName;

                // Check for case-insensitive duplicate names using baseName (without !)
                const lowerBaseName = baseName.toLowerCase();
                if (seenDisplayNames.has(lowerBaseName)) {
                    const existingLine = seenDisplayNames.get(lowerBaseName);
                    warnings.push({
                        text: line,
                        error: formatTemplate(LOCALE.getString('DUPLICATE_NAME_TEMPLATE'), {
                            currentName: displayName,
                            existingName: existingLine.displayName
                        })
                    });
                } else {
                    seenDisplayNames.set(lowerBaseName, { displayName });
                }

                personData[line] = { displayName, originalName: line };
            }
        }

        // Second pass: check for ambiguous references in expenses and validate settlements
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            if (line === '') continue;

            // Check settlement lines (amount > person)
            const settlementMatch = line.match(/^(\d+(?:[.,]\d+)*(?:[.,]\d{1,2})?)\s*>\s*(.+)$/);
            if (settlementMatch) {
                const personRef = settlementMatch[2].trim();
                const validation = this.validatePersonReference(personRef, people, personData);

                if (validation.isAmbiguous) {
                    const matchingNames = validation.matches.map(name => personData[name].displayName).join(', ');
                    warnings.push({
                        text: line,
                        error: formatTemplate(LOCALE.getString('AMBIGUOUS_PERSON_TEMPLATE'), {
                            personRef: validation.personRef,
                            matchingNames: matchingNames
                        })
                    });
                } else if (validation.notFound) {
                    warnings.push({
                        text: line,
                        error: formatTemplate(LOCALE.getString('PERSON_NOT_FOUND_TEMPLATE'), {
                            personRef: validation.personRef,
                            errorMessage: LOCALE.getString('PERSON_NOT_FOUND')
                        })
                    });
                }
            }

            // Check expense lines (amount description - person1, person2, ...)
            const sharedMatch = line.match(/^(\d+(?:[.,]\d+)*(?:[.,]\d{1,2})?)(.+?)\s*-\s*(.+)$/);
            if (sharedMatch) {
                const peopleStr = sharedMatch[3].trim();
                const peopleRefs = peopleStr.split(',').map(p => p.trim());

                for (const personRef of peopleRefs) {
                    const validation = this.validatePersonReference(personRef, people, personData);

                    // Skip empty references
                    if (!validation.personRef) {
                        continue;
                    }

                    if (validation.isAmbiguous) {
                        const matchingNames = validation.matches.map(name => personData[name].displayName).join(', ');
                        warnings.push({
                            text: line,
                         error: formatTemplate(LOCALE.getString('AMBIGUOUS_PERSON_TEMPLATE'), {
                                personRef: validation.personRef,                                matchingNames: matchingNames
                            })
                        });
                    } else if (validation.notFound) {
                        warnings.push({
                            text: line,
                             error: formatTemplate(LOCALE.getString('PERSON_NOT_FOUND_TEMPLATE'), {
                                personRef: validation.personRef,
                                errorMessage: LOCALE.getString('PERSON_NOT_FOUND')                            })
                        });
                    }
                }
            }
        }

        return warnings;
    }
};

// Person Logic Module
const PersonLogic = {
    // Find person by name or initial
    findPersonByNameOrInitial(nameOrInitial, allNames, personData) {
        const validation = ValidationLogic.validatePersonReference(nameOrInitial, allNames, personData);
        return validation.isValid ? validation.matches[0] : null;
    },

    // Parse person name from input string
    parsePersonName(personString) {
        // Check for ! anywhere in the string (excluded from shared expenses)
        const isExcluded = personString.includes('!');

        // Remove ! from the string for processing
        const cleanedString = personString.replace(/!/g, '');

        // Look for the first number in the string for parts count
        const numberMatch = cleanedString.match(/(\d+)/);
        const parts = numberMatch ? parseInt(numberMatch[1]) : 1;

        // Remove all non-letter characters except spaces, keeping only letters and spaces
        let baseName = cleanedString.replace(/[^a-zA-ZÀ-ÿ\s]/g, '').trim();

        // Normalize multiple spaces
        baseName = baseName.replace(/\s+/g, ' ').trim();

        // Fallback: if baseName is empty, use the cleaned string without numbers
        if (!baseName) {
            baseName = cleanedString.replace(/\d+/g, '').trim();
        }

        // Create display name - always format as Name! if excluded, regardless of original ! placement
        const displayName = isExcluded ? baseName + '!' : baseName;

        return {
            displayName: displayName,
            baseName: baseName, // Base name without ! for duplicate checking
            parts: parts,
            originalName: personString,
            isExcluded: isExcluded
        };
    },

    // Format person name with parts count
    formatWithParts(displayName, parts) {
        if (parts > 1) {
            return formatTemplate(LOCALE.getString('PERSON_WITH_PARTS_TEMPLATE'), {
                displayName: displayName,
                parts: parts
            });
        }
        return displayName;
    },

    // Clean person name for settlements (removes !)
    cleanForSettlement(displayName) {
        return displayName ? displayName.replace(/!$/, '') : displayName;
    },

    // Get clean settlement names from settlement object
    getSettlementNames(settlement, people, fromKey = 'from', toKey = 'to') {
        const fromPerson = people[settlement[fromKey]];
        const toPerson = people[settlement[toKey]];
        const fromName = this.cleanForSettlement(fromPerson ? fromPerson.displayName : settlement[fromKey]);
        const toName = this.cleanForSettlement(toPerson ? toPerson.displayName : settlement[toKey]);
        return { fromName, toName };
    }
};

// Transaction Parsing Logic Module
const TransactionLogic = {
    // Helper function to resolve participant names
    resolveParticipants(peopleStr, allNames, personData) {
        if (!peopleStr || peopleStr.trim() === '') {
            return []; // Empty array means all participants
        }

        const peopleNames = peopleStr.split(',').map(p => p.trim());
        const resolvedPeople = [];

        for (const personRef of peopleNames) {
            const resolvedPerson = PersonLogic.findPersonByNameOrInitial(personRef, allNames, personData);
            if (resolvedPerson) {
                resolvedPeople.push(resolvedPerson);
            }
        }

        return resolvedPeople;
    },

    // Parse a transaction line into structured data
    parseTransaction(expenseLine, allNames, personData) {
        // Try percentage fee pattern: percentage% description [- participants]
        const percentageMatch = expenseLine.match(/^(\d+(?:[.,]\d+)?)\s*%\s*(.*)$/);
        if (percentageMatch) {
            const percentage = NumberLogic.parseNumber(percentageMatch[1]);
            const restOfLine = percentageMatch[2].trim();

            // Check if there are participants specified
            const participantMatch = restOfLine.match(/^(.*?)\s*-\s*(.+)$/);
            let description, participantsStr;

            if (participantMatch) {
                description = participantMatch[1].trim();
                participantsStr = participantMatch[2];
            } else {
                // Handle case where there's a trailing dash but no participants
                const trailingDashMatch = restOfLine.match(/^(.*?)\s*-\s*$/);
                if (trailingDashMatch) {
                    description = trailingDashMatch[1].trim();
                    participantsStr = null;
                } else {
                    description = restOfLine;
                    participantsStr = null;
                }
            }

            if (!isNaN(percentage) && percentage > 0) {
                const sharedWith = this.resolveParticipants(participantsStr, allNames, personData);

                return {
                    type: CONSTANTS.TRANSACTION_TYPES.PERCENTAGE,
                    percentage: percentage,
                    description: description,
                    sharedWith: sharedWith
                };
            }
        }

        // Try settlement pattern: amount > person
        const settlementMatch = expenseLine.match(/^(\d+(?:[.,]\d+)*(?:[.,]\d{1,2})?)\s*>\s*(.+)$/);
        if (settlementMatch) {
            const amount = NumberLogic.parseNumber(settlementMatch[1]);
            const personStr = settlementMatch[2].trim();
            const resolvedPerson = PersonLogic.findPersonByNameOrInitial(personStr, allNames, personData);

            if (resolvedPerson && !isNaN(amount) && amount > 0) {
                return {
                    type: CONSTANTS.TRANSACTION_TYPES.SETTLEMENT,
                    amount: amount,
                    description: '',
                    settleTo: resolvedPerson
                };
            }
        }

        // Try expense pattern: amount [description] [- participants]
        const expenseMatch = expenseLine.match(/^(\d+(?:[.,]\d+)*(?:[.,]\d{1,2})?)(.*)$/);
        if (expenseMatch) {
            const amount = NumberLogic.parseNumber(expenseMatch[1]);
            const restOfLine = expenseMatch[2].trim();

            // Check if there are participants specified
            const participantMatch = restOfLine.match(/^(.*?)\s*-\s*(.+)$/);
            let description, participantsStr;

            if (participantMatch) {
                description = participantMatch[1].trim();
                participantsStr = participantMatch[2];
            } else {
                // Handle case where there's a trailing dash but no participants
                const trailingDashMatch = restOfLine.match(/^(.*?)\s*-\s*$/);
                if (trailingDashMatch) {
                    description = trailingDashMatch[1].trim();
                    participantsStr = null;
                } else {
                    description = restOfLine;
                    participantsStr = null;
                }
            }

            if (!isNaN(amount) && amount > 0) {
                const sharedWith = this.resolveParticipants(participantsStr, allNames, personData);

                return {
                    type: CONSTANTS.TRANSACTION_TYPES.EXPENSE,
                    amount: amount,
                    description: description,
                    sharedWith: sharedWith
                };
            }
        }

        return null;
    }
};

// Number Logic Module
const NumberLogic = {
    // Parse number from string with various formats
    parseNumber(numStr) {
        try {
            numStr = numStr.trim();

            // Handle simple integers
            if (/^\d+$/.test(numStr)) {
                return parseFloat(numStr);
            }

            // Remove any non-digit, non-comma, non-dot characters
            const cleaned = numStr.replace(/[^\d.,]/g, '');
            if (!cleaned) return NaN;

            const lastDot = cleaned.lastIndexOf('.');
            const lastComma = cleaned.lastIndexOf(',');

            // No separators
            if (lastDot === -1 && lastComma === -1) {
                return parseFloat(cleaned);
            }

            // Only dots or only commas
            if (lastComma === -1) {
                // Only dots: could be US format (1,234.56) or thousands (1.234)
                const parts = cleaned.split('.');
                const lastPart = parts[parts.length - 1];
                if (lastPart.length <= 2 && parts.length >= 2) {
                    // Likely decimal: 1.234.56 -> 1234.56
                    return parseFloat(parts.slice(0, -1).join('') + '.' + lastPart);
                } else {
                    // Likely thousands: 1.234 -> 1234
                    return parseFloat(cleaned.replace(/\./g, ''));
                }
            }

            if (lastDot === -1) {
                // Only commas: could be European format (1.234,56) or thousands (1,234)
                const parts = cleaned.split(',');
                const lastPart = parts[parts.length - 1];
                if (lastPart.length <= 2 && parts.length >= 2) {
                    // Likely decimal: 123,45 or 1.234,56
                    return parseFloat(cleaned.replace(/\./g, '').replace(',', '.'));
                } else {
                    // Likely thousands: 1,234 -> 1234
                    return parseFloat(cleaned.replace(/,/g, ''));
                }
            }

            // Both separators present
            if (lastDot > lastComma) {
                // Dot comes last: assume US format (1,234.56)
                const afterDot = cleaned.substring(lastDot + 1);
                if (afterDot.length <= 2) {
                    return parseFloat(cleaned.replace(/,/g, ''));
                }
            } else {
                // Comma comes last: assume European format (1.234,56)
                const afterComma = cleaned.substring(lastComma + 1);
                if (afterComma.length <= 2) {
                    return parseFloat(cleaned.replace(/\./g, '').replace(',', '.'));
                }
            }

            // Fallback: remove all separators except the last one
            const allSeparators = [...cleaned.matchAll(/[.,]/g)];
            if (allSeparators.length > 0) {
                const lastSeparator = allSeparators[allSeparators.length - 1];
                const beforeLast = cleaned.substring(0, lastSeparator.index);
                const afterLast = cleaned.substring(lastSeparator.index + 1);

                if (afterLast.length <= 2) {
                    // Treat as decimal
                    const cleanBefore = beforeLast.replace(/[.,]/g, '');
                    return parseFloat(cleanBefore + '.' + afterLast);
                }
            }

            return parseFloat(cleaned.replace(/[.,]/g, ''));
        } catch (error) {
            console.error('Error parsing number:', numStr, error);
            return NaN;
        }
    },

    // Format number for display
    formatNumber(amount) {
        try {
            // Prevent negative zero display
            if (amount === 0 || Math.abs(amount) < 0.005) {
                amount = 0;
            }
            return amount.toLocaleString(getLocale(), {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2
            });
        } catch (error) {
            console.error('Error formatting number:', error);
            // Fallback to fixed decimal if locale formatting fails
            // Also handle negative zero in fallback
            if (amount === 0 || Math.abs(amount) < 0.005) {
                amount = 0;
            }
            return amount.toFixed(2);
        }
    }
};

// Expense Parsing Logic Module
const ExpenseLogic = {
    // Parse expenses text into structured data
    parseExpenses(text) {

        // First, validate the input for any errors
        const validationWarnings = ValidationLogic.validateExpenses(text);
        if (validationWarnings.length > 0) {
            // Create a detailed error message with all validation issues
            const errorMessages = validationWarnings.map(warning => `${warning.text}: ${warning.error}`);
            throw new Error(`Validation failed:\n${errorMessages.join('\n')}`);
        }

        const lines = text.split('\n').map(line => line.trim());
        const people = {};
        const transactions = [];
        let currentPerson = null;

        // First pass: collect all person names with their parts
        const allNames = [];
        const personData = {};
        const seenDisplayNames = new Map(); // Track display names case-insensitively
        for (const line of lines) {
            if (line === '') continue;

            const expenseMatch = line.match(/^(\d+(?:[.,]\d+)*(?:[.,]\d{1,2})?)/);
            const startsWithLetter = /^\s*[a-zA-ZÀ-ÿ]/i.test(line);

            if (!expenseMatch && startsWithLetter && line.length > 0) {
                const personInfo = PersonLogic.parsePersonName(line);

                // Check for case-insensitive duplicate names using baseName (without !)
                const lowerBaseName = personInfo.baseName.toLowerCase();
                if (seenDisplayNames.has(lowerBaseName)) {
                    // Skip duplicate names to prevent processing errors
                    continue;
                }
                seenDisplayNames.set(lowerBaseName, personInfo.displayName);

                allNames.push(line);
                personData[line] = personInfo;
            }
        }

        // Initialize people objects
        allNames.forEach(name => {
            people[name] = {
                expenses: [],
                total: 0,
                displayName: personData[name].displayName,
                parts: personData[name].parts,
                isExcluded: personData[name].isExcluded
            };
        });

        // Second pass: process transactions
        for (const line of lines) {
            if (line === '') {
                continue;
            }

            // Enhanced regex to capture numbers with various formats (positive only)
            const expenseMatch = line.match(/^(\d+(?:[.,]\d+)*(?:[.,]\d{1,2})?)/);

            if (expenseMatch && currentPerson) {
                // Parse transaction (expense or settlement)
                const parsedTransaction = TransactionLogic.parseTransaction(line, allNames, personData);
                const amount = NumberLogic.parseNumber(expenseMatch[1]);
                const description = line.substring(expenseMatch[0].length).trim();

                if (!isNaN(amount) && amount > 0 && allNames.length > 0) {
                    let finalTransaction;

                    if (parsedTransaction) {
                        // Use parsed transaction details
                        finalTransaction = {
                            ...parsedTransaction,
                            paidBy: currentPerson
                        };
                    } else {
                        // Default amounts to be split among all people
                        finalTransaction = {
                            type: CONSTANTS.TRANSACTION_TYPES.EXPENSE,
                            amount: amount,
                            description: description,
                            sharedWith: [], // empty array means all participants
                            paidBy: currentPerson
                        };
                    }

                    transactions.push(finalTransaction);

                    // Add to person's expenses list
                    let description = finalTransaction.description;

                    // Add participants to description if it's an expense/percentage with specific people
                    const hasSpecificParticipants = (finalTransaction.type === CONSTANTS.TRANSACTION_TYPES.EXPENSE ||
                                                    finalTransaction.type === CONSTANTS.TRANSACTION_TYPES.PERCENTAGE) &&
                                                    finalTransaction.sharedWith.length > 0;

                    if (hasSpecificParticipants) {
                        description = formatTemplate(LOCALE.getString('EXPENSE_WITH_PARTICIPANTS_TEMPLATE'), {
                            description: finalTransaction.description,
                            participants: finalTransaction.sharedWith.join(', ')
                        });
                    }

                    const expenseEntry = {
                        description: description,
                        type: finalTransaction.type
                    };

                    if (finalTransaction.type === CONSTANTS.TRANSACTION_TYPES.PERCENTAGE) {
                        expenseEntry.percentage = finalTransaction.percentage;
                    } else {
                        expenseEntry.amount = amount;
                    }

                    people[currentPerson].expenses.push(expenseEntry);

                    // Only add to total for non-percentage transactions (percentages are calculated later)
                    if (finalTransaction.type !== CONSTANTS.TRANSACTION_TYPES.PERCENTAGE) {
                        people[currentPerson].total += amount;
                    }
                }
            } else {
                // Check if this line could be a person's name (starts with letter)
                const startsWithLetter = /^\s*[a-zA-ZÀ-ÿ]/i.test(line);
                if (startsWithLetter && line.length > 0) {
                    // This is a person's name
                    currentPerson = line;
                    if (!people[currentPerson]) {
                        people[currentPerson] = {
                            expenses: [],
                            total: 0
                        };
                    }
                }
                // If line doesn't match expense format and doesn't start with letter, ignore it
            }
        }

        return { people, transactions };
    }
};

// Calculation Logic Module
const CalculationLogic = {
    // Helper method to create expense groups from transactions
    createExpenseGroups(transactions, names, peopleData) {
        const expenseTransactions = this.getExpenseTransactions(transactions);
        const consolidatedGroups = {};
        
        expenseTransactions.forEach(transaction => {
            const { amount, sharedWith, paidBy } = transaction;
            const amountCents = Math.round(amount * 100);

            // Use all participants if sharedWith is empty, otherwise use specified participants
            let participants = sharedWith.length === 0 ? names : sharedWith;

            // If sharedWith is empty (default sharing), exclude people marked with ! (including the payer if excluded)
            if (sharedWith.length === 0) {
                participants = names.filter(name => {
                    const personData = peopleData[name];
                    return !personData?.isExcluded;
                });
            }
            // Note: When sharedWith is explicitly specified, the payer may or may not be included
            // If payer is not in sharedWith, they are owed back but don't share the expense

            // Sort participants to create consistent group key
            const sortedParticipants = [...participants].sort();
            const groupKey = sortedParticipants.join('|');

            if (!consolidatedGroups[groupKey]) {
                consolidatedGroups[groupKey] = {
                    participants: sortedParticipants,
                    totalAmountCents: 0,
                    totalAmount: 0,
                    payments: {}, // Track how much each person paid in this group
                    payers: new Set() // Track all payers for this group
                };
                
                // Initialize payments for all participants
                sortedParticipants.forEach(person => {
                    consolidatedGroups[groupKey].payments[person] = 0;
                });
            }

            consolidatedGroups[groupKey].totalAmountCents += amountCents;
            consolidatedGroups[groupKey].totalAmount += amount;
            if (paidBy) {
                consolidatedGroups[groupKey].payers.add(paidBy);
                if (consolidatedGroups[groupKey].payments[paidBy] !== undefined) {
                    consolidatedGroups[groupKey].payments[paidBy] += amountCents;
                }
            }
        });

        return consolidatedGroups;
    },

    // Calculate fair shares for each person
    calculateFairShares(names, transactions, peopleData) {
        // Calculate total amounts each person owes across all expenses
        // Now uses parts/shares for proportional division instead of equal splits
        const totalOwed = {};
        names.forEach(name => {
            totalOwed[name] = 0;
        });

        // Use helper method to create consolidated expense groups
        const consolidatedGroups = this.createExpenseGroups(transactions, names, peopleData);

        // Process each consolidated group
        Object.values(consolidatedGroups).forEach(group => {
            const { participants, totalAmountCents, payments } = group;

            // Calculate total parts for this group
            const totalParts = participants.reduce((sum, person) => {
                const parts = peopleData[person] ? peopleData[person].parts : 1;
                return sum + parts;
            }, 0);

            // Calculate exact shares for this group and distribute remainders
            const groupShares = {};
            let groupRemainderCents = 0;

            participants.forEach(person => {
                const parts = peopleData[person] ? peopleData[person].parts : 1;
                // Use integer arithmetic to avoid floating point issues
                const exactShareCents = Math.floor((totalAmountCents * parts) / totalParts);
                const remainderCents = (totalAmountCents * parts) % totalParts;
                groupShares[person] = exactShareCents;
                groupRemainderCents += remainderCents;
            });

            // Convert accumulated remainders to cents by dividing by totalParts
            const additionalCents = Math.floor(groupRemainderCents / totalParts);
            const finalRemainderCents = groupRemainderCents % totalParts;

            // Distribute remainder cents within this group's participants
            if (finalRemainderCents > 0 || additionalCents > 0) {
                // Create priority list for this group's participants
                const priorityList = participants.map(person => {
                    const parts = peopleData[person] ? peopleData[person].parts : 1;
                    const remainderCents = (totalAmountCents * parts) % totalParts;
                    return {
                        person,
                        originalIndex: names.indexOf(person), // Keep original order from names list for tie-breaking
                        remainderCents: remainderCents,
                        amountPaid: payments[person] || 0,
                        parts: parts
                    };
                });

                // Sort by remainder cents descending, then by amount paid ascending (paid less first), then by original order
                priorityList.sort((a, b) => {
                    if (a.remainderCents !== b.remainderCents) {
                        return b.remainderCents - a.remainderCents;
                    }
                    // People who paid less get priority for remainder cents
                    if (a.amountPaid !== b.amountPaid) {
                        return a.amountPaid - b.amountPaid;
                    }
                    return a.originalIndex - b.originalIndex; // Tie-breaker by original order from names list
                });

                // Distribute final remainder cents to participants with largest remainders
                for (let i = 0; i < finalRemainderCents && i < priorityList.length; i++) {
                    groupShares[priorityList[i].person] += 1;
                }

                // Distribute additional cents proportionally within this group
                if (additionalCents > 0) {
                    let remainingAdditionalCents = additionalCents;
                    priorityList.forEach((item, index) => {
                        if (remainingAdditionalCents <= 0) return;
                        
                        // Calculate proportional share of additional cents for this person
                        const proportionalShare = Math.floor((remainingAdditionalCents * item.parts) / totalParts);
                        if (proportionalShare > 0) {
                            groupShares[item.person] += proportionalShare;
                            remainingAdditionalCents -= proportionalShare;
                        }
                    });
                    
                    // If there are still remaining cents due to rounding, distribute them one by one
                    for (let i = 0; remainingAdditionalCents > 0 && i < priorityList.length; i++) {
                        groupShares[priorityList[i].person] += 1;
                        remainingAdditionalCents--;
                    }
                }
            }

            // Add the final shares for this group to total owed
            Object.entries(groupShares).forEach(([person, shareCents]) => {
                totalOwed[person] += shareCents;
            });
        });

        

        

        // Apply percentage fees to each person's total using integer cents
        const percentageFees = this.getPercentageTransactions(transactions);

        // Apply percentage fees based on who they affect (sharedWith), not who paid them
        percentageFees.forEach(fee => {
            let affectedPeople = fee.sharedWith.length === 0 ? names : fee.sharedWith;

            // If sharedWith is empty (default sharing), exclude people marked with ! (including the payer if excluded)
            if (fee.sharedWith.length === 0) {
                affectedPeople = names.filter(name => {
                    const personData = peopleData[name];
                    return !personData?.isExcluded;
                });
            }

            affectedPeople.forEach(personName => {
                if (totalOwed[personName] !== undefined) {
                    // Calculate fee in cents to avoid floating point
                    const currentTotalCents = totalOwed[personName];
                    const feeAmountCents = Math.round((currentTotalCents * fee.percentage) / 100);
                    totalOwed[personName] += feeAmountCents;
                }
            });
        });

        // Convert cents to dollars for final fair shares
        const fairShares = {};
        names.forEach(name => {
            fairShares[name] = parseFloat((totalOwed[name] / 100).toFixed(2));
        });

        return fairShares;
    },

    // Calculate settlements needed
    calculateSettlements(people, transactions) {
        try {
            const names = Object.keys(people);
            if (names.length === 0) return [];

            const fairShares = this.calculateFairShares(names, transactions, people);

            // Calculate initial balances (what each person paid vs should pay)
            const balances = {};
            names.forEach(name => {
                balances[name] = 0;
            });

            // Start with what each person paid for expenses minus fair share
            names.forEach(name => {
                // Count base expenses paid
                const expensesPaid = people[name].expenses
                    .filter(expense => expense.type === CONSTANTS.TRANSACTION_TYPES.EXPENSE)
                    .reduce((sum, expense) => sum + (expense.amount || 0), 0);

                // Count percentage fees paid by this person
                const baseExpensesTotal = this.calculateBaseExpenses(transactions);
                const percentageFeesPaid = this.getPercentageTransactions(transactions)
                    .filter(transaction => transaction.paidBy === name)
                    .reduce((sum, transaction) => sum + (baseExpensesTotal * transaction.percentage / 100), 0);

                const totalPaid = expensesPaid + percentageFeesPaid;
                const totalShouldPay = fairShares[name];
                balances[name] = totalPaid - totalShouldPay;
            });

            // Group-first settlement approach
            const expenseGroups = this.createExpenseGroups(transactions, names, people);
            const allSettlements = [];
            const remainingBalances = { ...balances };

            // First: Calculate settlements within each expense group
            Object.values(expenseGroups).forEach(group => {
                const groupParticipants = group.participants;
                const groupBalances = {};
                
                // Extract balances for this group's participants
                groupParticipants.forEach(person => {
                    groupBalances[person] = remainingBalances[person] || 0;
                });

                // Calculate settlements within this group
                const groupSettlements = this.calculateGroupSettlements(groupBalances, groupParticipants);
                allSettlements.push(...groupSettlements);

                // Update remaining balances
                groupSettlements.forEach(settlement => {
                    remainingBalances[settlement.from] += settlement.amount;
                    remainingBalances[settlement.to] -= settlement.amount;
                });
            });

            // Second: Handle any remaining balances with cross-group settlements
            const remainingNames = Object.keys(remainingBalances).filter(name => Math.abs(remainingBalances[name]) > 0.01);
            if (remainingNames.length > 0) {
                const crossGroupSettlements = this.calculateIdealSettlements(remainingBalances, remainingNames);
                allSettlements.push(...crossGroupSettlements);
            }

            // Apply actual settlements and detect overpayments
            const actualSettlements = this.getSettlementTransactions(transactions);
            const overpaymentAdjustments = this.processActualSettlements(balances, actualSettlements, allSettlements);
            
            // Add overpayment adjustments to the settlements list
            const settlements = [...allSettlements, ...overpaymentAdjustments];
            return settlements;
            
        } catch (error) {
            console.error('Error calculating settlements:', error);
            return [];
        }
    },

    // Calculate settlements within a single expense group
    calculateGroupSettlements(groupBalances, groupParticipants) {
        const settlements = [];
        const processedDebts = new Set();
        
        // Create debtors and creditors lists for this group
        const debtors = groupParticipants
            .filter(name => groupBalances[name] < -0.01)
            .map(name => ({ name, amount: Math.abs(groupBalances[name]) }))
            .sort((a, b) => b.amount - a.amount);
        
        const creditors = groupParticipants
            .filter(name => groupBalances[name] > 0.01)
            .map(name => ({ name, amount: groupBalances[name] }))
            .sort((a, b) => b.amount - a.amount);

        // Calculate optimal settlements within this group
        let i = 0, j = 0;
        while (i < debtors.length && j < creditors.length) {
            const debtor = debtors[i];
            const creditor = creditors[j];
            const amount = Math.min(debtor.amount, creditor.amount);

            if (amount > 0.01) {
                const debtKey = `${debtor.name}-${creditor.name}`;
                if (!processedDebts.has(debtKey)) {
                    settlements.push({
                        from: debtor.name,
                        to: creditor.name,
                        amount: amount
                    });
                    processedDebts.add(debtKey);
                }

                // Update balances
                groupBalances[debtor.name] += amount;
                groupBalances[creditor.name] -= amount;
                
                debtor.amount -= amount;
                creditor.amount -= amount;
            }

            if (debtor.amount < 0.01) i++;
            if (creditor.amount < 0.01) j++;
        }

        return settlements;
    },

    // Calculate ideal settlements based on current balances
    calculateIdealSettlements(balances, names) {
        const settlements = [];
        const processedDebts = new Set();
        
        // Create debtors and creditors lists
        const debtors = names.filter(name => balances[name] < -0.01)
            .map(name => ({ name, amount: Math.abs(balances[name]) }))
            .sort((a, b) => b.amount - a.amount);
        
        const creditors = names.filter(name => balances[name] > 0.01)
            .map(name => ({ name, amount: balances[name] }))
            .sort((a, b) => b.amount - a.amount);

        // Calculate optimal settlements
        let i = 0, j = 0;
        while (i < debtors.length && j < creditors.length) {
            const debtor = debtors[i];
            const creditor = creditors[j];
            const amount = Math.min(debtor.amount, creditor.amount);

            if (amount > 0.01) {
                const debtKey = `${debtor.name}-${creditor.name}`;
                if (!processedDebts.has(debtKey)) {
                    settlements.push({
                        from: debtor.name,
                        to: creditor.name,
                        amount: amount
                    });
                    processedDebts.add(debtKey);
                }

                // Update balances
                balances[debtor.name] += amount;
                balances[creditor.name] -= amount;
                
                debtor.amount -= amount;
                creditor.amount -= amount;
            }

            if (debtor.amount < 0.01) i++;
            if (creditor.amount < 0.01) j++;
        }

        return settlements;
    },

    // Process actual settlements and detect overpayments
    processActualSettlements(balances, actualSettlements, idealSettlements) {
        const overpaymentAdjustments = [];
        
        // Create a map of ideal settlements for easy lookup
        const idealSettlementMap = new Map();
        idealSettlements.forEach(settlement => {
            const key = `${settlement.from}-${settlement.to}`;
            idealSettlementMap.set(key, settlement.amount);
        });

        actualSettlements.forEach(settlement => {
            if (settlement.settleTo && settlement.paidBy) {
                const key = `${settlement.paidBy}-${settlement.settleTo}`;
                const idealAmount = idealSettlementMap.get(key) || 0;
                const actualAmount = settlement.amount;
                
                if (actualAmount > idealAmount + 0.01) {
                    // Overpayment detected
                    const overpayment = actualAmount - idealAmount;
                    
                    // Create reverse settlement from recipient back to payer
                    overpaymentAdjustments.push({
                        from: settlement.settleTo,
                        to: settlement.paidBy,
                        amount: overpayment
                    });
                }
                
                // Apply the actual settlement to balances
                balances[settlement.paidBy] += actualAmount;
                balances[settlement.settleTo] -= actualAmount;
            }
        });

        return overpaymentAdjustments;
    },

    // Utility functions for expense calculations
    calculateBaseExpenses(transactions) {
        return this.getExpenseTransactions(transactions)
            .reduce((sum, transaction) => sum + transaction.amount, 0);
    },

    calculatePercentageFees(transactions, baseExpenses) {
        return this.getPercentageTransactions(transactions)
            .reduce((sum, transaction) => sum + (baseExpenses * transaction.percentage / 100), 0);
    },

    calculateTotalExpenses(transactions) {
        const baseExpenses = this.calculateBaseExpenses(transactions);
        const percentageFees = this.calculatePercentageFees(transactions, baseExpenses);
        return baseExpenses + percentageFees;
    },

    calculateTotalSettlements(transactions) {
        return this.getSettlementTransactions(transactions)
            .reduce((sum, transaction) => sum + transaction.amount, 0);
    },

    getExpenseTransactions(transactions) {
        return transactions.filter(t => t.type === CONSTANTS.TRANSACTION_TYPES.EXPENSE);
    },

    getSettlementTransactions(transactions) {
        return transactions.filter(t => t.type === CONSTANTS.TRANSACTION_TYPES.SETTLEMENT);
    },

    getPercentageTransactions(transactions) {
        return transactions.filter(t => t.type === CONSTANTS.TRANSACTION_TYPES.PERCENTAGE);
    }
};

// Copy text to clipboard with fallback support
function copyToClipboard(text) {
    if (navigator.clipboard && window.isSecureContext) {
        return navigator.clipboard.writeText(text);
    } else {
        // Fallback for older browsers or non-secure contexts
        const textArea = document.createElement('textarea');
        textArea.value = text;
        textArea.style.position = 'fixed';
        textArea.style.left = '-999999px';
        textArea.style.top = '-999999px';
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        document.execCommand('copy');
        textArea.remove();
        return Promise.resolve();
    }
}

// Format template strings with placeholder replacements
// Supports placeholders like {name}, {amount}, etc.
function formatTemplate(template, replacements) {
    if (!template || typeof template !== 'string') {
        return '';
    }

    let result = template;
    for (const [key, value] of Object.entries(replacements || {})) {
        const placeholder = `{${key}}`;
        result = result.replace(new RegExp(placeholder.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), String(value || ''));
    }
    return result;
}

// Conditional exports for Node.js compatibility
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        ValidationLogic,
        NumberLogic,
        PersonLogic,
        TransactionLogic,
        CalculationLogic,
        ExpenseLogic,
        formatTemplate,
        CONSTANTS
    };
}
