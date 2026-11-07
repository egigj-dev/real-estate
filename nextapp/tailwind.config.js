/** @type {import('tailwindcss').Config} */
const token = (name) => `rgb(var(--${name}) / <alpha-value>)`

module.exports = {
  darkMode: ['selector', '[data-theme="dark"]'],
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}', './lib/**/*.{ts,tsx}'],
  theme: {
    container: { center: true, padding: { DEFAULT: '1rem', sm: '1.5rem', lg: '2rem' }, screens: { '2xl': '1280px' } },
    extend: {
      colors: {
        canvas: token('canvas'),
        surface: { DEFAULT: token('surface'), sunken: token('surface-sunken') },
        ink: { DEFAULT: token('ink'), muted: token('ink-muted'), subtle: token('ink-subtle') },
        line: { DEFAULT: token('line'), strong: token('line-strong') },
        primary: { DEFAULT: token('primary'), hover: token('primary-hover'), soft: token('primary-soft'), contrast: token('primary-contrast') },
        brass: { DEFAULT: token('brass'), ink: token('brass-ink'), soft: token('brass-soft') },
        above: { DEFAULT: token('above'), soft: token('above-soft') },
        below: { DEFAULT: token('below'), soft: token('below-soft') },
        danger: { DEFAULT: token('danger'), soft: token('danger-soft') },
        focus: token('focus'),
        ramp: {
          0: token('ramp-0'), 1: token('ramp-1'), 2: token('ramp-2'),
          3: token('ramp-3'), 4: token('ramp-4'), 5: token('ramp-5'),
        },
      },
      fontFamily: {
        sans: ['var(--font-sans)', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        serif: ['var(--font-serif)', 'Georgia', 'serif'],
      },
      fontSize: {
        // Interface scale. Display sizes are used only for page titles and key figures.
        xs: ['0.75rem', { lineHeight: '1.1rem' }],
        sm: ['0.875rem', { lineHeight: '1.35rem' }],
        base: ['1rem', { lineHeight: '1.6rem' }],
        lg: ['1.125rem', { lineHeight: '1.65rem' }],
        xl: ['1.375rem', { lineHeight: '1.8rem' }],
        '2xl': ['1.75rem', { lineHeight: '2.15rem', letterSpacing: '-0.01em' }],
        '3xl': ['2.25rem', { lineHeight: '2.6rem', letterSpacing: '-0.015em' }],
        '4xl': ['2.875rem', { lineHeight: '3.15rem', letterSpacing: '-0.02em' }],
      },
      borderRadius: { sm: '4px', DEFAULT: '6px', md: '6px', lg: '8px', xl: '10px' },
      boxShadow: {
        // Borders carry most separation; shadow is reserved for overlays.
        overlay: '0 1px 2px rgb(20 24 21 / 0.06), 0 8px 24px rgb(20 24 21 / 0.10)',
      },
      maxWidth: { prose: '68ch' },
    },
  },
  plugins: [],
}
