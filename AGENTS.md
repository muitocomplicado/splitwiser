# AGENTS.md - Splitwiser Development Guide

## Project Overview
Splitwiser is a vanilla HTML/CSS/JavaScript PWA for expense splitting calculations. No build system, frameworks, or dependencies.

## Development Commands
- **Dev server**: do NOT start the dev server, it will be started manually.
- **No build/lint/test commands** - this is a simple static HTML app, do NOT run test commands.
- **Testing**: Manual testing only - no automated test files needed
- **Deploy**: Copy files to web server (static hosting)

## Code Style Guidelines
- **Language**: Vanilla JavaScript (ES6+), HTML5, CSS3
- **Structure**: Single-file architecture - all code in `index.html`
- **Variables**: camelCase for JS variables, kebab-case for CSS classes
- **Functions**: Descriptive names, try/catch for error handling
- **Constants**: UPPER_SNAKE_CASE in CONSTANTS object
- **CSS**: CSS custom properties (variables) for theming, mobile-first responsive design
- **Localization**: Multi-language support via CONSTANTS.STRINGS object
- **Error Handling**: Use ErrorHandler utility for consistent error management
- **Comments**: Minimal - code should be self-documenting

## Architecture Notes
- PWA with manifest.json and service worker capabilities
- Dark/light mode support via CSS media queries
- Local storage for data persistence
- Template-based HTML generation for dynamic content
- Debounced input processing for performance
