/**
 * Vite's `?raw` suffix imports a file's contents as a string. The test setup uses it to load the
 * SQL migrations that build the in-memory D1 schema, so the type must be declared explicitly -
 * TypeScript has no knowledge of Vite's import suffixes.
 */
declare module '*.sql?raw' {
  const contents: string
  export default contents
}
