import { defineConfig } from 'vite';

export default defineConfig({
  root: 'app',
  // Chemins relatifs : la page est servie depuis un sous-chemin sur GitHub
  // Pages (/assemblages-ec3/), pas depuis la racine d'un domaine.
  base: './',
  build: {
    outDir: '../docs',
    emptyOutDir: false,
  },
  // Vitest reutilise ce fichier : sans ce champ, le `root: 'app'` ci-dessus
  // s'appliquerait aussi aux tests, qui vivent hors de `app/`.
  test: {
    root: '.',
    exclude: ['**/node_modules/**', '**/dist/**', '.worktrees/**'],
  },
});
