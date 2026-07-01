# CSS Architecture

## Overview

The frontend CSS has been refactored from a single 1742-line `index.css` file into a modular architecture with 6 logically-organized stylesheets. This improves maintainability, scalability, and team collaboration without affecting bundle size or visual appearance.

## File Structure

```
frontend/
├── src/
│   ├── index.css (8 lines - import aggregator)
│   ├── styles/
│   │   ├── base.css (172 lines)
│   │   ├── components.css (444 lines)
│   │   ├── layouts.css (518 lines)
│   │   ├── tables.css (243 lines)
│   │   ├── pages.css (246 lines)
│   │   └── modals.css (112 lines)
│   ├── main.tsx (imports index.css)
│   └── ...
└── CSS_ARCHITECTURE.md (this file)
```

## Module Responsibilities

### 1. **base.css** — Foundation Layer
Provides the lowest-level CSS: design tokens, resets, and global defaults.

**Contains:**
- CSS custom properties (--md-primary, --md-surface, --md-border, etc.)
- HTML/body resets and global styling
- Typography defaults (h1, h2, p)
- Base form element styles (input, select, label, textarea)
- Utility text classes (.text-muted, .error, .success)
- Admin links styling

**When to add to base.css:**
- New CSS variables
- Global typography rules
- Base element resets
- Cross-application utility classes

### 2. **components.css** — Reusable UI Components
Encapsulates self-contained UI components that can be used anywhere without positioning context.

**Contains:**
- Buttons (.btn, .btn-primary, .btn-outline, .btn-secondary, .btn-full)
- Cards and avatars
- Badges (.badge, .badge-active, etc.)
- Chips (.subject-chip, .class-chip with color variants)
- Koepel selection options
- User lists and user items
- Link buttons and delete buttons
- Empty states and inline messages

**When to add to components.css:**
- New reusable UI components
- Variant styles for existing components
- Component-specific responsive behavior

### 3. **layouts.css** — Grid Systems & Positioning
Defines how components are arranged on pages and screens.

**Contains:**
- Container layouts (.center-container, .page-container)
- Page headers and structural layouts
- Grid systems (.management-grid, .observing-layout, .stats-grid)
- Goal/student selection cards and lists
- Status options and goal selection bars
- Form and list cards
- Page-wide responsive breakpoints

**When to add to layouts.css:**
- New page layouts or grid systems
- Responsive grid adjustments
- Container and spacing patterns
- Page header variations

### 4. **tables.css** — Data Tables & Lists
Specialized styles for tabular data presentation.

**Contains:**
- Data table (.data-table) styling
- Student observation table with vertical column headers
- Overview table with fixed columns and specific width constraints
- Table wrappers and scrolling behavior
- Overview status chips and observation pills
- Table-specific responsive behavior

**When to add to tables.css:**
- New table styles or variants
- Table column width adjustments
- Table-specific responsive rules
- Row/cell styling for specific data types

### 5. **pages.css** — Feature-Specific Styles
Styles unique to specific pages or features that don't fit into the generic component/layout layers.

**Contains:**
- Home page layout and styling (.home-page, .home-grid, .home-card)
- Overview page filters and comment popups
- Observations page and observing-specific styles
- Feature-specific responsive overrides
- Goal results and goal options

**When to add to pages.css:**
- Page-specific styling that doesn't belong in other modules
- Feature-unique components or layouts
- Page-specific responsive behavior

### 6. **modals.css** — Dialogs & Overlays
Styles for modal dialogs, popups, and overlay patterns.

**Contains:**
- Modal backdrop and positioning
- Modal card layout
- Modal header, footer, and action sections
- Preview modal styling
- Goal modal filters
- Modal-specific responsive behavior

**When to add to modals.css:**
- New modal or dialog styles
- Overlay patterns
- Popup positioning

## Import Chain

```
main.tsx
  ↓
index.css (entry point)
  ├── @import './styles/base.css'
  ├── @import './styles/components.css'
  ├── @import './styles/layouts.css'
  ├── @import './styles/tables.css'
  ├── @import './styles/pages.css'
  └── @import './styles/modals.css'
  ↓
Vite (bundles into single CSS file during build)
```

**Important:** Maintain this import order to ensure CSS specificity works correctly (base → components → layouts → tables → pages → modals).

## CSS Variables (Design Tokens)

All design tokens are defined in `base.css` using CSS custom properties:

