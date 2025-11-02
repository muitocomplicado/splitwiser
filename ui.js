// ===== SPLITWISER UI LIBRARY =====
// UI and DOM manipulation functions
// This file depends on lib.js and should be included after it

// Global state variables
let debounceTimer;
let currentPeopleData = {};
let currentSettlements = [];
let currentTransactions = [];
let isSettling = false;

// Global error handler
window.onerror = function(message, _source, _lineno, _colno, error) {
    console.error('Global error caught:', message, error);
    DOMUtils.resetResultsSections();
    return true;
};

// Promise rejection handler
window.addEventListener('unhandledrejection', function(event) {
    console.error('Unhandled promise rejection:', event.reason);
    DOMUtils.resetResultsSections();
    event.preventDefault();
});

// Unified refresh decision system
const RefreshManager = {
    // Create a hash focused only on calculation-affecting data
    createCalculationHash(people, transactions, type, settlements = []) {
        try {
            const dataToHash = {
                // Only include core person data that affects calculations
                people: Object.keys(people).sort().map(name => {
                    const person = people[name];
                    return {
                        displayName: person.displayName,
                        parts: person.parts,
                        isExcluded: person.isExcluded
                    };
                }),
                // Only include transaction data that affects calculations
                transactions: transactions
                    .filter(t => {
                        if (type === 'expenses') {
                            return t.type === 'expense' || t.type === 'percentage';
                        }
                        return true; // settlements need all transaction types
                    })
                    .map(t => ({
                        type: t.type,
                        amount: t.amount,
                        percentage: t.percentage,
                        paidBy: t.paidBy,
                        sharedWith: t.sharedWith ? t.sharedWith.slice().sort() : [],
                        settleTo: t.settleTo
                        // Explicitly exclude description
                    }))
            };

            // Include settlements for settlement calculations
            if (type === 'settlements') {
                dataToHash.settlements = settlements.map(s => ({
                    from: s.from,
                    to: s.to,
                    amount: s.amount
                }));
            }

            return JSON.stringify(dataToHash);
        } catch (error) {
            console.error('Error creating calculation hash:', error);
            return null;
        }
    },

    // Determine what sections need to be refreshed
    getRefreshDecisions(people, transactions, settlements, inputText) {
        try {
            // If no previous data, refresh everything (initial load)
            if (!currentPeopleData || Object.keys(currentPeopleData).length === 0 || !currentTransactions) {
                return {
                    refreshExpenses: true,
                    refreshSettlements: true,
                    isInitialLoad: true
                };
            }

            // If new data is empty but we had data before, refresh to show empty state
            if (!people || Object.keys(people).length === 0) {
                return {
                    refreshExpenses: true,
                    refreshSettlements: true,
                    isInitialLoad: false
                };
            }

            // Create hashes for comparison - only include calculation-affecting data
            const newExpensesHash = this.createCalculationHash(people, transactions, 'expenses');
            const newSettlementsHash = this.createCalculationHash(people, transactions, 'settlements', settlements);

            const currentExpensesHash = this.createCalculationHash(currentPeopleData, currentTransactions, 'expenses');
            const currentSettlementsHash = this.createCalculationHash(currentPeopleData, currentTransactions, 'settlements', currentSettlements);

            const expensesChanged = newExpensesHash !== currentExpensesHash;
            const settlementsChanged = newSettlementsHash !== currentSettlementsHash;

            // If nothing changed, skip all updates
            if (!expensesChanged && !settlementsChanged) {
                return {
                    refreshExpenses: false,
                    refreshSettlements: false,
                    skipAll: true
                };
            }
            return {
                refreshExpenses: expensesChanged,
                refreshSettlements: settlementsChanged,
                isInitialLoad: false
            };

        } catch (error) {
            console.error('Error in refresh decisions:', error);
            // On error, refresh everything to be safe
            return {
                refreshExpenses: true,
                refreshSettlements: true,
                isInitialLoad: true
            };
        }
    },

    // Update the stored data after refresh decisions
    updateStoredData(people, transactions, settlements) {
        currentPeopleData = people;
        currentTransactions = transactions;
        currentSettlements = settlements;
    },

    // Generate HTML for expenses section
    generateExpensesHTML(people, transactions, shouldAnimate) {
        const names = Object.keys(people);

        // Handle empty state
        if (names.length === 0) {
            return getEmptyExpensesHTML();
        }

        const totalExpenses = CalculationLogic.calculateTotalExpenses(transactions);
        const fairShares = CalculationLogic.calculateFairShares(names, transactions, people);

        let expensesHtml = '';
        let expenseIndex = 0;

        // Expenses total header
        const expensesTotalStyle = shouldAnimate ? `style="--index: ${expenseIndex++}"` : '';
        expensesHtml += `
            <div class="summary expenses-summary expenses-total ${shouldAnimate ? '' : 'no-animate'}" ${expensesTotalStyle}>
                <span class="label">${LOCALE.getString('COSTS')}</span>
                <span class="total">${NumberLogic.formatNumber(totalExpenses)}</span>
            </div>`;

        // Show individual fair share expenses (excluding settlements and excluded people)
        const nonExcludedNames = names.filter(name => {
            const person = people[name];
            return !person?.isExcluded;
        });

        nonExcludedNames.forEach(name => {
            const fairShare = fairShares[name] || 0;
            const displayName = people[name] ? people[name].displayName : name;
            const parts = people[name] ? people[name].parts : 1;

            expensesHtml += HTMLDisplay.generatePersonSummaryHTML(name, fairShare, displayName, parts, shouldAnimate, expenseIndex++);
        });

        return expensesHtml;
    },

    // Generate HTML for settlements section
    generateSettlementsHTML(people, transactions, settlements, shouldAnimate) {
        // Handle empty state
        if (Object.keys(people).length === 0) {
            return getEmptySettlementsHTML();
        }

        const totalExpenses = CalculationLogic.calculateTotalExpenses(transactions);
        let settlementsHtml = '';
        let settlementIndex = 0;

        // Dynamic title based on state
        let sectionTitle;
        if (totalExpenses === 0 && settlements.length === 0) {
            sectionTitle = LOCALE.getString('NOTHING_TO_SETTLE');
        } else if (totalExpenses !== 0 && settlements.length === 0) {
            sectionTitle = LOCALE.getString('ALL_SETTLED');
        } else {
            sectionTitle = LOCALE.getString('SETTLEMENTS');
        }

        // Settlements total header
        const settlementsTotalStyle = shouldAnimate ? `style="--index: ${settlementIndex++}"` : '';
        settlementsHtml += `
            <div class="summary settlements-summary settlements-total ${shouldAnimate ? '' : 'no-animate'}" ${settlementsTotalStyle}>
                <span class="label">${sectionTitle}</span>
            </div>`;

        // Show active settlements
        if (totalExpenses !== 0 && settlements.length > 0) {
            settlements.forEach((settlement, index) => {
                settlementsHtml += HTMLDisplay.generateSettlementHTML(settlement, index, shouldAnimate, people, settlementIndex++);
            });
        }

        // Show settlement log entries (completed settlements from textarea)
        const settlementTransactions = CalculationLogic.getSettlementTransactions(transactions);
        if (settlementTransactions.length > 0) {
            settlementTransactions.forEach(settlement => {
                settlementsHtml += HTMLDisplay.generateSettlementLogHTML(settlement, shouldAnimate, people, settlementIndex++);
            });
        }

        return settlementsHtml;
    },

    // Unified refresh execution
    executeRefresh(people, transactions, settlements, expensesDiv, settlementsDiv, inputText) {
        const refreshDecisions = this.getRefreshDecisions(people, transactions, settlements, inputText);

        // If nothing changed, skip all updates
        if (refreshDecisions.skipAll) {
            return false;
        }

        // Update stored data
        this.updateStoredData(people, transactions, settlements);

        const shouldAnimate = refreshDecisions.isInitialLoad;

        // Generate and update HTML based on decisions
        if (refreshDecisions.refreshExpenses) {
            const expensesHtml = this.generateExpensesHTML(people, transactions, shouldAnimate);
            expensesDiv.innerHTML = expensesHtml;
        }

        if (refreshDecisions.refreshSettlements) {
            const settlementsHtml = this.generateSettlementsHTML(people, transactions, settlements, shouldAnimate);
            settlementsDiv.innerHTML = settlementsHtml;
        }

        return true; // Indicates that some refresh occurred
    }
};

