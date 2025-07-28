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

let debounceTimer;
let currentPeopleData = {};
let currentSettlements = [];
let currentTransactions = [];

let isSettling = false;



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
                <span class="label">${CONSTANTS.MESSAGES.COSTS}</span>
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
            sectionTitle = CONSTANTS.MESSAGES.NOTHING_TO_SETTLE;
        } else if (totalExpenses !== 0 && settlements.length === 0) {
            sectionTitle = CONSTANTS.MESSAGES.ALL_SETTLED;
        } else {
            sectionTitle = CONSTANTS.MESSAGES.SETTLEMENTS;
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





// Locale detection and management
function getLocale() {
    const browserLang = navigator.language || navigator.userLanguage || 'en';
    const lang = browserLang.toLowerCase();

    if (lang.startsWith('pt')) return 'pt-BR';
    if (lang.startsWith('es')) return 'es';
    return 'en';
}

const currentLocale = getLocale();

// Constants for configuration and magic values
const CONSTANTS = {
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

    // Localized strings
    STRINGS: {
        'en': {
            SETTLED_TEXT: 'SETTLED',
            COPY_SUCCESS: 'COPIED ✓',
            NOTHING_TO_COPY: 'Nothing to copy. Add some expenses first.',
            COPY_ERROR: 'Error copying. Try again.',
            RESET_CONFIRM: 'Are you sure you want to clear all data? This action cannot be undone.',
            RESET_ERROR: 'Error clearing data. Try again.',
            EXPENSES: 'Expenses',
            COSTS: 'Costs',
            SETTLEMENTS: 'Settlements',
            OWES_TEMPLATE: '{fromName} owes {amount} to {toName}',
            PAID_TEMPLATE: '{fromName} paid {amount} to {toName}',
            PERSON_NOT_FOUND: 'does not match any listed person',
            AMBIGUOUS_PERSON_TEMPLATE: '"{personRef}" is ambiguous - could refer to: {matchingNames}',
            PERSON_NOT_FOUND_TEMPLATE: '"{personRef}" {errorMessage}',
            DUPLICATE_NAME_TEMPLATE: 'Name "{currentName}" is duplicated with "{existingName}"',
            PERSON_WITH_PARTS_TEMPLATE: '{displayName} ({parts})',
            EXPENSE_WITH_PARTICIPANTS_TEMPLATE: '{description} - {participants}',
            COPY_MANUAL_SELECT: 'Could not copy automatically. Please select and copy manually.',
            COPY_MANUAL_FALLBACK: 'Error copying. Try selecting and copying manually.',
            SETTLEMENT_ERROR: 'Error processing settlement. Try again.',
            ALL_SETTLED: 'All settled!',
            NOTHING_TO_SETTLE: 'Nothing to settle!',
            COPY_SUMMARY: 'COPY SUMMARY',
            CLEAR: 'CLEAR',
            SETTLED_BUTTON: 'SETTLED',
            ERROR_GENERATING_SUMMARY: 'Error generating summary',
            PLACEHOLDER: 'Add people and expenses...\n(see format guide below)',

            // Format Guide Messages
            FORMAT_GUIDE_TITLE: 'Format Guide',
            FORMAT_GUIDE_PERSON_NAMES_NAME: 'Person names',
            FORMAT_GUIDE_PERSON_NAMES_DESC: 'Start with a name on its own line. Expenses added below the name were paid by that person.',
            FORMAT_GUIDE_PERSON_NAMES_EXAMPLE: 'David\n50 Dinner\n20 Drinks',

            FORMAT_GUIDE_GROUP_SIZE_NAME: 'Group size',
            FORMAT_GUIDE_GROUP_SIZE_DESC: 'Optional number after the name. Proportional share of the split.',
            FORMAT_GUIDE_GROUP_SIZE_EXAMPLE: 'Ana 3\nMike (2)',

            FORMAT_GUIDE_BASIC_EXPENSE_NAME: 'Basic expense',
            FORMAT_GUIDE_BASIC_EXPENSE_DESC: 'Amount (with or without cents) with optional description.',
            FORMAT_GUIDE_BASIC_EXPENSE_EXAMPLE: '25.50 Lunch\n45',

            FORMAT_GUIDE_PERCENTAGE_FEE_NAME: 'Percentage fee',
            FORMAT_GUIDE_PERCENTAGE_FEE_DESC: 'Based on total expenses for that person.',
            FORMAT_GUIDE_PERCENTAGE_FEE_EXAMPLE: '10% Service fee',

            FORMAT_GUIDE_SPECIFIC_SPLIT_NAME: 'Specific split',
            FORMAT_GUIDE_SPECIFIC_SPLIT_DESC: 'Add comma separated names (or initials) after " - " to split the expense among them.',
            FORMAT_GUIDE_SPECIFIC_SPLIT_EXAMPLE: '7 Coffee - Mike\n50 Dinner - A, D',

            FORMAT_GUIDE_EXCLUDE_NAME: 'Exclude from split',
            FORMAT_GUIDE_EXCLUDE_DESC: 'Add ! after the name to be owed but not share the expense.',
            FORMAT_GUIDE_EXCLUDE_EXAMPLE: 'Restaurant!\nReceipt!',

            FORMAT_GUIDE_SETTLEMENT_NAME: 'Settlement',
            FORMAT_GUIDE_SETTLEMENT_DESC: 'Register payments between people. You can use the buttons in the settlement section to speed up the process.',
            FORMAT_GUIDE_SETTLEMENT_EXAMPLE: '50 > Ana\n50.40 > Mike\n70 > Restaurant',

            // Example Sections
            EXAMPLE_FRIENDS_TRIP_TITLE: 'Friends Trip',
            EXAMPLE_FRIENDS_TRIP_TEXT: 'David\n45 Gas\n18.11 Toll\n15 Snacks\n\nAna\n50.30 Dinner\n15 Coffee - Ana, Mike\n\nMike\n12 Parking\n60 Tickets',

            EXAMPLE_FAMILY_DINNER_TITLE: 'Family Dinner',
            EXAMPLE_FAMILY_DINNER_TEXT: 'David 2\n75.50 Vegetables\n30.75 Sides\n89.25 Meats\n\nMike 4\n45.25 Drinks\n10 Ice\n\nAna 5\n35 Dessert\n20 Supplies',

            EXAMPLE_BILL_SPLIT_TITLE: 'Bill Split',
            EXAMPLE_BILL_SPLIT_TEXT: 'Bill!\n30 Appetizers\n12 Drink - D\n12 Drink - M\n16 Entree - D\n18 Entree - M\n32 Entree - A\n10% Service fee\n\nAna 2\nDavid\nMike'
        },
        'pt-BR': {
            SETTLED_TEXT: 'ACERTADO',
            COPY_SUCCESS: 'COPIADO ✓',
            NOTHING_TO_COPY: 'Nada para copiar. Adicione alguns gastos primeiro.',
            COPY_ERROR: 'Erro ao copiar. Tente novamente.',
            RESET_CONFIRM: 'Tem certeza que deseja limpar todos os dados? Esta ação não pode ser desfeita.',
            RESET_ERROR: 'Erro ao limpar os dados. Tente novamente.',
            EXPENSES: 'Gastos',
            COSTS: 'Custos',
            SETTLEMENTS: 'Acertos',
            OWES_TEMPLATE: '{fromName} deve {amount} para {toName}',
            PAID_TEMPLATE: '{fromName} pagou {amount} para {toName}',
            PERSON_NOT_FOUND: 'não corresponde a nenhuma pessoa listada',
            AMBIGUOUS_PERSON_TEMPLATE: '"{personRef}" é ambíguo - pode se referir a: {matchingNames}',
            PERSON_NOT_FOUND_TEMPLATE: '"{personRef}" {errorMessage}',
            DUPLICATE_NAME_TEMPLATE: 'Nome "{currentName}" está duplicado com "{existingName}"',
            PERSON_WITH_PARTS_TEMPLATE: '{displayName} ({parts})',
            EXPENSE_WITH_PARTICIPANTS_TEMPLATE: '{description} - {participants}',
            COPY_MANUAL_SELECT: 'Não foi possível copiar automaticamente. Selecione e copie manualmente.',
            COPY_MANUAL_FALLBACK: 'Erro ao copiar. Tente selecionar e copiar manualmente.',
            SETTLEMENT_ERROR: 'Erro ao processar acerto. Tente novamente.',
            ALL_SETTLED: 'Tudo acertado!',
            NOTHING_TO_SETTLE: 'Nada para acertar!',
            COPY_SUMMARY: 'COPIAR RESUMO',
            CLEAR: 'LIMPAR',
            SETTLED_BUTTON: 'ACERTADO',
            ERROR_GENERATING_SUMMARY: 'Erro ao gerar resumo',
            PLACEHOLDER: 'Adicione pessoas e gastos...\n(veja o guia de formato abaixo)',

            // Format Guide Messages
            FORMAT_GUIDE_TITLE: 'Guia de Formato',
            FORMAT_GUIDE_PERSON_NAMES_NAME: 'Nomes de pessoas',
            FORMAT_GUIDE_PERSON_NAMES_DESC: 'Comece com um nome em sua própria linha. Gastos adicionados abaixo do nome foram pagos por essa pessoa.',
            FORMAT_GUIDE_PERSON_NAMES_EXAMPLE: 'David\n50 Jantar\n20 Bebidas',

            FORMAT_GUIDE_GROUP_SIZE_NAME: 'Tamanho do grupo',
            FORMAT_GUIDE_GROUP_SIZE_DESC: 'Número opcional após o nome. Parte proporcional do rateio.',
            FORMAT_GUIDE_GROUP_SIZE_EXAMPLE: 'Ana 3\nMike (2)',

            FORMAT_GUIDE_BASIC_EXPENSE_NAME: 'Gasto básico',
            FORMAT_GUIDE_BASIC_EXPENSE_DESC: 'Valor (com ou sem centavos) com descrição opcional.',
            FORMAT_GUIDE_BASIC_EXPENSE_EXAMPLE: '25,50 Almoço\n45',

            FORMAT_GUIDE_PERCENTAGE_FEE_NAME: 'Taxa percentual',
            FORMAT_GUIDE_PERCENTAGE_FEE_DESC: 'Baseado no total de gastos para essa pessoa.',
            FORMAT_GUIDE_PERCENTAGE_FEE_EXAMPLE: '10% Taxa de serviço',

            FORMAT_GUIDE_SPECIFIC_SPLIT_NAME: 'Rateio específico',
            FORMAT_GUIDE_SPECIFIC_SPLIT_DESC: 'Adicione nomes separados por vírgula (ou iniciais) após " - " para dividir o gasto entre eles.',
            FORMAT_GUIDE_SPECIFIC_SPLIT_EXAMPLE: '7 Café - Mike\n50 Jantar - A, D',

            FORMAT_GUIDE_EXCLUDE_NAME: 'Excluir do rateio',
            FORMAT_GUIDE_EXCLUDE_DESC: 'Adicione ! após o nome para ser cobrado, mas não compartilhar o gasto.',
            FORMAT_GUIDE_EXCLUDE_EXAMPLE: 'Restaurante!\nRecibo!',

            FORMAT_GUIDE_SETTLEMENT_NAME: 'Acerto',
            FORMAT_GUIDE_SETTLEMENT_DESC: 'Registre pagamentos entre pessoas. Você pode usar os botões na seção de acertos para agilizar o processo.',
            FORMAT_GUIDE_SETTLEMENT_EXAMPLE: '50 > Ana\n50,40 > Mike\n70 > Restaurante',

            // Example Sections
            EXAMPLE_FRIENDS_TRIP_TITLE: 'Viagem de Amigos',
            EXAMPLE_FRIENDS_TRIP_TEXT: 'David\n45 Gasolina\n18,11 Pedágio\n15 Lanches\n\nAna\n50,30 Jantar\n15 Café - Ana, Mike\n\nMike\n12 Estacionamento\n60 Ingressos',

            EXAMPLE_FAMILY_DINNER_TITLE: 'Jantar em Família',
            EXAMPLE_FAMILY_DINNER_TEXT: 'David 2\n75,50 Legumes\n30,75 Acompanhamentos\n89,25 Carne\n\nMike 4\n45,25 Bebidas\n10 Gelo\n\nAna 5\n35 Sobremesa\n20 Suprimentos',

            EXAMPLE_BILL_SPLIT_TITLE: 'Divisão de Conta',
            EXAMPLE_BILL_SPLIT_TEXT: 'Conta!\n30 Aperitivos\n12 Bebida - D\n12 Bebida - M\n16 Prato - D\n18 Prato - M\n32 Prato - A\n10% Taxa de serviço\n\nAna 2\nDavid\nMike'
        },
        'es': {
            SETTLED_TEXT: 'LIQUIDADO',
            COPY_SUCCESS: 'COPIADO ✓',
            NOTHING_TO_COPY: 'Nada que copiar. Agregue algunos gastos primero.',
            COPY_ERROR: 'Error al copiar. Inténtelo de nuevo.',
            RESET_CONFIRM: '¿Está seguro de que desea borrar todos los datos? Esta acción no se puede deshacer.',
            RESET_ERROR: 'Error al borrar los datos. Inténtelo de nuevo.',
            EXPENSES: 'Gastos',
            COSTS: 'Costos',
            SETTLEMENTS: 'Liquidaciones',
            OWES_TEMPLATE: '{fromName} debe {amount} a {toName}',
            PAID_TEMPLATE: '{fromName} pagó {amount} a {toName}',
            PERSON_NOT_FOUND: 'no corresponde a ninguna persona listada',
            AMBIGUOUS_PERSON_TEMPLATE: '"{personRef}" es ambiguo - puede referirse a: {matchingNames}',
            PERSON_NOT_FOUND_TEMPLATE: '"{personRef}" {errorMessage}',
            DUPLICATE_NAME_TEMPLATE: 'Nombre "{currentName}" está duplicado con "{existingName}"',
            PERSON_WITH_PARTS_TEMPLATE: '{displayName} ({parts})',
            EXPENSE_WITH_PARTICIPANTS_TEMPLATE: '{description} - {participants}',
            COPY_MANUAL_SELECT: 'No se pudo copiar automáticamente. Seleccione y copie manualmente.',
            COPY_MANUAL_FALLBACK: 'Error al copiar. Intente seleccionar y copiar manualmente.',
            SETTLEMENT_ERROR: 'Error al procesar la liquidación. Inténtelo de nuevo.',
            ALL_SETTLED: '¡Todo liquidado!',
            NOTHING_TO_SETTLE: '¡Nada que liquidar!',
            COPY_SUMMARY: 'COPIAR RESUMEN',
            CLEAR: 'LIMPIAR',
            SETTLED_BUTTON: 'LIQUIDADO',
            ERROR_GENERATING_SUMMARY: 'Error al generar resumen',
            PLACEHOLDER: 'Agregue personas y gastos...\n(vea la guía de formato abajo)',

            // Format Guide Messages
            FORMAT_GUIDE_TITLE: 'Guía de Formato',
            FORMAT_GUIDE_PERSON_NAMES_NAME: 'Nombres de personas',
            FORMAT_GUIDE_PERSON_NAMES_DESC: 'Comience con un nombre en su propia línea. Los gastos agregados debajo del nombre fueron pagados por esa persona.',
            FORMAT_GUIDE_PERSON_NAMES_EXAMPLE: 'David\n45 Cena\n20 Bebidas',

            FORMAT_GUIDE_GROUP_SIZE_NAME: 'Tamaño del grupo',
            FORMAT_GUIDE_GROUP_SIZE_DESC: 'Número opcional después del nombre. Parte proporcional de la división.',
            FORMAT_GUIDE_GROUP_SIZE_EXAMPLE: 'Ana 3\nMike (2)',

            FORMAT_GUIDE_BASIC_EXPENSE_NAME: 'Gasto básico',
            FORMAT_GUIDE_BASIC_EXPENSE_DESC: 'Monto (con o sin centavos) con descripción opcional.',
            FORMAT_GUIDE_BASIC_EXPENSE_EXAMPLE: '25,50 Almuerzo\n45',

            FORMAT_GUIDE_PERCENTAGE_FEE_NAME: 'Tarifa porcentual',
            FORMAT_GUIDE_PERCENTAGE_FEE_DESC: 'Basado en el total de gastos para esa persona.',
            FORMAT_GUIDE_PERCENTAGE_FEE_EXAMPLE: '10% Tarifa de servicio',

            FORMAT_GUIDE_SPECIFIC_SPLIT_NAME: 'División específica',
            FORMAT_GUIDE_SPECIFIC_SPLIT_DESC: 'Agregue nombres separados por coma (o iniciales) después de " - " para dividir el gasto entre ellos.',
            FORMAT_GUIDE_SPECIFIC_SPLIT_EXAMPLE: '7 Café - Mike\n50 Cena - A, D',

            FORMAT_GUIDE_EXCLUDE_NAME: 'Excluir de la división',
            FORMAT_GUIDE_EXCLUDE_DESC: 'Agregue ! después del nombre para ser adeudado pero no compartir el gasto.',
            FORMAT_GUIDE_EXCLUDE_EXAMPLE: 'Restaurante!\nRecibo!',

            FORMAT_GUIDE_SETTLEMENT_NAME: 'Liquidación',
            FORMAT_GUIDE_SETTLEMENT_DESC: 'Registre pagos entre personas. Puede usar los botones en la sección de liquidaciones para acelerar el proceso.',
            FORMAT_GUIDE_SETTLEMENT_EXAMPLE: '50 > Ana\n50,40 > Mike\n70 > Restaurante',

            // Example Sections
            EXAMPLE_FRIENDS_TRIP_TITLE: 'Viaje de Amigos',
            EXAMPLE_FRIENDS_TRIP_TEXT: 'David\n45 Gasolina\n18,11 Peaje\n15 Aperitivos\n\nAna\n50,30 Cena\n15 Café - Ana, Mike\n\nMike\n12 Estacionamiento\n60 Entradas',

            EXAMPLE_FAMILY_DINNER_TITLE: 'Cena Familiar',
            EXAMPLE_FAMILY_DINNER_TEXT: 'David 2\n75,50 Verduras\n30,75 Guarniciones\n89,25 Carne\n\nMike 4\n45,25 Bebidas\n10 Hielo\n\nAna 5\n35 Postre\n20 Suministros',

            EXAMPLE_BILL_SPLIT_TITLE: 'División de Cuenta',
            EXAMPLE_BILL_SPLIT_TEXT: 'Cuenta!\n30 Entradas\n12 Bebida - D\n12 Bebida - M\n16 Plato - D\n18 Plato - M\n32 Plato - A\n10% Tarifa de servicio\n\nAna 2\nDavid\nMike'
        }
    },

    // Helper function to get localized string
    getString: function(key) {
        return this.STRINGS[currentLocale] && this.STRINGS[currentLocale][key]
            ? this.STRINGS[currentLocale][key]
            : this.STRINGS['en'][key] || key;
    },

    // Messages (kept for backward compatibility, now uses getString)
    get MESSAGES() {
        const strings = this.STRINGS[currentLocale] || this.STRINGS['en'];
        return {
            SETTLED_TEXT: strings.SETTLED_TEXT,
            COPY_SUCCESS: strings.COPY_SUCCESS,
            NOTHING_TO_COPY: strings.NOTHING_TO_COPY,
            COPY_ERROR: strings.COPY_ERROR,
            RESET_CONFIRM: strings.RESET_CONFIRM,
            RESET_ERROR: strings.RESET_ERROR,
            EXPENSES: strings.EXPENSES,
            COSTS: strings.COSTS,
            SETTLEMENTS: strings.SETTLEMENTS,
            OWES_TEMPLATE: strings.OWES_TEMPLATE,
            PAID_TEMPLATE: strings.PAID_TEMPLATE,
            PERSON_NOT_FOUND: strings.PERSON_NOT_FOUND,
            AMBIGUOUS_PERSON_TEMPLATE: strings.AMBIGUOUS_PERSON_TEMPLATE,
            PERSON_NOT_FOUND_TEMPLATE: strings.PERSON_NOT_FOUND_TEMPLATE,
            DUPLICATE_NAME_TEMPLATE: strings.DUPLICATE_NAME_TEMPLATE,
            PERSON_WITH_PARTS_TEMPLATE: strings.PERSON_WITH_PARTS_TEMPLATE,
            EXPENSE_WITH_PARTICIPANTS_TEMPLATE: strings.EXPENSE_WITH_PARTICIPANTS_TEMPLATE,
            COPY_MANUAL_SELECT: strings.COPY_MANUAL_SELECT,
            COPY_MANUAL_FALLBACK: strings.COPY_MANUAL_FALLBACK,
            SETTLEMENT_ERROR: strings.SETTLEMENT_ERROR,
            ALL_SETTLED: strings.ALL_SETTLED,
            NOTHING_TO_SETTLE: strings.NOTHING_TO_SETTLE,
            ERROR_GENERATING_SUMMARY: strings.ERROR_GENERATING_SUMMARY,
            PLACEHOLDER: strings.PLACEHOLDER
        };
    },

    // LocalStorage
    STORAGE_KEY: 'expenseInputData',

    // Number formatting
    DEFAULT_LOCALE: currentLocale === 'pt-BR' ? 'pt-BR' : currentLocale === 'es' ? 'es-ES' : 'en-US',
};

// Function to initialize UI with localized strings
function generateFormatGuideHTML() {
    const formatGuideItems = [
        'PERSON_NAMES', 'GROUP_SIZE', 'BASIC_EXPENSE',
        'PERCENTAGE_FEE', 'SPECIFIC_SPLIT', 'EXCLUDE', 'SETTLEMENT'
    ];

    let html = `<div class="format-guide">
        <h2>${CONSTANTS.getString('FORMAT_GUIDE_TITLE')}</h2>`;

    formatGuideItems.forEach(item => {
        html += `
        <div class="format-item">
            <div class="format-name">${CONSTANTS.getString(`FORMAT_GUIDE_${item}_NAME`)}</div>
            <div class="format-description">${CONSTANTS.getString(`FORMAT_GUIDE_${item}_DESC`)}</div>
            <div class="format-example"><pre>${CONSTANTS.getString(`FORMAT_GUIDE_${item}_EXAMPLE`)}</pre></div>
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
            <h2>${CONSTANTS.getString(`EXAMPLE_${example.titleKey}_TITLE`)}</h2>
            <pre class="example-input">${CONSTANTS.getString(`EXAMPLE_${example.textKey}_TEXT`)}</pre>
        </div>`;
    });

    html += `</div>`;
    return html;
}

function initializeUI() {
    const { textarea, copyButton, resetButton } = DOMUtils.getElements();

    // Set textarea placeholder
    if (textarea) textarea.placeholder = CONSTANTS.getString('PLACEHOLDER');

    // Set button texts
    if (copyButton) copyButton.textContent = CONSTANTS.getString('COPY_SUMMARY');
    if (resetButton) resetButton.textContent = CONSTANTS.getString('CLEAR');

    // Set settlement button template text
    const settlementTemplate = DOMUtils.getElement('settlement-template');
    if (settlementTemplate) {
        const settleText = settlementTemplate.content.querySelector('.settle-text');
        if (settleText) settleText.textContent = ' ' + CONSTANTS.getString('SETTLED_BUTTON');
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
    },


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

// Utility function to manage button visibility
// Helper functions for generating empty section HTML
function getEmptyExpensesHTML() {
    return `
        <div class="summary expenses-summary expenses-total">
            <span class="label">${CONSTANTS.MESSAGES.COSTS}</span>
            <span class="total">${NumberLogic.formatNumber(0)}</span>
        </div>`;
}

function getEmptySettlementsHTML() {
    return `
        <div class="summary settlements-summary settlements-total">
            <span class="label">${CONSTANTS.MESSAGES.NOTHING_TO_SETTLE}</span>
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
            CONSTANTS.MESSAGES.OWES_TEMPLATE,
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
            CONSTANTS.MESSAGES.PAID_TEMPLATE,
            {
                fromName: fromName,
                amount: NumberLogic.formatNumber(settlement.amount),
                toName: toName
            }
        );

        return TemplateUtils.templateToHTML(clone);
    }
};
// Utility function to generate no-data message HTML using template




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

        // First pass: collect all person names
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
                        error: formatTemplate(CONSTANTS.MESSAGES.DUPLICATE_NAME_TEMPLATE, {
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
                        error: formatTemplate(CONSTANTS.MESSAGES.AMBIGUOUS_PERSON_TEMPLATE, {
                            personRef: validation.personRef,
                            matchingNames: matchingNames
                        })
                    });
                } else if (validation.notFound) {
                    warnings.push({
                        text: line,
                        error: formatTemplate(CONSTANTS.MESSAGES.PERSON_NOT_FOUND_TEMPLATE, {
                            personRef: validation.personRef,
                            errorMessage: CONSTANTS.MESSAGES.PERSON_NOT_FOUND
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
                            error: formatTemplate(CONSTANTS.MESSAGES.AMBIGUOUS_PERSON_TEMPLATE, {
                                personRef: validation.personRef,
                                matchingNames: matchingNames
                            })
                        });
                    } else if (validation.notFound) {
                        warnings.push({
                            text: line,
                            error: formatTemplate(CONSTANTS.MESSAGES.PERSON_NOT_FOUND_TEMPLATE, {
                                personRef: validation.personRef,
                                errorMessage: CONSTANTS.MESSAGES.PERSON_NOT_FOUND
                            })
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
            return formatTemplate(CONSTANTS.MESSAGES.PERSON_WITH_PARTS_TEMPLATE, {
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

            // Use browser's locale for number formatting
            const locale = navigator.language || CONSTANTS.DEFAULT_LOCALE;
            return amount.toLocaleString(locale, {
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
    },


};



// Expense Parsing Logic Module
const ExpenseLogic = {
    // Parse expenses text into structured data
    parseExpenses(text) {
        try {
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
                    currentPerson = null;
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
                            description = formatTemplate(CONSTANTS.MESSAGES.EXPENSE_WITH_PARTICIPANTS_TEMPLATE, {
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
        } catch (error) {
            console.error('Error parsing expenses:', error);
            return { people: {}, transactions: [] };
        }
    }
};

// Calculation Logic Module
const CalculationLogic = {
    // Calculate fair shares for each person
    calculateFairShares(names, transactions, peopleData) {
        // Calculate total amounts each person owes across all expenses
        // Now uses parts/shares for proportional division instead of equal splits
        const totalOwed = {};
        names.forEach(name => {
            totalOwed[name] = 0;
        });

        // Filter for expenses only and process them
        const expenseTransactions = this.getExpenseTransactions(transactions);

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

            // Calculate total parts for this expense
            const totalParts = participants.reduce((sum, person) => {
                const parts = peopleData[person] ? peopleData[person].parts : 1;
                return sum + parts;
            }, 0);

            // Distribute the expense based on parts
            let distributedCents = 0;
            const distributions = [];

            participants.forEach(person => {
                const parts = peopleData[person] ? peopleData[person].parts : 1;
                const personShareCents = Math.round((amountCents * parts) / totalParts);

                distributions.push({ person, amount: personShareCents });
                distributedCents += personShareCents;
            });

            // Handle any rounding difference
            const difference = amountCents - distributedCents;
            if (difference !== 0) {
                // Add the difference to the person with the highest parts (most fair)
                const maxPartsParticipant = participants.reduce((max, person) => {
                    const parts = peopleData[person] ? peopleData[person].parts : 1;
                    const maxParts = peopleData[max] ? peopleData[max].parts : 1;
                    return parts > maxParts ? person : max;
                });

                const adjustmentIndex = distributions.findIndex(d => d.person === maxPartsParticipant);
                if (adjustmentIndex !== -1) {
                    distributions[adjustmentIndex].amount += difference;
                }
            }

            // Apply the distributions
            distributions.forEach(({ person, amount }) => {
                totalOwed[person] += amount;
            });
        });

        // Convert cents to dollars for base fair shares
        const fairShares = {};
        names.forEach(name => {
            fairShares[name] = totalOwed[name] / 100;
        });

        // Apply percentage fees to each person's total
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
                if (fairShares[personName] !== undefined) {
                    const currentTotal = fairShares[personName];
                    const feeAmount = (currentTotal * fee.percentage) / 100;
                    fairShares[personName] += feeAmount;
                }
            });
        });

        return fairShares;
    },

    // Calculate settlements needed
    calculateSettlements(people, transactions) {
        try {
            const names = Object.keys(people);
            if (names.length === 0) return [];

            const fairShares = this.calculateFairShares(names, transactions, people);

            // Calculate balances accounting for existing settlements
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

            // Apply existing settlements to adjust balances
            this.getSettlementTransactions(transactions).forEach(settlement => {
                if (settlement.settleTo) {
                    // Settlement from paidBy to settleTo
                    balances[settlement.paidBy] += settlement.amount; // Payer owes less
                    balances[settlement.settleTo] -= settlement.amount; // Recipient is owed less
                }
            });

            // Calculate remaining settlements needed
            const settlements = [];
            const debtors = names.filter(name => balances[name] < -0.01).map(name => ({
                name,
                amount: Math.abs(balances[name])
            })).sort((a, b) => b.amount - a.amount);

            const creditors = names.filter(name => balances[name] > 0.01).map(name => ({
                name,
                amount: balances[name]
            })).sort((a, b) => b.amount - a.amount);

            let i = 0, j = 0;
            while (i < debtors.length && j < creditors.length) {
                const debtor = debtors[i];
                const creditor = creditors[j];
                const amount = Math.min(debtor.amount, creditor.amount);

                if (amount > 0.01) {
                    settlements.push({
                        from: debtor.name,
                        to: creditor.name,
                        amount: amount
                    });

                    debtor.amount -= amount;
                    creditor.amount -= amount;
                }

                if (debtor.amount < 0.01) i++;
                if (creditor.amount < 0.01) j++;
            }

            return settlements;
        } catch (error) {
            console.error('Error calculating settlements:', error);
            return [];
        }
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

// Summary generation utilities
const SummaryUtils = {
    // Generate expenses block
    generateExpensesBlock() {
        const paymentsText = formatPaymentsText();
        if (!paymentsText) return '';

        return `*${CONSTANTS.MESSAGES.EXPENSES.toUpperCase()}*\n${paymentsText}\n`;
    },

    // Generate costs block
    generateCostsBlock(totalExpenses, fairShares) {
        const names = Object.keys(currentPeopleData);
        const header = totalExpenses === 0
            ? `\n*${CONSTANTS.MESSAGES.COSTS.toUpperCase()}*\n`
            : `\n*${CONSTANTS.MESSAGES.COSTS.toUpperCase()}* = ${NumberLogic.formatNumber(totalExpenses)}\n`;

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
            ? `*${CONSTANTS.MESSAGES.ALL_SETTLED.toUpperCase()}*`
            : `*${CONSTANTS.MESSAGES.SETTLEMENTS.toUpperCase()}*`;

        let content = `\n${header}\n`;

        // Active settlements
        if (totalExpenses === 0) {
            content += CONSTANTS.MESSAGES.NOTHING_TO_SETTLE + '\n';
        } else if (currentSettlements.length > 0) {
            currentSettlements.forEach(settlement => {
                const { fromName, toName } = PersonDisplay.getSettlementNames(settlement, currentPeopleData);
                content += formatTemplate(CONSTANTS.MESSAGES.OWES_TEMPLATE, {
                    fromName, amount: NumberLogic.formatNumber(settlement.amount), toName
                }) + '\n';
            });
        }

        // Completed settlements
        settlementTransactions.forEach(settlement => {
            const { fromName, toName } = PersonDisplay.getSettlementNames(settlement, currentPeopleData, 'paidBy', 'settleTo');
            content += formatTemplate(CONSTANTS.MESSAGES.PAID_TEMPLATE, {
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
        saveToLocalStorage();

        // Only apply formatting if there are no validation warnings
        const input = TextareaUtils.getValue();
        const warnings = ValidationLogic.validateExpenses(input);
        if (warnings.length === 0) {
            TextareaUtils.applyFormattedText(false); // Don't save again since we just saved
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

        // Calculate maximum width for amounts across all expense transactions only
        let maxWidth = 0;
        CalculationLogic.getExpenseTransactions(currentTransactions).forEach(transaction => {
            const width = NumberLogic.formatNumber(transaction.amount).length;
            if (width > maxWidth) maxWidth = width;
        });

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

                        let description = transaction.description || '';
                        const formattedAmount = NumberLogic.formatNumber(transaction.amount);

                        // Add participant names only if split with specific people (not all)
                        if (transaction.sharedWith.length > 0) {
                            // Add participants to description
                            const participants = transaction.sharedWith.map(p => {
                                const participantData = currentPeopleData[p];
                                return participantData ? participantData.displayName : p;
                            }).join(', ');
                            description = description ? `${description} - ${participants}` : `- ${participants}`;
                        }

                        const paddedAmount = formattedAmount.padStart(maxWidth, ' ');
                        const fullDescription = description ? ` ${description}` : '';
                        formattedText += `${paddedAmount}${fullDescription}\n`;
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

function copyToClipboard() {
    try {

        const names = Object.keys(currentPeopleData);
        if (names.length === 0) return;

        const totalExpenses = CalculationLogic.calculateTotalExpenses(currentTransactions);
        const fairShares = CalculationLogic.calculateFairShares(names, currentTransactions, currentPeopleData);
        const settlementTransactions = CalculationLogic.getSettlementTransactions(currentTransactions);

        let textSummary = [
            SummaryUtils.generateExpensesBlock(),
            SummaryUtils.generateCostsBlock(totalExpenses, fairShares),
            SummaryUtils.generateSettlementsBlock(totalExpenses, settlementTransactions)
        ].join('');

        if (!textSummary) {
            alert(CONSTANTS.MESSAGES.NOTHING_TO_COPY);
            return;
        }

        // Also format and update the input text
        TextareaUtils.applyFormattedText();

        // Use the modern clipboard API
        if (navigator.clipboard && window.isSecureContext) {
            navigator.clipboard.writeText(textSummary).then(() => {
                showCopySuccess();
            }).catch(err => {
                console.error('Failed to copy with clipboard API:', err);
                alert(CONSTANTS.MESSAGES.COPY_ERROR);
            });
        } else {
            alert(CONSTANTS.MESSAGES.COPY_ERROR);
        }
    } catch (error) {
        ErrorHandler.handleUIError(error, CONSTANTS.MESSAGES.COPY_ERROR);
    }
}

function showCopySuccess() {
    const button = document.getElementById('copyButton');
    const originalText = button.textContent;
    button.textContent = CONSTANTS.MESSAGES.COPY_SUCCESS;
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

        // Always display validation warnings
        const warnings = ValidationLogic.validateExpenses(input);
        ValidationDisplay.displayValidationWarnings(warnings);

        // If there are critical validation errors, just show warnings and return
        if (warnings.length > 0) {
            return;
        }

        // Handle empty input or no valid names - show empty sections
        let people = {};
        let transactions = [];
        let names = [];

        if (input.trim()) {
            const parsed = ExpenseLogic.parseExpenses(input);
            people = parsed.people;
            transactions = parsed.transactions;
            names = Object.keys(people);
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
            textarea.value = lines.join('\n');

            // Reparse the expenses to update data structures with the new settlement
            const { people, transactions } = ExpenseLogic.parseExpenses(textarea.value);

            if (people && transactions) {
                currentPeopleData = people;
                currentTransactions = transactions;

                // Now reformat the input text with updated data
                TextareaUtils.applyFormattedText(false); // Don't save to storage here, we'll save below
            }

            // Save to localStorage after updating textarea
            saveToLocalStorage();

            // Show success state with green background
            const settlementWrapper = document.querySelector(`[data-settlement-index="${settlementIndex}"]`);
            if (settlementWrapper) {
                settlementWrapper.classList.add('settlement-success');

                // Replace the settlement text with "Acertado"
                const settlementText = settlementWrapper.querySelector('.label');
                if (settlementText) {
                    settlementText.textContent = CONSTANTS.MESSAGES.SETTLED_TEXT;
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
        ErrorHandler.handleUIError(error, CONSTANTS.MESSAGES.SETTLEMENT_ERROR);
    } finally {
        // Always reset the settling flag
        setTimeout(() => {
            isSettling = false;
        }, 100);
    }
}


// Add debounced event listener with error handling
document.getElementById('expenseInput').addEventListener('input', function() {
    try {
        // Auto-expand textarea first
        autoExpandTextarea(this);

        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => {
            try {
                updateResults();
                saveToLocalStorage(); // Save to localStorage after updating results
            } catch (error) {
                ErrorHandler.handleProcessingError(error);
            }
        }, CONSTANTS.DEBOUNCE_TIMEOUT);
    } catch (error) {
        console.warn('Input handler error', error);
    }
});


// Initial calculation with error handling
try {
    updateResults();
} catch (error) {
    ErrorHandler.handleProcessingError(error);
}
// localStorage functions
function resetData() {
    const confirmReset = confirm(CONSTANTS.MESSAGES.RESET_CONFIRM);

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
            ErrorHandler.handleUIError(error, CONSTANTS.MESSAGES.RESET_ERROR);
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

// Load saved data when page loads
// Auto-expanding textarea functionality
function autoExpandTextarea(textarea) {
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
}


// Handle window resize to recalculate max height
window.addEventListener('resize', function() {
    const textarea = document.getElementById('expenseInput');
    if (textarea) {
        autoExpandTextarea(textarea);
    }
});

document.addEventListener('DOMContentLoaded', function() {
    initializeUI();
    loadFromLocalStorage();
    // Set initial height after loading
    const textarea = document.getElementById('expenseInput');
    if (textarea) {
        autoExpandTextarea(textarea);
    }
});
