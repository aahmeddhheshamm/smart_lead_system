const colors = {
  white: "rgba(var(--white))",
  black: "rgba(var(--black))",
  primary: {
    700: "rgba(var(--primary-700))",
    600: "rgba(var(--primary-600))",
    500: "rgba(var(--primary-500))",
    400: "rgba(var(--primary-400))",
    300: "rgba(var(--primary-300))",
    200: "rgba(var(--primary-200))",
    100: "rgba(var(--primary-100))",
    50: "rgba(var(--primary-50))",
    20: "rgba(var(--primary-20))",
  },
  neural: {
    500: "rgba(var(--neural-500))",
    400: "rgba(var(--neural-400))",
    300: "rgba(var(--neural-300))",
    200: "rgba(var(--neural-200))",
    100: "rgba(var(--neural-100))",
  },
  gray: {
    100: "rgba(var(--gray-100))",
    300: "rgba(var(--gray-300))",
    200: "rgba(var(--gray-200))",
    500: "rgba(var(--gray-500))",
    700: "rgba(var(--gray-700))",
    800: "rgba(var(--gray-800))",
  },
  brand: {
    navy: "rgba(var(--brand-navy))",
    cyan: "rgba(var(--brand-cyan))",
    sky: "rgba(var(--brand-sky))",
    blue: "rgba(var(--brand-blue))",
    indigo: "rgba(var(--brand-indigo))",
    violet: "rgba(var(--brand-violet))",
  },
  heading: "rgba(var(--heading))",
  line: "rgba(var(--line))",
  tableHeader: "rgba(var(--table-header))",
  dashboardBg: "rgba(var(--dashboardBg))",
  errors: {
    100: '#ba1a1a',
    200: '#CF3030',
    400: "#F85A40",
    300:"#CE3636"

  },
  status: {
    inProgress: '#E6A519',
    pending: '#FF7733',
    return: "#B80FEB",
    bgActive: "#E8F4EC",
    active: "#1C903D",
    success: "#01A66F",
    failed: "#F5000A",
    bgBlocked: "#FCE8E8",
    blocked: "#E61919",

  },
}
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx,vue}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors,
      // the logo's cyan -> blue -> violet sweep
      backgroundImage: {
        'brand-gradient': 'linear-gradient(135deg, rgb(var(--brand-cyan)) 0%, rgb(var(--brand-blue)) 50%, rgb(var(--brand-violet)) 100%)',
      },
      borderRadius: {
        DEFAULT: '5px',
      },
      container: {
        center: true,
        padding: {
          "2xl": "7.436rem",
        },
      },
      fontFamily: {
        Roboto: ['Roboto', 'Cairo', 'sans-serif'],
        Lexend: ['Lexend', 'sans-serif'],
        Cairo: ['Cairo', 'sans-serif']
      }
    }
  },
  plugins: []
}