// Function to initialize UI with localized strings
function generateFormatGuideHTML() {
    const formatGuideItems = [
        'PERSON_NAMES', 'GROUP_SIZE', 'BASIC_EXPENSE',
        'PERCENTAGE_FEE', 'SPECIFIC_SPLIT', 'EXCLUDE', 'SETTLEMENT'
    ];

    let html = `<div class="format-guide">
        <h2>${LOCALE.getString('FORMAT_GUIDE_TITLE')}</h2>`;

    formatGuideItems.forEach(item => {
        html += `
        <div class="format-item">
            <div class="format-name">${LOCALE.getString(`FORMAT_GUIDE_${item}_NAME`)}</div>
            <div class="format-description">${LOCALE.getString(`FORMAT_GUIDE_${item}_DESC`)}</div>
            <div class="format-example"><pre>${LOCALE.getString(`FORMAT_GUIDE_${item}_EXAMPLE`)}</pre></div>
        </div>`;
    });

    html += `</div>`;
    return html;
}

function generateExamplesHTML() {
    const examples = [
        { titleKey: 'FRIENDS_TRIP', textKey: 'FRIENDS_TRIP' },
        { titleKey: 'FAMILY_DINNER', textKey: 'FAMILY_DINNER' },
        { titleKey: 'BILL_SPLIT', textKey: 'BILL_SPLIT' }
    ];

    let html = `<div class="example-container">`;

    examples.forEach(example => {
        html += `
        <div class="example">
            <h2>${LOCALE.getString(`EXAMPLE_${example.titleKey}_TITLE`)}</h2>
            <pre class="example-input">${LOCALE.getString(`EXAMPLE_${example.textKey}_TEXT`)}</pre>
        </div>`;
    });

    html += `</div>`;
    return html;
}

