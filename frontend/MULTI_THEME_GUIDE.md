# Multi-Theme System & Responsive Design Guide

## Overview

ObsApp now features:
1. **5 Built-in Color Themes** - Teachers can switch themes instantly
2. **Full Responsive Design** - Optimized for smartphone, tablet, and laptop
3. **Theme Persistence** - Selected theme is saved to browser localStorage
4. **Modern Menu Styling** - Updated navigation for all devices
5. **Distinct Student Avatars** - Each student gets a unique solid color

## Available Themes

### 1. Modern Teal (Default)
- **Primary:** #10a878 (Teal)
- **Use Case:** Education/growth focused, modern, professional
- **Best For:** General use, preschools

### 2. Ocean Blue
- **Primary:** #0369a1 (Sky Blue)
- **Use Case:** Calm, professional, trustworthy
- **Best For:** Formal institutions, corporate schools

### 3. Forest Green
- **Primary:** #047857 (Deep Green)
- **Use Case:** Natural, nurturing, sustainable
- **Best For:** Montessori, nature-based schools

### 4. Warm Sunset
- **Primary:** #d97706 (Golden Amber)
- **Use Case:** Warm, energetic, inviting
- **Best For:** Playful, creative preschools

### 5. Professional Purple
- **Primary:** #7c3aed (Purple)
- **Use Case:** Sophisticated, creative, inspiring
- **Best For:** Progressive, arts-focused institutions

## How Themes Work

### CSS Variables System
All themes use CSS custom properties (variables) that change based on the selected theme:

```css
:root {
  --md-primary: #10a878;        /* Default (Teal) */
}

[data-theme="ocean"] {
  --md-primary: #0369a1;        /* Ocean Blue */
}

[data-theme="forest"] {
  --md-primary: #047857;        /* Forest Green */
}
```

Every element uses `var(--md-primary)` instead of hardcoded colors, making theme switching instant and consistent.

### Theme Switching with localStorage
When a user selects a theme:
1. Theme is applied immediately via `data-theme` attribute on `<html>`
2. Theme preference is saved to browser's localStorage
3. Next time user visits, their chosen theme loads automatically

## Using the Theme Hook

### In React Components
```typescript
import { useTheme } from '../hooks/useTheme'

function MyComponent() {
  const { theme, setTheme, availableThemes } = useTheme()

  return (
    <button onClick={() => setTheme('ocean')}>
      Switch to Ocean Blue
    </button>
  )
}
```

### Theme Hook API
```typescript
const {
  theme,              // Current theme: 'teal' | 'ocean' | 'forest' | 'sunset' | 'purple'
  setTheme,           // Function to change theme
  getCurrentTheme,    // Function to get full theme object
  availableThemes,    // Array of all available themes
} = useTheme()
```

## Adding Theme Selector to Menu

### In AppLayout.tsx
```typescript
import { ThemeSelector } from './ThemeSelector'

// Add to drawer content:
<Divider />
<ThemeSelector />
```

The `ThemeSelector` component is pre-built and styled, with 5 theme buttons.

## Responsive Design

### Device Breakpoints
```
Mobile:   0px - 720px     (smartphone)
Tablet:   720px - 900px   (portrait/landscape)
Desktop:  900px+          (laptop/large screens)
```

### What Changes at Each Breakpoint

#### Mobile (≤720px)
- Single column layouts
- Larger touch targets (44px buttons)
- Hamburger menu with full-width drawer
- Simplified forms (1 column)
- Bottom navigation optional
- Padding: 12-16px

#### Tablet (721px - 900px)
- Two-column layouts
- Better spacing
- Side drawer remains visible (smaller)
- Optimized for landscape/portrait
- Touch-friendly spacing maintained
- Padding: 16-20px

#### Desktop (≥900px)
- Multi-column layouts
- Full feature density
- Side drawer fully visible
- Form layouts optimized (3 columns)
- Maximum content width
- Generous spacing and padding

### Key Responsive Features

#### Navigation
- **Mobile:** Hamburger menu → full-width drawer
- **Tablet:** Compact drawer + content
- **Desktop:** Full drawer + content side-by-side

#### Forms
- **Mobile:** Single column with full-width inputs
- **Tablet:** Two columns where possible
- **Desktop:** Three columns for multi-field forms

#### Tables
- **Mobile:** Horizontal scroll, stacked headers
- **Tablet:** Optimized for both orientations
- **Desktop:** Full table display with all columns

#### Spacing
- **Mobile:** Reduced padding (16-18px)
- **Tablet:** Standard padding (20-24px)
- **Desktop:** Generous padding (24-32px)

#### Typography
- **Mobile:** 14-15px base font
- **Tablet:** 15px base font
- **Desktop:** 15px base font (readability optimized)

## Component Styling

### Student Avatars
- **Before:** Gradient backgrounds (teal→purple)
- **Now:** Distinct solid colors per student
- **How:** `StudentAvatar.tsx` uses hash-based color assignment
- **Colors:** 12 distinct, education-appropriate colors

