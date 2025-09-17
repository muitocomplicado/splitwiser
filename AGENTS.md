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

## Architecture Notes
- PWA with manifest.json and service worker capabilities
- Dark/light mode support via CSS media queries
- Local storage for data persistence
- Template-based HTML generation for dynamic content
- Debounced input processing for performance

## Development
- **Testing**: Don't run any server or browser to test any changes.