function initializeUI() {
    const { textarea, copyButton, resetButton } = DOMUtils.getElements();

    // Set textarea placeholder
    if (textarea) textarea.placeholder = LOCALE.getString('PLACEHOLDER');

    // Set button texts
    if (copyButton) copyButton.textContent = LOCALE.getString('COPY_SUMMARY');
    if (resetButton) resetButton.textContent = LOCALE.getString('CLEAR');

    // Set settlement button template text
    const settlementTemplate = DOMUtils.getElement('settlement-template');
    if (settlementTemplate) {
        const settleText = settlementTemplate.content.querySelector('.settle-text');
        if (settleText) settleText.textContent = ' ' + LOCALE.getString('SETTLED_BUTTON');
    }

    // Dynamically generate format guide
    const helpSection = document.querySelector('.help-section');
    if (helpSection) {
        helpSection.innerHTML = generateFormatGuideHTML()
    }

    // Dynamically generate examples section
    const exampleSection = document.querySelector('.example-section');
    if (exampleSection) {
        exampleSection.innerHTML = generateExamplesHTML();
    }

    // Initialize empty sections on page load
    DOMUtils.resetResultsSections();
}

// DOM utility functions for common element access patterns
const DOMUtils = {
    // Get commonly used elements
    getElements() {
        return {
            textarea: document.getElementById('expenseInput'),
            expensesDiv: document.getElementById('expenses-results'),
            settlementsDiv: document.getElementById('settlements-results'),
            copyButton: document.getElementById('copyButton'),
            resetButton: document.getElementById('resetButton'),
            warningDiv: document.getElementById('validationWarning'),
            warningContent: document.getElementById('validationContent')
        };
    },

    // Get specific element by ID with error handling
    getElement(id) {
        const element = document.getElementById(id);
        if (!element) {
            console.warn(`Element with ID '${id}' not found`);
        }
        return element;
    },

    // Reset results sections to empty state
    resetResultsSections() {
        const { expensesDiv, settlementsDiv } = this.getElements();
        if (expensesDiv) expensesDiv.innerHTML = getEmptyExpensesHTML();
        if (settlementsDiv) settlementsDiv.innerHTML = getEmptySettlementsHTML();
    }
};

// Centralized error handling utility
const ErrorHandler = {
    // Handle UI errors with user-friendly messages
    handleUIError(error, userMessage, showAlert = true) {
        console.error('UI Error:', error);
        if (showAlert) {
            alert(userMessage);
        }
        DOMUtils.resetResultsSections();
        setButtonVisibility(false);
    },

    // Handle processing errors with fallback UI
    handleProcessingError(error, _fallbackHTML = null) {
        console.error('Processing Error:', error);
        DOMUtils.resetResultsSections();
        setButtonVisibility(false);
    }
};

// Helper functions for generating empty section HTML
function getEmptyExpensesHTML() {
    return `
        <div class="summary expenses-summary expenses-total">
            <span class="label">${LOCALE.getString('COSTS')}</span>
            <span class="total">${NumberLogic.formatNumber(0)}</span>
        </div>`;
}

function getEmptySettlementsHTML() {
    return `
        <div class="summary settlements-summary settlements-total">
            <span class="label">${LOCALE.getString('NOTHING_TO_SETTLE')}</span>
        </div>`;
}

function setButtonVisibility(show) {
    const { copyButton, resetButton } = DOMUtils.getElements();
    const display = show ? 'block' : 'none';

    if (copyButton) copyButton.style.display = display;
    if (resetButton) resetButton.style.display = display;
}

// HTML template generation utilities
const TemplateUtils = {
    // Clone template with optional no-animate class and index for staggered animation
    cloneTemplate(templateId, shouldAnimate = true, index = 0, wrapperSelector = '.summary') {
        const template = DOMUtils.getElement(templateId);
        if (!template) return null;

        const clone = template.content.cloneNode(true);
        const wrapper = clone.querySelector(wrapperSelector);

        if (wrapper) {
            if (!shouldAnimate) {
                // Add no-animate class if this shouldn't animate (for updates)
                wrapper.classList.add('no-animate');
            } else {
                // Set CSS custom property for staggered animation delay
                wrapper.style.setProperty('--index', index);
            }
        }

        return { clone, wrapper };
    },

    // Convert cloned template to HTML string
    templateToHTML(clone) {
        const tempDiv = document.createElement('div');
        tempDiv.appendChild(clone);
        return tempDiv.innerHTML;
    }
};

