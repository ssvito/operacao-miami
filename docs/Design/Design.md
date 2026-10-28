# Design

Parte de [Operação Miami](../Operacao%20Miami.md).

## Tom

Charge de jornal em forma de jogo. O humor é de **situação** - imprensa, burocracia, assessores trapalhões, apoiador querendo selfie - e não de acusação. Tela inicial deixa claro que é paródia e ficção. Nenhum processo ou acusação específica aparece como fato.

## Premissa

O personagem decide que "tá na hora de umas férias longas" e precisa ir de Brasília até Miami sem virar manchete.

## Fases (rascunho)

1. **Gabinete em Brasília** - stealth: sair do Senado sem ser visto por repórteres (pilastras, caixas de "documentos importantes", comitivas).
2. **Rio de Janeiro** - runner na orla: ambulantes, ciclistas, carro de som com jingle.
3. **Aeroporto** - minigame de burocracia: fila, raio-X, mala que apita, formulário infinito.
4. **Voo** - passageiro reconhece e começa a filmar: fingir dormir, se esconder atrás do cardápio, trocar de assento.
5. **Imigração** - diálogo de múltipla escolha; respostas erradas levam a finais cômicos (deportado, Canadá).
6. **Final** - chega em Miami e o quarto de hóspedes já está ocupado pelo irmão.

## Mecânicas

- **Barra de Exposição na Mídia**: sobe quando alguém te vê; cheia = manchete e fim da fase.
- **Itens**: boné + óculos escuros (disfarce), "nota oficial" (anula um escândalo uma vez), celular do assessor (distração).
- **Colecionáveis**: recortes de jornal fictícios, estilo charge.

## Estrutura (decidido 2026-10-27)

- **Cada fase é um minigame diferente**, com regras próprias. A shell só conhece o contrato `Minigame` (`src/minigame.ts`): título, dica de uma linha, `update`, `render`, `pointer` e `outcome`. Antes de cada fase aparece um cartão com título e dica ("Fuja!", "Disfarce!").
- **Retrato é o layout primário.** Resolução virtual 180x320 (9:16), escala inteira; no desktop vira letterbox. Todo controle tem que caber no polegar: toque, arrasto e swipe, sem teclado obrigatório.
- A Barra de Exposição na Mídia é o fio que atravessa as fases: cada minigame pode enchê-la, e ela vai junto para a fase seguinte.
