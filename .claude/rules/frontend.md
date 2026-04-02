---
paths:
  - "*.js"
  - "*.css"
  - "*.html"
---

# Frontend

## Design Tokens

This project uses CSS custom properties defined in `:root` in `style.css`. Use existing variables (`--bg`, `--card`, `--text`, `--blue`, `--radius`, etc.) — never hardcode raw color/spacing values.

## Component Framework

- **CSS**: Vanilla CSS with custom properties (no Tailwind, no preprocessors)
- **JS**: Vanilla JavaScript (no framework, no build step)
- **Icons**: Emoji-based icons in the UI

## Layout

- CSS Grid for 2D, Flexbox for 1D. Use `gap`, not margin hacks.
- Mobile-first. Touch targets: minimum 44x44px.

## Accessibility (non-negotiable)

- All interactive elements keyboard-accessible.
- Form inputs: associated `<label>` or `aria-label`.
- Contrast: 4.5:1 normal text, 3:1 large text.
- Visible focus indicators. Never `outline: none` without replacement.
- Color never the sole indicator.

## Performance

- Images: `loading="lazy"` below fold, explicit `width`/`height`.
- Animations: `transform` and `opacity` only.
- Large lists: virtualize at 100+ items.