### Menu/Navigation
- **Active state:** Left border + highlight
- **Hover state:** Color transition + subtle transform
- **Submenu:** Indented with smaller font
- **Theme buttons:** Clearly visible, all devices

### Buttons
- **Mobile:** 44px height for touch targets
- **Tablet:** 40px height
- **Desktop:** 36-40px height
- **Hover:** Lift effect + enhanced shadow
- **All devices:** Full-width on mobile, auto-width on desktop

### Cards
- **Mobile:** Full width with 16px padding
- **Tablet:** Multi-column with gaps
- **Desktop:** Optimized grid with max-widths
- **All devices:** Elevated on hover

## Testing Responsive Design

### In Browser DevTools
```
1. Open DevTools (F12)
2. Click Device Toggle (Ctrl+Shift+M)
3. Test at different screen sizes:
   - 375px (iPhone)
   - 768px (iPad)
   - 1024px (Desktop)
```

### Testing Themes
```
1. Open Console
2. Run: document.documentElement.setAttribute('data-theme', 'ocean')
3. Observe instant theme change
4. Or use the ThemeSelector component in-app
```

## Customization

### Adding a New Theme

**Step 1: Add theme colors to `themes.css`**
```css
[data-theme="custom"] {
  --theme-name: 'Custom Theme';
  --md-primary: #your-color;
  --md-primary-hover: #darker-shade;
  --md-primary-light: #lighter-shade;
  --md-secondary: #your-secondary;
  --md-accent: #your-accent;
}
```

**Step 2: Add to `useTheme.ts` constants**
```typescript
export type ThemeName = 'teal' | 'ocean' | 'forest' | 'sunset' | 'purple' | 'custom'

export const AVAILABLE_THEMES: Theme[] = [
  // ... existing themes ...
  {
    id: 'custom',
    name: 'Custom Theme',
    colors: { primary: '#your-color' },
  },
]
```

### Adjusting Responsive Breakpoints

Edit `layouts.css` and `menu.css`:
```css
@media (max-width: 800px) {  /* Change from 720px */
  /* Mobile styles */
}
```

### Changing Default Theme

In `useTheme.ts`:
```typescript
const DEFAULT_THEME: ThemeName = 'ocean'  // Change from 'teal'
```

## Performance

### Theme Switching
- **Time to apply:** <1ms (CSS variables change)
- **No page reload needed**
- **Smooth transitions:** All color changes have 0.3s transition

### CSS File Size
- **Total CSS:** 36.21 kB (minified)
- **Gzip:** 6.48 kB
- **Impact:** +6 kB from flat design for theme system

### Responsive
- **Mobile first:** Smaller downloads on mobile
- **Media queries:** Only necessary styles loaded per device
- **No JavaScript overhead:** Pure CSS for all breakpoints

## Browser Support

✅ All modern browsers:
- Chrome 90+
- Firefox 88+
- Safari 14+
- Edge 90+
- iOS Safari 14+
- Android Chrome

**CSS Features Used:**
- CSS Custom Properties (Variables)
- Media Queries
- Flexbox & Grid
- CSS Transitions
- CSS Gradients

## Files Created/Modified

### New Files
- `/src/hooks/useTheme.ts` - Theme management hook
- `/src/components/ThemeSelector.tsx` - Theme switcher UI
- `/src/styles/themes.css` - All 5 theme definitions
- `/src/styles/menu.css` - Modern menu styling

### Modified Files
- `/src/styles/base.css` - Imports themes.css
- `/src/styles/components.css` - Removed gradients from avatars
- `/src/styles/layouts.css` - Removed gradients from student avatars
- `/src/index.css` - Added menu.css import

### Documentation
- This file - Complete multi-theme & responsive guide

## Best Practices

### For Teachers
1. **Choose a theme** that matches your school's branding
2. **Test on mobile** before sharing with parents
3. **Use consistent theme** across all staff devices
4. **Explain colors** to students (optional)

### For Developers
1. **Use CSS variables** instead of hardcoding colors
2. **Test all themes** when making design changes
3. **Test all breakpoints** when adding layouts
4. **Keep avatars distinct** (don't use gradients)
5. **Maintain theme consistency** across modules

## Future Enhancements

Possible next steps:
- [ ] Dark mode variants for each theme
- [ ] Custom color picker for school branding
- [ ] Per-user theme preference (synced with server)
- [ ] Seasonal themes (holidays, seasons)
- [ ] High contrast mode for accessibility
- [ ] Theme preview before applying

## Troubleshooting

### Theme not changing?
- Check browser console for errors
- Verify localStorage is enabled
- Try hardrefresh (Ctrl+Shift+R)
- Clear browser cache

### Responsive not working?
- Check viewport meta tag in index.html
- Verify media queries in CSS
- Test in DevTools device mode
- Check for conflicting CSS

### Avatar colors not showing?
- Verify StudentAvatar.tsx component
- Check avatarColors array is properly defined
- Ensure student data is loading
- Test with different student names

---

**Version:** 2.1 (Multi-theme & Responsive)  
**Updated:** July 1, 2026  
**Target:** Smartphone, Tablet, Laptop  
**Teachers:** Can now choose 5 professional color themes!
