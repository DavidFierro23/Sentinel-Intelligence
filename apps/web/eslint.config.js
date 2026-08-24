import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{js,jsx}'],
    extends: [
      js.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      globals: globals.browser,
      parserOptions: { ecmaFeatures: { jsx: true } },
    },
  },
  {
    /*
      `tests/` y las configs de Vite corren en NODE, no en el
      navegador: usan `process`, `console` y las APIs de fichero.

      Sin este bloque, `npm run lint` falla con «'process' is not
      defined» sobre codigo que es correcto. Es un ajuste de
      entorno, no una excepcion a ninguna regla: las demas siguen
      aplicandose igual a estos archivos.
    */
    files: ['tests/**/*.{js,jsx}', 'vite.*.config.js'],
    languageOptions: {
      globals: { ...globals.node },
    },
  },
])