```css
:root {
  --md-primary: #1976d2;           /* Primary action color */
  --md-primary-hover: #1565c0;     /* Primary hover state */
  --md-error: #d32f2f;             /* Error/danger color */
  --md-background: #f5f5f5;        /* Page background */
  --md-surface: #ffffff;           /* Card/panel background */
  --md-text-primary: #212121;      /* Main text color */
  --md-text-secondary: #757575;    /* Secondary text color */
  --md-border: #e0e0e0;            /* Border color */
  --md-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);  /* Elevation shadow */
  --md-radius: 8px;                /* Border radius */
}
```

**Use these variables instead of hardcoding colors.** This ensures consistency and makes theme updates easy.

## Responsive Breakpoints

The architecture uses mobile-first CSS with breakpoints at:

- **720px** — Small tablets/large phones
- **900px** — Tablets
- **1200px** — Large layouts (observing-layout only)

Each module manages its own responsive rules for its components. Look for `@media` queries within each file.

## Best Practices

### 1. **Choose the Right Module**
Before adding CSS, determine which module it belongs in:
- Does it depend on other components? → `components.css`
- Does it arrange components on a page? → `layouts.css`
- Is it data-table specific? → `tables.css`
- Is it page/feature specific? → `pages.css`
- Is it a modal/overlay? → `modals.css`
- Is it global or a design token? → `base.css`

### 2. **Reuse Variables**
Always use CSS custom properties for colors, shadows, and spacing:
```css
/* ✅ Good */
.my-component {
  background: var(--md-surface);
  box-shadow: var(--md-shadow);
  border-radius: var(--md-radius);
}

/* ❌ Avoid */
.my-component {
  background: #ffffff;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
  border-radius: 8px;
}
```

### 3. **Keep Components Self-Contained**
Components in `components.css` should not assume specific page layouts. They should work anywhere.

```css
/* ✅ Good - self-contained */
.card {
  background: var(--md-surface);
  border-radius: var(--md-radius);
  padding: 32px;
}

/* ❌ Avoid - layout-dependent */
.card {
  position: absolute;
  top: 50%;
  left: 50%;
}
```

### 4. **Organize Responsive Rules Together**
Keep all responsive rules for a component near the base styles, not scattered:

```css
.my-component {
  display: grid;
  grid-template-columns: 2fr 1fr;
}

@media (max-width: 900px) {
  .my-component {
    grid-template-columns: 1fr;
  }
}
```

### 5. **Use Semantic Class Names**
Class names should describe what they are, not how they look:

```css
/* ✅ Good */
.goal-selection-card
.student-avatar
.overview-table

/* ❌ Avoid */
.blue-box
.big-text
.grid-2-col
```

## Adding New Features

When adding new feature styling:

1. **Identify the component type** — Is it a new component, layout, or page feature?
2. **Choose the appropriate module** — Refer to the table above
3. **Follow the existing pattern** — Use the same naming conventions and structure
4. **Use design tokens** — Reference CSS variables instead of hardcoding values
5. **Add responsive rules** — Include rules for all relevant breakpoints
6. **Test the build** — Run `npm run build` to verify no CSS is lost

Example: Adding a new card variant:

```css
/* In components.css */
.card {
  background: var(--md-surface);
  /* ... existing styles ... */
}

.card-elevated {
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);  /* stronger shadow */
}

@media (max-width: 720px) {
  .card {
    padding: 20px;
  }
}
```

## Debugging & Maintenance

### Finding Styles
If you need to modify a component:
1. Search for the class name in `src/styles/` (use your IDE's search)
2. The file it's in tells you the module responsibility
3. Modify the CSS and test with `npm run build`

### Bundle Size
The CSS is automatically minified by Vite during build. Check the production size:
```bash
npm run build
# Output: dist/assets/index-*.css (22.83 kB gzip)
```

### Visual Testing
After any CSS changes:
1. Run `npm run dev` to start the dev server
2. Visually inspect all affected pages
3. Test responsive behavior at all breakpoints
4. Run `npm run build` to verify production build works

## Migration from Monolithic CSS

**Already completed!** The original `index.css` (1742 lines) has been split into 6 modules. The backup is available as `index.css.bak` if needed for reference.

- ✅ All CSS preserved exactly (same visual appearance)
- ✅ No React component changes required
- ✅ Build size unchanged (Vite bundles imports automatically)
- ✅ No breaking changes

## Future Improvements

Possible enhancements as the project grows:

- **CSS Preprocessing:** Consider Sass/SCSS for variables and mixins
- **CSS-in-JS:** Evaluate styled-components if component styles become complex
- **Design System:** Extract components into shared UI library
- **Theming:** Implement CSS custom properties for light/dark themes
- **Utility-first:** Consider Tailwind CSS for faster prototyping

---

**Last Updated:** July 1, 2026  
**Architecture:** 6-module modular CSS  
**Total Size:** ~28 KB (27.7 KB minified, 4.47 KB gzip)