// HTML Generation Display Utilities
const HTMLDisplay = {
    // Generate person summary HTML
    generatePersonSummaryHTML(name, fairShare, displayName, parts, shouldAnimate = true, index = 0) {
        const result = TemplateUtils.cloneTemplate('expenses-template', shouldAnimate, index);
        if (!result) return '';

        const { clone, wrapper } = result;
        if (wrapper) wrapper.className = `summary expenses-summary`;

        clone.querySelector('.label').textContent = PersonDisplay.formatWithParts(displayName, parts);
        clone.querySelector('.total').textContent = NumberLogic.formatNumber(fairShare);

        return TemplateUtils.templateToHTML(clone);
    },

    // Generate settlement HTML
    generateSettlementHTML(settlement, settlementIndex, shouldAnimate = true, people, animationIndex = 0) {
        const { fromName, toName } = PersonDisplay.getSettlementNames(settlement, people);

        const result = TemplateUtils.cloneTemplate('settlement-template', shouldAnimate, animationIndex, '.settlements-summary');
        if (!result) return '';

        const { clone, wrapper } = result;
        if (wrapper) {
            wrapper.className = `summary settlements-summary`;
            wrapper.dataset.settlementIndex = settlementIndex;
        }

        clone.querySelector('.label').textContent = formatTemplate(
            LOCALE.getString('OWES_TEMPLATE'),
            {
                fromName: fromName,
                amount: NumberLogic.formatNumber(settlement.amount),
                toName: toName
            }
        );

        // Add inline onclick handler to the settle button
        const settleButton = clone.querySelector('.settle-button');
        if (settleButton) {
            settleButton.setAttribute('onclick', `settlePayment(${settlementIndex})`);
            settleButton.setAttribute('onmousedown', 'event.preventDefault()');
        }

        return TemplateUtils.templateToHTML(clone);
    },

    // Generate settlement log HTML
    generateSettlementLogHTML(settlement, shouldAnimate = true, people, index = 0) {
        const result = TemplateUtils.cloneTemplate('settlement-log-template', shouldAnimate, index, '.settlements-summary');
        if (!result) return '';

        const { clone, wrapper } = result;
        if (wrapper) {
            wrapper.className = `summary settlements-summary settlement-log`;
        }

        // Get display names for the settlement
        const { fromName, toName } = PersonDisplay.getSettlementNames(settlement, people, 'paidBy', 'settleTo');

        clone.querySelector('.label').textContent = formatTemplate(
            LOCALE.getString('PAID_TEMPLATE'),
            {
                fromName: fromName,
                amount: NumberLogic.formatNumber(settlement.amount),
                toName: toName
            }
        );

        return TemplateUtils.templateToHTML(clone);
    }
};

// ===== DISPLAY/UI UTILITIES =====
// These utilities handle UI rendering and use the logic utilities

// Person Display Utilities
const PersonDisplay = {
    // Format person name with parts count for display
    formatWithParts(displayName, parts) {
        return PersonLogic.formatWithParts(displayName, parts);
    },

    // Clean person name for settlements display
    cleanForSettlement(displayName) {
        return PersonLogic.cleanForSettlement(displayName);
    },

    // Get clean settlement names for display
    getSettlementNames(settlement, people, fromKey = 'from', toKey = 'to') {
        return PersonLogic.getSettlementNames(settlement, people, fromKey, toKey);
    }
};

// Validation Display Utilities
const ValidationDisplay = {
    // Display validation warnings in the UI
    displayValidationWarnings(warnings) {
        const warningDiv = document.getElementById('validationWarning');
        const contentDiv = document.getElementById('validationContent');

        if (warnings.length === 0) {
            warningDiv.style.display = 'none';
            return;
        }

        let content = '';
        warnings.forEach(warning => {
            content += `<div class="warning-line">${escapeHtml(warning.error)}</div>`;
        });

        contentDiv.innerHTML = content;
        warningDiv.style.display = 'block';
    }
};

// Summary generation utilities
const SummaryUtils = {
    // Generate expenses block
    generateExpensesBlock() {
        const paymentsText = formatPaymentsText();
        if (!paymentsText) return '';

        return `*${LOCALE.getString('EXPENSES').toUpperCase()}*\n${paymentsText}\n`;
    },

    // Generate costs block
    generateCostsBlock(totalExpenses, fairShares) {
        const names = Object.keys(currentPeopleData);
        const header = totalExpenses === 0
            ? `\n*${LOCALE.getString('COSTS').toUpperCase()}*\n`
            : `\n*${LOCALE.getString('COSTS').toUpperCase()}* = ${NumberLogic.formatNumber(totalExpenses)}\n`;

        // Only show non-excluded people in costs
        const nonExcludedNames = names.filter(name => !currentPeopleData[name]?.isExcluded);

        const costLines = nonExcludedNames.map(name => {
            const person = currentPeopleData[name];
            const personShare = fairShares[name] || 0;
            const displayName = person ? person.displayName : name;
            const parts = person ? person.parts : 1;
            return `${PersonDisplay.formatWithParts(displayName, parts)} = ${NumberLogic.formatNumber(personShare)}`;
        }).join('\n');

        return header + costLines + '\n';
    },

    // Generate settlements block
    generateSettlementsBlock(totalExpenses, settlementTransactions) {
        const header = (totalExpenses !== 0 && currentSettlements.length === 0)
            ? `*${LOCALE.getString('ALL_SETTLED').toUpperCase()}*`
            : `*${LOCALE.getString('SETTLEMENTS').toUpperCase()}*`;

        let content = `\n${header}\n`;

        // Active settlements
        if (totalExpenses === 0) {
            content += LOCALE.getString('NOTHING_TO_SETTLE') + '\n';
        } else if (currentSettlements.length > 0) {
            currentSettlements.forEach(settlement => {
                const { fromName, toName } = PersonDisplay.getSettlementNames(settlement, currentPeopleData);
                content += formatTemplate(LOCALE.getString('OWES_TEMPLATE'), {
                    fromName, amount: NumberLogic.formatNumber(settlement.amount), toName
                }) + '\n';
            });
        }

        // Completed settlements
        settlementTransactions.forEach(settlement => {
            const { fromName, toName } = PersonDisplay.getSettlementNames(settlement, currentPeopleData, 'paidBy', 'settleTo');
            content += formatTemplate(LOCALE.getString('PAID_TEMPLATE'), {
                fromName, amount: NumberLogic.formatNumber(settlement.amount), toName
            }) + '\n';
        });

        return content;
    }
};

