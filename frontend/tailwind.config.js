/** @type {import('tailwindcss').Config} */
export default {
    content: [
        "./index.html",
        "./src/**/*.{js,ts,jsx,tsx}",
    ],
    theme: {
        extend: {
            colors: {
                primary: '#3674B5',
                secondary: '#578FCA',
                accent: '#A1E3F9',
                background: '#FAF3E1',
            }
        },
    },
    plugins: [
        require('@tailwindcss/typography'),
    ],
}
