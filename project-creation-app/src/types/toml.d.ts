// Type declarations for toml module
declare module 'toml' {
  export function parse(input: string): unknown;
}

// Type declarations for .toml?raw imports (Vite raw imports)
declare module '*.toml?raw' {
  const content: string;
  export default content;
}
