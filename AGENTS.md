# AGENTS.md - Splitwiser Development Guide

## Project Overview
Splitwiser is a vanilla HTML/CSS/JavaScript PWA for expense splitting calculations. No build system, frameworks, or dependencies.

## Development Commands
- **Development server**: ./server.sh to start the development server.
- **Testing**: automated tests should be created in test.html.
- **Deploy**: ./deploy.sh to release a new version.

## Code Style Guidelines
- **Language**: Vanilla JavaScript (ES6+), HTML5, CSS3
- **Structure**: HTML in `index.html`, Javascript in `script.js` and CSS in `style.css`.
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
