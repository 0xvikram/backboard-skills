// Harness: a second root layout (route group) for the wagmi recipes, so the plain quickstart PrivyProvider and the
// wagmi one (recipes.md #5) are never nested (errors.md #5). Providers is the recipe's own block.
import Providers from './providers';

export default function RecipesLayout({children}: {children: React.ReactNode}) {
  return (
    <html lang="en">
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
