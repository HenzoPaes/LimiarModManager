# Limiar Mod Marketplace

Este diretório é um repositório local pronto para ser publicado como um repositório público no GitHub. O Limiar Mod Manager procura arquivos `.js`, `.html` e `.htm` dentro de `mods/`.

## Publicar e conectar

1. Crie um repositório público no GitHub e envie o conteúdo desta pasta.
2. Mantenha os mods na pasta `mods/`.
3. No Mod Manager, informe `https://github.com/USUARIO/REPOSITORIO` e selecione **Buscar mods no GitHub**.
4. O marketplace lista os scripts encontrados; cada mod precisa registrar sua configuração com `api.register(...)`.

O carregamento é feito pela API pública do GitHub e por `raw.githubusercontent.com`. Não é necessário token para repositórios públicos. Este workspace não está conectado nem publicado em um repositório remoto.

## Mods de exemplo

- `Cheats.js`: voo, atravessar paredes, velocidade 10x, teleporte por coordenadas, teleporte para a parte 2 do jogo e desempenho máximo.
- `PortalGun.js`: arma de portais em objetos 3D (azul e laranja) com visão em tempo real através dos portais e teleporte. Dispare um projétil de energia: o portal abre onde ele acertar a parede. No PC, clique esquerdo/direito com a mira travada; no celular, botões redondos na lateral direita.
- `VooLivre.js`: controles independentes de voo, noclip e velocidade.
- `HotbarAPI.js`: API pra colocar itens numa hotbar no pé da tela (teclas 1-8/toque, botão USAR).
- `VeicAPI.js`: API pra criar veículos dirigíveis com entrada/saída, sons e botões de toque.
- `Pistol.js`: pistola pronta (item da HotbarAPI) que derruba os monstros com 3 tiros.
- `Bazuka.js`: bazuka destrutiva (item da HotbarAPI): foguete ultrarrápido que abre buracos reais nas paredes — remove a colisão e deforma a geometria do mundo na explosão, derrubando destroços com física, scorch na parede, flash, bola de fogo, onda de choque, fumaça, faíscas e boom pesado.
- `Skate.js`: skate dirigível (VeicAPI + HotbarAPI), com sons de rodinha.
- `Terror10x.js`: escuridão pesada que falha e treme, vinheta opressiva e sons do pesadelo (coração, sussurros, respiros, gritos). Uma criatura alta de olhos brancos espreite qualquer lugar e, no campo da árvore (parte 2), caça o jogador de verdade.
- `Teleporte.js`: teleporte por coordenadas.
- `DesempenhoMaximo.js`: alterna as configurações de desempenho máximo.

Revise o código de terceiros antes de instalar: um mod executa JavaScript dentro do jogo.
