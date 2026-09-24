// Vite `?raw` imports (used by tests to read committed ops files as text inside the workers pool).
declare module '*?raw' {
  const text: string
  export default text
}
