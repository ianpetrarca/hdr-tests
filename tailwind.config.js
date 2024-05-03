module.exports = {
  content: ['./src/**/*.{html,js}'],
  darkMode: 'class',
  theme: {
    extend: {
      maxWidth: {
        'sidemenu-mobile': '4rem',
        'sidemenu-small': '16.5rem'
      },
      maxHeight: {
        'screen-3/4': '90vh',
        '112': '40rem',
        '120': '42rem',
        '128': '50rem',
        '30': '7.5rem'
      },
      width: {
        '26': '6.5rem',
        'w-6/7': '85.714285714%',
        'w-1/7': '14.2857142857%',
        'w-1/8': '12.5%',
        '128': '45rem',
      },
      height:{
        'screen-1/4': '25vh',
        'screen-1/2': '50vh',
        'screen-3/4': '90vh',
        'screen-full': '100vh',
        '18': '4.5rem',
        "120": '28rem',
        "128": '32rem',      
      },
      margin:{
        '18': '4.5rem'
      },
      opacity: {
        '85': '.85',
      },
      colors: {
        'foveate-black-2':'rgba(25,25,25,.75)',
        'foveate-black':'#191919',
        'foveate-blue':'#0088FF',
        'foveate-blue-transparent':'rgba(0, 136, 255,.2)',
        'foveate-teal':'#00EDE6',
        'foveate-white':'#6B7280',
        'foveate-gray-dark':'#6B7280',
        'foveate-gray-light':'#9CA3AF',
        'foveate-green':'#00EE6F',
        'foveate-accent-teal':'#12F4EE',
        'foveate-accent-green':'#00EE6F',
        'foveate-accent-green-transparent':'rgba(0, 238, 111,.1)',
        'foveate-accent-blue-light':'#0088FF',
        'foveate-accent-blue-dark':'#0035EF',
        'foveate-accent-purple-light':'#9A58FF'
      }
    },
    screens: {
      'xs': '400px',
      'sm': '640px',
      'md': '720px',
      'transport': '1100px',
      'lg': '1100px',
      'xl': '1440px',
      '2xl': '1536px',
      '3xl': '1736px',
      '4xl': '1900px',
      '5xl': '2000px',
      '6xl': '2100px',
      '7xl': '2400px',
    },
    fontSize: {
      xxxs: '0.65rem',
      xxs: '0.7rem',
      xxms: '0.725rem',
      xs: '0.75rem',
      sm: '0.8rem',
      smd: '0.85rem',
      smlg: '0.9rem',
      base: '1rem',
      xl: '1.25rem',
      '2xl': '1.563rem',
      '3xl': '1.953rem',
      '4xl': '2.441rem',
      '5xl': '3.052rem',
      '6xl': '3.25rem',
    },
    minHeight: {
      'assets': '20rem',
    },
    maxHeight: {
      '1/2': '50%',
      'full': '100%'
    }
  },
  variants: {
    extend: {},
  },
  plugins: [
    require('@tailwindcss/forms'),
    require('@tailwindcss/typography'),
    require('@tailwindcss/aspect-ratio')
  ],
}
