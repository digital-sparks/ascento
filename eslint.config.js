import finsweetConfigs from '@finsweet/eslint-config';

export default [
  ...finsweetConfigs,
  {
    languageOptions: {
      globals: {
        window: 'readonly',
        document: 'readonly',
        console: 'readonly',
        fetch: 'readonly',
        FormData: 'readonly',
        CSS: 'readonly',
        HTMLInputElement: 'readonly',
        HTMLSelectElement: 'readonly',
        HTMLTextAreaElement: 'readonly',
        HTMLElement: 'readonly',
        MutationObserver: 'readonly',
        setTimeout: 'readonly',
      },
    },
  },
];
