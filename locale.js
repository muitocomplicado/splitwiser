// ===== SPLITWISER LOCALIZATION =====
// Localization constants and strings
// This file should be included before lib.js and ui.js

// Environment detection
const isBrowser = typeof window !== 'undefined';

// Navigator fallback for Node.js environment
const navigator = isBrowser ? window.navigator : { 
    language: 'en-US',
    userLanguage: 'en-US'
};

// Locale detection and management
function getLocale() {
    const browserLang = navigator.language || navigator.userLanguage || 'en-US';
    const lang = browserLang.toLowerCase();

    if (lang.startsWith('pt')) return 'pt-BR';
    if (lang.startsWith('es')) return 'es-ES';
    return 'en-US';
}

// Localization constants
const LOCALE = {
    // Localized strings
    STRINGS: {
        'en-US': {
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
            FORMAT_GUIDE_GROUP_SIZE_EXAMPLE: 'Ana 3\nCris (2)',

            FORMAT_GUIDE_BASIC_EXPENSE_NAME: 'Basic expense',
            FORMAT_GUIDE_BASIC_EXPENSE_DESC: 'Amount (with or without cents) with optional description.',
            FORMAT_GUIDE_BASIC_EXPENSE_EXAMPLE: '25.50 Lunch\n45',

            FORMAT_GUIDE_PERCENTAGE_FEE_NAME: 'Percentage fee',
            FORMAT_GUIDE_PERCENTAGE_FEE_DESC: 'Based on total expenses for that person.',
            FORMAT_GUIDE_PERCENTAGE_FEE_EXAMPLE: '10% Service fee',

            FORMAT_GUIDE_SPECIFIC_SPLIT_NAME: 'Specific split',
            FORMAT_GUIDE_SPECIFIC_SPLIT_DESC: 'Add comma separated names (or initials) after " - " to split the expense among them.',
            FORMAT_GUIDE_SPECIFIC_SPLIT_EXAMPLE: '7 Coffee - Cris\n50 Dinner - A, D',

            FORMAT_GUIDE_EXCLUDE_NAME: 'Exclude from split',
            FORMAT_GUIDE_EXCLUDE_DESC: 'Add ! after the name to be owed but not share the expense.',
            FORMAT_GUIDE_EXCLUDE_EXAMPLE: 'Restaurant!\nReceipt!',

            FORMAT_GUIDE_SETTLEMENT_NAME: 'Settlement',
            FORMAT_GUIDE_SETTLEMENT_DESC: 'Register payments between people. You can use the buttons in the settlement section to speed up the process.',
            FORMAT_GUIDE_SETTLEMENT_EXAMPLE: '50 > Ana\n50.40 > Cris\n70 > Restaurant',

            // Example Sections
            EXAMPLE_FRIENDS_TRIP_TITLE: 'Friends Trip',
            EXAMPLE_FRIENDS_TRIP_TEXT: 'David\n45 Gas\n18.11 Toll\n15 Snacks\n\nAna\n50.30 Dinner\n15 Coffee - Ana, Cris\n\nCris\n12 Parking\n60 Tickets',

            EXAMPLE_FAMILY_DINNER_TITLE: 'Family Dinner',
            EXAMPLE_FAMILY_DINNER_TEXT: 'David 2\n75.50 Vegetables\n30.75 Sides\n89.25 Meats\n\nCris 4\n45.25 Drinks\n10 Ice\n\nAna 5\n35 Dessert\n20 Supplies',

            EXAMPLE_BILL_SPLIT_TITLE: 'Bill Split',
            EXAMPLE_BILL_SPLIT_TEXT: 'Bill!\n30 Appetizers\n12 Drink - D\n12 Drink - C\n16 Entree - D\n18 Entree - C\n32 Entree - A\n10% Service fee\n\nAna 2\nDavid\nCris'
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
            FORMAT_GUIDE_PERSON_NAMES_DESC: 'Defina um nome em sua própria linha. Gastos adicionados abaixo do nome foram pagos por essa pessoa.',
            FORMAT_GUIDE_PERSON_NAMES_EXAMPLE: 'David\n50 Jantar\n20 Bebidas',

            FORMAT_GUIDE_GROUP_SIZE_NAME: 'Tamanho do grupo',
            FORMAT_GUIDE_GROUP_SIZE_DESC: 'Número opcional após o nome. Faz o rateio proporcionalmente com o tamanho do grupo.',
            FORMAT_GUIDE_GROUP_SIZE_EXAMPLE: 'Ana 3\nCris (2)',

            FORMAT_GUIDE_BASIC_EXPENSE_NAME: 'Gasto básico',
            FORMAT_GUIDE_BASIC_EXPENSE_DESC: 'Valor (com ou sem centavos) com descrição opcional.',
            FORMAT_GUIDE_BASIC_EXPENSE_EXAMPLE: '25,50 Almoço\n45',

            FORMAT_GUIDE_PERCENTAGE_FEE_NAME: 'Taxa percentual',
            FORMAT_GUIDE_PERCENTAGE_FEE_DESC: 'Baseado no total de gastos para essa pessoa.',
            FORMAT_GUIDE_PERCENTAGE_FEE_EXAMPLE: '10% Taxa de serviço',

            FORMAT_GUIDE_SPECIFIC_SPLIT_NAME: 'Rateio específico',
            FORMAT_GUIDE_SPECIFIC_SPLIT_DESC: 'Adicione nomes separados por vírgula (ou iniciais) após " - " para dividir o gasto entre eles.',
            FORMAT_GUIDE_SPECIFIC_SPLIT_EXAMPLE: '7 Café - Cris\n50 Jantar - A, D',

            FORMAT_GUIDE_EXCLUDE_NAME: 'Excluir do rateio',
            FORMAT_GUIDE_EXCLUDE_DESC: 'Adicione ! após o nome para ser devido, mas não compartilhar o gasto.',
            FORMAT_GUIDE_EXCLUDE_EXAMPLE: 'Restaurante!\nRecibo!',

            FORMAT_GUIDE_SETTLEMENT_NAME: 'Acerto',
            FORMAT_GUIDE_SETTLEMENT_DESC: 'Registre pagamentos entre pessoas. Você pode usar os botões na seção de acertos para agilizar o processo.',
            FORMAT_GUIDE_SETTLEMENT_EXAMPLE: '50 > Ana\n50,40 > Cris\n70 > Restaurante',

            // Example Sections
            EXAMPLE_FRIENDS_TRIP_TITLE: 'Viagem de Amigos',
            EXAMPLE_FRIENDS_TRIP_TEXT: 'David\n45 Gasolina\n18,11 Pedágio\n15 Lanches\n\nAna\n50,30 Jantar\n15 Café - Ana, Cris\n\nCris\n12 Estacionamento\n60 Ingressos',

            EXAMPLE_FAMILY_DINNER_TITLE: 'Jantar em Família',
            EXAMPLE_FAMILY_DINNER_TEXT: 'David 2\n75,50 Legumes\n30,75 Acompanhamentos\n89,25 Carne\n\nCris 4\n45,25 Bebidas\n10 Gelo\n\nAna 5\n35 Sobremesa\n20 Suprimentos',

            EXAMPLE_BILL_SPLIT_TITLE: 'Divisão de Conta',
            EXAMPLE_BILL_SPLIT_TEXT: 'Restaurante!\n30 Aperitivos\n12 Bebida - D\n12 Bebida - C\n16 Prato - D\n18 Prato - C\n32 Prato - A\n10% Taxa de serviço\n\nAna 2\nDavid\nCris'
        },
        'es-ES': {
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
            FORMAT_GUIDE_GROUP_SIZE_EXAMPLE: 'Ana 3\nCris (2)',

            FORMAT_GUIDE_BASIC_EXPENSE_NAME: 'Gasto básico',
            FORMAT_GUIDE_BASIC_EXPENSE_DESC: 'Monto (con o sin centavos) con descripción opcional.',
            FORMAT_GUIDE_BASIC_EXPENSE_EXAMPLE: '25,50 Almuerzo\n45',

            FORMAT_GUIDE_PERCENTAGE_FEE_NAME: 'Tarifa porcentual',
            FORMAT_GUIDE_PERCENTAGE_FEE_DESC: 'Basado en el total de gastos para esa persona.',
            FORMAT_GUIDE_PERCENTAGE_FEE_EXAMPLE: '10% Tarifa de servicio',

            FORMAT_GUIDE_SPECIFIC_SPLIT_NAME: 'División específica',
            FORMAT_GUIDE_SPECIFIC_SPLIT_DESC: 'Agregue nombres separados por coma (o iniciales) después de " - " para dividir el gasto entre ellos.',
            FORMAT_GUIDE_SPECIFIC_SPLIT_EXAMPLE: '7 Café - Cris\n50 Cena - A, D',

            FORMAT_GUIDE_EXCLUDE_NAME: 'Excluir de la división',
            FORMAT_GUIDE_EXCLUDE_DESC: 'Agregue ! después del nombre para ser adeudado pero no compartir el gasto.',
            FORMAT_GUIDE_EXCLUDE_EXAMPLE: 'Restaurante!\nRecibo!',

            FORMAT_GUIDE_SETTLEMENT_NAME: 'Liquidación',
            FORMAT_GUIDE_SETTLEMENT_DESC: 'Registre pagos entre personas. Puede usar los botones en la sección de liquidaciones para acelerar el proceso.',
            FORMAT_GUIDE_SETTLEMENT_EXAMPLE: '50 > Ana\n50,40 > Cris\n70 > Restaurante',

            // Example Sections
            EXAMPLE_FRIENDS_TRIP_TITLE: 'Viaje de Amigos',
            EXAMPLE_FRIENDS_TRIP_TEXT: 'David\n45 Gasolina\n18,11 Peaje\n15 Aperitivos\n\nAna\n50,30 Cena\n15 Café - Ana, Cris\n\nCris\n12 Estacionamiento\n60 Entradas',

            EXAMPLE_FAMILY_DINNER_TITLE: 'Cena Familiar',
            EXAMPLE_FAMILY_DINNER_TEXT: 'David 2\n75,50 Verduras\n30,75 Guarniciones\n89,25 Carne\n\nCris 4\n45,25 Bebidas\n10 Hielo\n\nAna 5\n35 Postre\n20 Suministros',

            EXAMPLE_BILL_SPLIT_TITLE: 'División de Cuenta',
            EXAMPLE_BILL_SPLIT_TEXT: 'Restaurante!\n30 Entradas\n12 Bebida - D\n12 Bebida - C\n16 Plato - D\n18 Plato - C\n32 Plato - A\n10% Tarifa de servicio\n\nAna 2\nDavid\nCris'
        }
    },

    // Helper function to get localized string
    getString: function(key) {
        const currentLocalePrefix = getLocale();
        return this.STRINGS[currentLocalePrefix] && this.STRINGS[currentLocalePrefix][key]
            ? this.STRINGS[currentLocalePrefix][key]
            : this.STRINGS['en'][key] || key;
    },

};

// Conditional exports for Node.js compatibility
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { LOCALE, getLocale };
}
