api.register({
  id: 'desempenho-maximo',
  name: 'Desempenho MAX',
  version: '1.0.0',
  description: 'Prioriza desempenho com configurações gráficas mínimas.',
  settings: [
    { id: 'ativar', label: 'Ativar desempenho máximo', type: 'toggle', default: false }
  ],
  onChange(settings, api) {
    api.setPerformanceMax(settings.ativar);
  }
});
