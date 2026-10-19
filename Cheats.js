api.register({
  id: 'cheats',
  name: 'Cheats',
  version: '1.0.0',
  description: 'Voo, atravessar paredes, velocidade 10x, teleporte e desempenho máximo.',
  settings: [
    { id: 'fly', label: 'Voar (WASD + Espaço/Shift)', type: 'toggle', default: false },
    { id: 'noclip', label: 'Atravessar paredes', type: 'toggle', default: false },
    { id: 'speed10', label: 'Velocidade 10x', type: 'toggle', default: false },
    { id: 'performance', label: 'Desempenho MAX (gráficos mínimos)', type: 'toggle', default: false },
    { id: 'teleX', label: 'Teleporte — X', type: 'number', default: 0, min: -1000, max: 1000, step: 1 },
    { id: 'teleY', label: 'Teleporte — Y', type: 'number', default: 2, min: -1000, max: 1000, step: 1 },
    { id: 'teleZ', label: 'Teleporte — Z', type: 'number', default: 0, min: -1000, max: 1000, step: 1 },
    { id: 'teleport', label: 'Teleportar para as coordenadas', type: 'button' }
  ],
  onChange(settings, api) {
    api.setMovement({ fly: settings.fly, noclip: settings.noclip, speed: settings.speed10 ? 10 : 1 });
    api.setPerformanceMax(settings.performance);
  },
  onAction(action, settings, api) {
    if (action === 'teleport') api.teleport(Number(settings.teleX), Number(settings.teleY), Number(settings.teleZ));
  }
});
