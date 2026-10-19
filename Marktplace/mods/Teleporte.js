api.register({
  id: 'teleporte-coordenadas',
  name: 'Teleporte',
  version: '1.0.0',
  description: 'Move o jogador para coordenadas X, Y e Z.',
  settings: [
    { id: 'x', label: 'X', type: 'number', default: 0, min: -1000, max: 1000, step: 1 },
    { id: 'y', label: 'Y', type: 'number', default: 2, min: -1000, max: 1000, step: 1 },
    { id: 'z', label: 'Z', type: 'number', default: 0, min: -1000, max: 1000, step: 1 },
    { id: 'teleportar', label: 'Teleportar', type: 'button' }
  ],
  onAction(action, settings, api) {
    if (action === 'teleportar') api.teleport(Number(settings.x), Number(settings.y), Number(settings.z));
  }
});
