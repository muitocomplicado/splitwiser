# AGENTS.md - Splitwiser Development Guide

## Project Overview
Splitwiser is a vanilla HTML/CSS/JavaScript PWA for expense splitting calculations. No build system, frameworks, or dependencies.

## Code Style Guidelines
- **Language**: Vanilla JavaScript (ES6+), HTML5, CSS3
- **Structure**: HTML in `index.html`, Javascript in `locale.js`, `lib.js`, `ui.js` and CSS in `styles.css`.
- **Variables**: camelCase for JS variables, kebab-case for CSS classes
- **Functions**: Descriptive names, try/catch for error handling
- **Constants**: UPPER_SNAKE_CASE in CONSTANTS object
- **CSS**: CSS custom properties (variables) for theming, mobile-first responsive design
- **Localization**: Multi-language support via LOCALE.getString() with support for: "en-US", "pt-BR" and "es-ES"
- **Error Handling**: Use ErrorHandler utility for consistent error management
- **Comments**: Minimal - code should be self-documenting
- **Environment Compatibility**: Code must work in both Node.js and browser environments
- **Module Exports**: Use conditional exports for dual compatibility

## Architecture Notes
- **Dual Environment Support**: Code works in both Node.js and browser environments
- **PWA with manifest.json and service worker capabilities**
- **Dark/light mode support via CSS media queries**
- **Local storage for data persistence**
- **Template-based HTML generation for dynamic content**
- **Debounced input processing for performance**
- **Universal Module Pattern**: Environment detection and conditional exports

## Testing
- **Node.js Testing**: Run `node tests.js` to execute the complete test suite via command line
- **DO NOT run any server** to test any changes, tests should work without servers
- **Test Coverage**: tests only business logic with test cases covering:
  - Number parsing and formatting
  - Person name parsing and validation
  - Transaction parsing
  - Calculation logic and fair share distribution
  - Expense parsing and validation
  - Settlement calculations
  - Error handling and edge cases

### Test Environment Compatibility
- **Universal Modules**: `locale.js` and `lib.js` work in both Node.js and browser environments
- **Environment Detection**: Automatic detection via `typeof window !== 'undefined'`
- **Conditional Exports**: Node.js uses `module.exports`, browser uses global variables
- **API Fallbacks**: Navigator APIs mocked for Node.js environment
