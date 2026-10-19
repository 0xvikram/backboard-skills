// errors.md #2 is the one-line `const nextConfig: NextConfig = ...` fix from recipes.md #2, without its import.
// This gives it the same type, so the fragment is still checked against Next's types.
declare global {
  type NextConfig = import('next').NextConfig;
}
export {};