// Textarea utility functions
const TextareaUtils = {
    // Auto-expand textarea to fit content
    autoExpand() {
        const textarea = DOMUtils.getElement('expenseInput');
        if (textarea) autoExpandTextarea(textarea);
    },

    // Apply formatted text to textarea
    applyFormattedText(saveToStorage = true) {
        try {
            const textarea = DOMUtils.getElement('expenseInput');
            if (!textarea) return false;

            // Parse the current textarea content for formatting
            const currentInput = textarea.value;
            try {
                const parsed = ExpenseLogic.parseExpenses(currentInput);
                const formattedText = this.formatTextFromParsedData(parsed.people, parsed.transactions);

                if (formattedText && formattedText !== textarea.value) {
                    textarea.value = formattedText;
                    this.autoExpand();
                    if (saveToStorage) {
                        saveToLocalStorage();
                    }
                    return true;
                }
                return false;
            } catch (parseError) {
                // parseExpenses() throws on validation errors - don't format invalid input
                // console.warn('Cannot format text due to validation errors:', parseError.message);
                return false;
            }
        } catch (error) {
            console.warn('Apply formatted text error', error);
            return false;
        }
    },

    // Format text from parsed data (similar to formatInputText but uses provided data)
    formatTextFromParsedData(peopleData, transactions) {
        try {
            const names = Object.keys(peopleData || {});
            if (names.length === 0) return '';

            // Temporarily store the current global state
            const originalPeopleData = currentPeopleData;
            const originalTransactions = currentTransactions;

            // Set the global state to the provided data for formatting
            currentPeopleData = peopleData;
            currentTransactions = transactions;

            const maxWidth = FormatDisplay.calculateMaxWidth(transactions || []);
            let formattedText = '';

            names.forEach(name => {
                const person = peopleData[name];
                const displayName = person ? person.displayName : name;
                const parts = person ? person.parts : 1;

                formattedText += `${PersonDisplay.formatWithParts(displayName, parts)}\n`;

                // Add transactions for this person
                const personTransactions = (transactions || []).filter(t => t.paidBy === name);
                personTransactions.forEach(transaction => {
                    formattedText += FormatDisplay.formatTransactionLine(transaction, maxWidth);
                });

                // Only add empty line if this person has transactions
                if (personTransactions.length > 0) {
                    formattedText += '\n';
                }
            });

            // Restore the original global state
            currentPeopleData = originalPeopleData;
            currentTransactions = originalTransactions;

            return formattedText.trim();
        } catch (error) {
            console.error('Error formatting text from parsed data:', error);
            return '';
        }
    },

    // Clear textarea and reset state
    clear() {
        const textarea = DOMUtils.getElement('expenseInput');
        if (textarea) {
            textarea.value = '';
            this.autoExpand();
        }
    },

    // Get current textarea value
    getValue() {
        const textarea = DOMUtils.getElement('expenseInput');
        return textarea ? textarea.value : '';
    },

    // Set textarea value
    setValue(value) {
        const textarea = DOMUtils.getElement('expenseInput');
        if (textarea) {
            textarea.value = value;
            this.autoExpand();
        }
    }
};

function handleBlur() {
    try {
        // Skip blur handling if we're in the middle of settling a payment
        if (isSettling) {
            return;
        }

        // Cancel any pending debounced update
        clearTimeout(debounceTimer);

        // Always process current content and update results immediately
        updateResults();

        // Only save to localStorage and apply formatting if parsing was successful
        const input = TextareaUtils.getValue();
        if (input.trim()) {
            try {
                // Test if parsing succeeds
                ExpenseLogic.parseExpenses(input);

                // If we get here, parsing succeeded
                saveToLocalStorage();
                TextareaUtils.applyFormattedText(false); // Don't save again since we just saved
            } catch (error) {
                // Don't save to localStorage if parsing fails
                // console.warn('Not saving to localStorage due to validation errors');
            }
        } else {
            // Save empty input
            saveToLocalStorage();
        }
    } catch (error) {
        console.warn('Blur handler error', error);
    }
}

