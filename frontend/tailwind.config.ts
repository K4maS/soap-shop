import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './index.html',
    './src/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        // === Mylo Master Brand Palette ===

        // Primary — warm beige / cream
        beige: {
          50:  '#fdf8f0',
          100: '#faf0e0',
          200: '#f5e0c0',
          300: '#eecfa0',
          400: '#e4b87a',
          500: '#d9a05a',
          600: '#c4863f',
          700: '#a36a2e',
          800: '#7d4f21',
          900: '#5a3516',
          950: '#3a1f0a',
        },

        // Secondary — sage green
        sage: {
          50:  '#f3f7f0',
          100: '#e4eedf',
          200: '#c9ddbf',
          300: '#a8c89a',
          400: '#84af73',
          500: '#659552',
          600: '#4e7940',
          700: '#3c5f31',
          800: '#2d4725',
          900: '#1f301a',
          950: '#111d0f',
        },

        // Accent — soft rose
        rose: {
          50:  '#fff1f2',
          100: '#ffe0e2',
          200: '#ffc6ca',
          300: '#ffa0a7',
          400: '#ff6e78',
          500: '#f94050',
          600: '#e7192c',
          700: '#c21022',
          800: '#9f1122',
          900: '#841222',
          950: '#49040d',
        },

        // Neutral — warm white / off-white
        cream: {
          50:  '#fffef9',
          100: '#fffcf0',
          200: '#fff7dc',
          300: '#ffefc0',
          400: '#ffe49a',
          500: '#ffd56e',
          600: '#f5b800',
          700: '#c48e00',
          800: '#936800',
          900: '#634600',
          950: '#3d2b00',
        },

        // Neutral grays with warm tint
        warm: {
          50:  '#faf9f7',
          100: '#f5f3ef',
          200: '#ece8e0',
          300: '#ddd8cc',
          400: '#c9c1b0',
          500: '#b0a794',
          600: '#928977',
          700: '#726b5e',
          800: '#524d44',
          900: '#34302b',
          950: '#1c1a17',
        },
      },

      fontFamily: {
        sans: [
          'Inter',
          'ui-sans-serif',
          'system-ui',
          '-apple-system',
          'BlinkMacSystemFont',
          '"Segoe UI"',
          'sans-serif',
        ],
        serif: [
          '"Playfair Display"',
          'Georgia',
          'ui-serif',
          'serif',
        ],
        mono: [
          '"JetBrains Mono"',
          '"Fira Code"',
          'ui-monospace',
          'monospace',
        ],
      },

      fontSize: {
        '2xs': ['0.625rem', { lineHeight: '0.875rem' }],
      },

      spacing: {
        '18': '4.5rem',
        '88': '22rem',
        '112': '28rem',
        '128': '32rem',
      },

      borderRadius: {
        '4xl': '2rem',
        '5xl': '2.5rem',
      },

      boxShadow: {
        'soft': '0 2px 15px -3px rgba(0,0,0,0.07), 0 10px 20px -2px rgba(0,0,0,0.04)',
        'card': '0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04)',
        'card-hover': '0 10px 25px -5px rgba(0,0,0,0.1), 0 4px 6px -2px rgba(0,0,0,0.05)',
        'inner-soft': 'inset 0 2px 4px 0 rgba(0,0,0,0.04)',
      },

      animation: {
        'fade-in': 'fadeIn 0.3s ease-out',
        'slide-up': 'slideUp 0.3s ease-out',
        'slide-down': 'slideDown 0.3s ease-out',
        'scale-in': 'scaleIn 0.2s ease-out',
        'spin-slow': 'spin 3s linear infinite',
        'pulse-soft': 'pulseSoft 2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
      },

      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { opacity: '0', transform: 'translateY(16px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        slideDown: {
          '0%': { opacity: '0', transform: 'translateY(-16px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        scaleIn: {
          '0%': { opacity: '0', transform: 'scale(0.95)' },
          '100%': { opacity: '1', transform: 'scale(1)' },
        },
        pulseSoft: {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.5' },
        },
      },

      transitionTimingFunction: {
        'spring': 'cubic-bezier(0.175, 0.885, 0.32, 1.275)',
        'smooth': 'cubic-bezier(0.4, 0, 0.2, 1)',
      },

      backgroundImage: {
        'gradient-brand': 'linear-gradient(135deg, #fdf8f0 0%, #f3f7f0 100%)',
        'gradient-hero': 'linear-gradient(135deg, #faf0e0 0%, #e4eedf 50%, #fff1f2 100%)',
        'gradient-card': 'linear-gradient(180deg, transparent 60%, rgba(0,0,0,0.5) 100%)',
      },
    },
  },
  plugins: [],
  // Safelist classes used dynamically (e.g., badge status colors)
  safelist: [
    { pattern: /^(bg|text|border)-(sage|beige|rose|cream|warm)-\d{2,3}$/ },
    { pattern: /^(bg|text)-(green|yellow|red|blue|gray)-\d{2,3}$/ },
  ],
};

export default config;
