api.register({
  id: 'voo-livre',
  name: 'Voo Livre',
  version: '1.0.0',
  description: 'Ative o voo e atravesse paredes. Espaço sobe e Shift desce.',
  settings: [
    { id: 'voar', label: 'Voar', type: 'toggle', default: false },
    { id: 'noclip', label: 'Atravessar paredes', type: 'toggle', default: false },
    { id: 'velocidade', label: 'Velocidade (1–10)', type: 'number', default: 1, min: 1, max: 10, step: 1 }
  ],
  onChange(settings, api) {
    api.setMovement({ fly: settings.voar, noclip: settings.noclip, speed: settings.velocidade });
  }
});