// Text Formatting Display Utilities
const FormatDisplay = {
    // Calculate maximum width for amount alignment
    calculateMaxWidth(transactions) {
        let maxWidth = 0; // minimum width
        transactions.forEach(transaction => {
            let width = 0;
            if (transaction.percentage !== undefined) {
                width = `${transaction.percentage}%`.length;
            } else if (transaction.amount !== undefined) {
                width = NumberLogic.formatNumber(transaction.amount).length;
            }
            if (width > maxWidth) maxWidth = width;
        });
        return maxWidth;
    },

    // Format transaction amount based on type
    formatTransactionAmount(transaction) {
        if (transaction.type === CONSTANTS.TRANSACTION_TYPES.PERCENTAGE) {
            return `${transaction.percentage}%`;
        }
        return NumberLogic.formatNumber(transaction.amount);
    },

    // Format transaction description with participants
    formatTransactionDescription(transaction) {
        let description = transaction.description || '';

        if (transaction.type === CONSTANTS.TRANSACTION_TYPES.SETTLEMENT) {
            // Settlement: amount > recipient format
            if (transaction.settleTo) {
                const recipientData = currentPeopleData[transaction.settleTo];
                const recipientName = PersonDisplay.cleanForSettlement(recipientData ? recipientData.displayName : transaction.settleTo);
                return `> ${recipientName}`;
            }
        } else if (transaction.sharedWith.length > 0) {
            // Add participants for expenses and percentages with specific people
            const participants = transaction.sharedWith.map(p => {
                const participantData = currentPeopleData[p];
                return participantData ? participantData.displayName : p;
            }).join(', ');
            description = description ? `${description} - ${participants}` : `- ${participants}`;
        }

        return description;
    },

    // Format a single transaction line
    formatTransactionLine(transaction, maxWidth) {
        const amount = this.formatTransactionAmount(transaction);
        const description = this.formatTransactionDescription(transaction);
        const paddedAmount = amount.padStart(maxWidth, ' ');
        const fullDescription = description ? ` ${description}` : '';
        return `${paddedAmount}${fullDescription}\n`;
    }
};

function formatInputText() {
    try {
        const names = Object.keys(currentPeopleData || {});
        if (names.length === 0) return '';

        const maxWidth = FormatDisplay.calculateMaxWidth(currentTransactions || []);
        let formattedText = '';

        names.forEach(name => {
            const person = currentPeopleData[name];
            const displayName = person ? person.displayName : name;
            const parts = person ? person.parts : 1;

            formattedText += `${PersonDisplay.formatWithParts(displayName, parts)}\n`;

            // Add transactions for this person
            const personTransactions = (currentTransactions || []).filter(t => t.paidBy === name);
            personTransactions.forEach(transaction => {
                formattedText += FormatDisplay.formatTransactionLine(transaction, maxWidth);
            });

            // Only add empty line if this person has transactions
            if (personTransactions.length > 0) {
                formattedText += '\n';
            }
        });

        return formattedText.trim();
    } catch (error) {
        console.error('Error formatting input text:', error);
        return '';
    }
}

// Helper function to format only expenses (no settlements) for PAYMENTS block
function formatPaymentsText() {
    try {
        const names = Object.keys(currentPeopleData || {});
        if (names.length === 0) return '';

        let formattedText = '';

        // Calculate maximum width for amounts across expense transactions only
        const expenseTransactions = CalculationLogic.getExpenseTransactions(currentTransactions);
        let maxWidth = FormatDisplay.calculateMaxWidth(expenseTransactions);
        
        // Ensure minimum width for proper alignment
        if (maxWidth === 0) maxWidth = 8;

        // Format expenses by person using transaction data (EXPENSES ONLY)
        names.forEach(name => {
            const person = currentPeopleData[name];
            const displayName = person ? person.displayName : name;
            const parts = person ? person.parts : 1;

            // Check if this person has any expense transactions
            const hasExpenses = currentTransactions.some(t =>
                t.paidBy === name && t.type === CONSTANTS.TRANSACTION_TYPES.EXPENSE
            );

            if (hasExpenses) {
                formattedText += `${PersonDisplay.formatWithParts(displayName, parts)}\n`;

                // Use transactions to reconstruct the original format (EXPENSES ONLY)
                const processedTransactions = new Set();

                currentTransactions.forEach(transaction => {
                    if (transaction.paidBy === name &&
                        transaction.type === CONSTANTS.TRANSACTION_TYPES.EXPENSE &&
                        !processedTransactions.has(transaction)) {
                        processedTransactions.add(transaction);

                        formattedText += FormatDisplay.formatTransactionLine(transaction, maxWidth);
                    }
                });

                formattedText += '\n';
            }
        });

        return formattedText.trim();
    } catch (error) {
        console.error('Error formatting payments text:', error);
        return '';
    }
}

function copySummary() {
    try {
        const names = Object.keys(currentPeopleData);
        if (names.length === 0) return;

        // First format and update the input text to ensure consistency
        TextareaUtils.applyFormattedText();

        const totalExpenses = CalculationLogic.calculateTotalExpenses(currentTransactions);
        const fairShares = CalculationLogic.calculateFairShares(names, currentTransactions, currentPeopleData);
        const settlementTransactions = CalculationLogic.getSettlementTransactions(currentTransactions);

        let textSummary = [
            SummaryUtils.generateExpensesBlock(),
            SummaryUtils.generateCostsBlock(totalExpenses, fairShares),
            SummaryUtils.generateSettlementsBlock(totalExpenses, settlementTransactions)
        ].join('');

        if (!textSummary) {
            alert(LOCALE.getString('NOTHING_TO_COPY'));
            return;
        }

        // Use the copyToClipboard function from lib.js
        copyToClipboard(textSummary).then(() => {
            showCopySuccess();
        }).catch(err => {
            console.error('Failed to copy:', err);
            alert(LOCALE.getString('COPY_ERROR'));
        });
    } catch (error) {
        ErrorHandler.handleUIError(error, LOCALE.getString('COPY_ERROR'));
    }
}

function showCopySuccess() {
    const button = document.getElementById('copyButton');
    const originalText = button.textContent;
    button.textContent = LOCALE.getString('COPY_SUCCESS');
    button.classList.add('copied');

    setTimeout(() => {
        button.textContent = originalText;
        button.classList.remove('copied');
    }, CONSTANTS.COPY_SUCCESS_TIMEOUT);
}

function updateResults() {
    try {
        const input = TextareaUtils.getValue();
        const expensesDiv = document.getElementById('expenses-results');
        const settlementsDiv = document.getElementById('settlements-results');

        // Handle empty input or no valid names - show empty sections
        let people = {};
        let transactions = [];
        let names = [];

        if (input.trim()) {
            try {
                const parsed = ExpenseLogic.parseExpenses(input);
                people = parsed.people;
                transactions = parsed.transactions;
                names = Object.keys(people);

                // Clear validation warnings on successful parse
                ValidationDisplay.displayValidationWarnings([]);
            } catch (error) {
                // console.warn('Parse expenses error:', error);

                // Show validation warnings for the error
                const warnings = ValidationLogic.validateExpenses(input);
                ValidationDisplay.displayValidationWarnings(warnings);

                // Stop processing - don't save to localStorage or continue with empty data
                setButtonVisibility(false);
                return;
            }
        } else {
            // Clear validation warnings for empty input
            ValidationDisplay.displayValidationWarnings([]);
        }

        if (!input.trim() || names.length === 0) {
            // Use refresh manager to handle empty state properly
            const refreshOccurred = RefreshManager.executeRefresh({}, [], [], expensesDiv, settlementsDiv, input);
            setButtonVisibility(false);
            return;
        }

        // Calculate settlements for comparison
        const settlements = CalculationLogic.calculateSettlements(people, transactions);

        // Execute unified refresh logic
        const refreshOccurred = RefreshManager.executeRefresh(people, transactions, settlements, expensesDiv, settlementsDiv, input);

        if (!refreshOccurred) {
            return; // Nothing changed, exit early
        }

        // Show buttons when there are results
        setButtonVisibility(true);

    } catch (error) {
        ErrorHandler.handleProcessingError(error);
    }
}

function settlePayment(settlementIndex) {
    try {
        // Set flag to prevent blur interference
        isSettling = true;

        const settlement = currentSettlements[settlementIndex];
        if (!settlement) {
            isSettling = false;
            return;
        }

        // Get display names for the settlement
        const { fromName, toName } = PersonDisplay.getSettlementNames(settlement, currentPeopleData);

        const textarea = document.getElementById('expenseInput');
        const currentText = textarea.value;

        // Create the payment line in the format: "amount > recipient"
        const formattedAmount = NumberLogic.formatNumber(Number(settlement.amount));
        const settlementLine = `${formattedAmount} > ${toName}`;

        // Find the payer's section and add the payment line
        const lines = currentText.split('\n');
        let payerIndex = -1;

        // Find where the payer's section starts
        for (let i = 0; i < lines.length; i++) {
            if (lines[i].trim() === settlement.from) {
                payerIndex = i;
                break;
            }
        }

        if (payerIndex !== -1) {
            // Find the end of the payer's section (next person or end of file)
            let insertIndex = lines.length;
            let foundEmptyLine = false;

            for (let i = payerIndex + 1; i < lines.length; i++) {
                const line = lines[i].trim();

                // If we find an empty line, mark it but continue looking
                if (line === '') {
                    if (!foundEmptyLine) {
                        insertIndex = i;
                        foundEmptyLine = true;
                    }
                    continue;
                }

                // Check if this line is a person name (not an expense)
                const expenseMatch = line.match(/^(-?\d+(?:[.,]\d+)*(?:[.,]\d{1,2})?)/);
                if (!expenseMatch && line.length > 0) {
                    // This is a person name, insert before this line (or before the empty line if found)
                    if (!foundEmptyLine) {
                        insertIndex = i;
                    }
                    break;
                }
            }

            // Insert the payment line
            lines.splice(insertIndex, 0, settlementLine);

            // Update the textarea
            const originalText = textarea.value;
            textarea.value = lines.join('\n');

            // Reparse the expenses to update data structures with the new settlement
            try {
                const { people, transactions } = ExpenseLogic.parseExpenses(textarea.value);

                if (people && transactions) {
                    currentPeopleData = people;
                    currentTransactions = transactions;

                    // Now reformat the input text with updated data
                    TextareaUtils.applyFormattedText(false); // Don't save to storage here, we'll save below

                    // Save to localStorage after successful parsing
                    saveToLocalStorage();
                } else {
                    // Revert the change if parsing returned empty data
                    textarea.value = originalText;
                    console.warn('Settlement addition resulted in empty data, reverted');
                    return;
                }
            } catch (error) {
                // console.warn('Parse expenses error after settlement:', error);
                // Revert the textarea to original state if parsing fails
                textarea.value = originalText;

                // Show error to user
                ErrorHandler.handleProcessingError(new Error('Cannot add settlement: ' + error.message));
                return;
            }

            // Show success state with green background
            const settlementWrapper = document.querySelector(`[data-settlement-index="${settlementIndex}"]`);
            if (settlementWrapper) {
                settlementWrapper.classList.add('settlement-success');

                // Replace the settlement text with "Acertado"
                const settlementText = settlementWrapper.querySelector('.label');
                if (settlementText) {
                    settlementText.textContent = LOCALE.getString('SETTLED_TEXT');
                }

                // Hide the button to prevent multiple clicks
                const button = settlementWrapper.querySelector('.settle-button');
                if (button) {
                    button.style.display = 'none';
                }

                // Remove the settlement after showing success state
                setTimeout(() => {
                    updateResults();
                    isSettling = false;
                }, CONSTANTS.SETTLEMENT_SUCCESS_TIMEOUT);
            }
        }
    } catch (error) {
        ErrorHandler.handleUIError(error, LOCALE.getString('SETTLEMENT_ERROR'));
    } finally {
        // Always reset the settling flag
        setTimeout(() => {
            isSettling = false;
        }, 100);
    }
}

// localStorage functions
function resetData() {
    const confirmReset = confirm(LOCALE.getString('RESET_CONFIRM'));

    if (confirmReset) {
        try {
            setButtonVisibility(false);

            // Clear localStorage
            localStorage.removeItem(CONSTANTS.STORAGE_KEY);

            TextareaUtils.clear();

            // Reset global state variables
            debounceTimer = null;
            currentPeopleData = {};
            currentSettlements = [];
            currentTransactions = [];
            isSettling = false;

            updateResults();

        } catch (error) {
            ErrorHandler.handleUIError(error, LOCALE.getString('RESET_ERROR'));
        }
    }
}

function saveToLocalStorage() {
    try {
        const value = TextareaUtils.getValue();
        localStorage.setItem(CONSTANTS.STORAGE_KEY, value);
    } catch (error) {
        console.error('Error saving to localStorage:', error);
    }
}

function loadFromLocalStorage() {
    try {
        const savedData = localStorage.getItem(CONSTANTS.STORAGE_KEY);
        if (savedData) {
            TextareaUtils.setValue(savedData);

            // Auto-expand after loading content
            TextareaUtils.autoExpand();

            // Update results after loading - this will parse and set the global state
            updateResults();

            // Apply formatting after the results are updated
            const warnings = ValidationLogic.validateExpenses(savedData);
            if (warnings.length === 0) {
                TextareaUtils.applyFormattedText(false); // Don't save to storage during load
            }
        }
    } catch (error) {
        console.error('Error loading from localStorage:', error);
    }
}

// Auto-expanding textarea functionality
function autoExpandTextarea(textarea) {
    // Store current scroll position and cursor position
    const scrollTop = textarea.scrollTop;
    const selectionStart = textarea.selectionStart;
    const selectionEnd = textarea.selectionEnd;
    
    // Reset height to measure the scroll height accurately
    textarea.style.height = 'auto';

    // Detect if we're on mobile based on screen width and touch capability
    const isMobile = window.innerWidth <= 768 || ('ontouchstart' in window && window.innerWidth <= 1024);

    // Calculate available viewport height considering mobile keyboard space
    let availableHeight;
    if (isMobile) {
        // On mobile, use visual viewport if available (accounts for keyboard)
        // Otherwise fall back to a conservative estimate
        if (window.visualViewport) {
            availableHeight = window.visualViewport.height;
        } else {
            // Conservative fallback - assume keyboard takes up significant space
            availableHeight = window.innerHeight * 0.6; // Assume keyboard uses ~40% of screen
        }
    } else {
        availableHeight = window.innerHeight;
    }

    // Calculate new height, ensuring it stays within min/max bounds
    const minHeight = 150; // matches min-height in CSS
    const maxHeightRatio = isMobile ? 0.4 : 0.6; // 40vh on mobile, 60vh on desktop
    const maxHeight = Math.floor(availableHeight * maxHeightRatio);
    const newHeight = Math.max(minHeight, Math.min(textarea.scrollHeight, maxHeight));

    textarea.style.height = newHeight + 'px';
    
    // Restore cursor position
    textarea.setSelectionRange(selectionStart, selectionEnd);
    
    // On mobile, ensure cursor stays visible by scrolling to cursor position
    if (isMobile && textarea.scrollHeight > newHeight) {
        // Calculate line height to estimate cursor position
        const lineHeight = parseInt(window.getComputedStyle(textarea).lineHeight) || 20;
        const textBeforeCursor = textarea.value.substring(0, selectionStart);
        const linesBeforeCursor = textBeforeCursor.split('\n').length - 1;
        const cursorTop = linesBeforeCursor * lineHeight;
        
        // If cursor is below visible area, scroll to show it
        if (cursorTop > scrollTop + newHeight - lineHeight * 2) {
            textarea.scrollTop = Math.max(0, cursorTop - newHeight + lineHeight * 3);
        } else if (cursorTop < scrollTop + lineHeight) {
            // If cursor is above visible area, scroll up
            textarea.scrollTop = Math.max(0, cursorTop - lineHeight);
        } else {
            // Try to restore previous scroll position if cursor is still visible
            textarea.scrollTop = scrollTop;
        }
    }
}

// Safely escape HTML characters in user input to prevent HTML injection
// This function handles characters like <, >, &, and quotes
function escapeHtml(text) {
    if (text == null || text === undefined) {
        return '';
    }
    const div = document.createElement('div');
    div.textContent = String(text);
    return div.innerHTML;
}
