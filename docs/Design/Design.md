# Design

Parte de [Operação Miami](../Operacao%20Miami.md).

## Tom

Charge de jornal em forma de jogo. O humor é de **situação** - imprensa, burocracia, assessores trapalhões, apoiador querendo selfie - e não de acusação. Tela inicial deixa claro que é paródia e ficção. Nenhum processo ou acusação específica aparece como fato.

## Premissa

O personagem decide que "tá na hora de umas férias longas" e precisa ir de Brasília até Miami sem virar manchete.

## Fases (rascunho)

1. **Gabinete em Brasília** - stealth: sair do Senado sem ser visto por repórteres (pilastras, caixas de "documentos importantes", comitivas).
2. **Orla** - runner vertical em três faixas no calçadão de ondas, rolando sozinho por ~30s. Tocar à esquerda/direita troca de faixa. Ambulante (+15) fica parado; ciclista (+20) desce contra você mais rápido que a rolagem; apoiador (+25, flash de selfie) mostra um `!` e dá um passo para a sua faixa quando você chega perto; o carro de som passa devagar pela avenida e, enquanto está ao lado, a faixa da direita enche a barra. Toda fileira deixa pelo menos uma faixa livre. Seed fixa: a corrida é sempre a mesma, para dar para aprender.
3. **Aeroporto** - três etapas seguidas, cada uma com um gesto diferente:
   - **Fila** (segurar): 5 passageiros à frente; de vez em quando um mostra `?` e vira para trás. Segurar a tela levanta o jornal, mas a fila só anda com o dedo solto. Visto sem jornal: 60/s.
   - **Raio-X** (tocar): a esteira desce com 10 itens; tocar tira o item para a bandeja. Metal que chega ao scanner apita (+15); tirar algo inofensivo também é suspeito (+5). Ferro de passar, panela, halteres e martelo apitam; travesseiro, chinelo, rapadura, boné, protetor e pandeiro não.
   - **Formulário** (escolher): 5 declarações SIM/NÃO com 4,5s cada; a graça é a redação com dupla negação ("Sua viagem NÃO é a turismo?"). Errar ou estourar o tempo: +12.
4. **Voo** (arrastar) - cabine vista de cima, 8 fileiras de 2+2 com corredor, 7 assentos vazios. A cada 3,2s (caindo para 1,8s) um passageiro saca o celular: `?` e a área tracejada por 1,1s, depois `REC` por 3,5s. Selfie grava para trás, então a área é as 2 fileiras atrás dele, do lado dele, corredor incluído (30/s). Arrastar (ou tocar) até um assento vazio: o senador vai pelo corredor, e andar por área gravando também conta. Até 1 câmera no começo, 3 no fim; o voo dura 28s, de GIG a MIA. Fingir dormir e o cardápio ficaram de fora; o carrinho de bordo bloqueando o corredor é a ideia que sobrou.
5. **Imigração** (escolher) - o agente pergunta em inglês; 5 perguntas, 3 respostas cada, ordem embaralhada com seed fixa, 6s de paciência. Toda pergunta tem uma resposta limpa; as outras custam 10-20 ou **encerram a fase com manchete própria**: "I'm very famous in Brazil!" (mandado de volta) e "I dunno... Canada?" (vai parar no Canadá). Estourar a paciência custa 15 e repete a pergunta. "My brother's guest room" custa só 10 e prepara o final. Todas as respostas limpas: carimbo ADMITTED.
6. **Miami** (deslizar) - o quarto de hóspedes está OCUPADO pelo irmão, então é colchão inflável na sala. Deslizar o dedo para baixo e de volta bombeia (+5 por bombada, vaza 4/s). O irmão abre a cortina a cada 3,5-5,5s ("que vista!"), e paparazzi sobem na janela de vez em quando: 0,9s de silhueta, 2s de flash a 35/s se a cortina estiver aberta. Tocar na janela fecha a cortina. Colchão cheio: tela de FIM com a exposição final e um veredito ("Ninguém ficou sabendo" até "Foi parar em todos os jornais").

## Mecânicas

- **Barra de Exposição na Mídia**: sobe quando alguém te vê; cheia = manchete e fim da fase. O que sobra no fim é a nota da run.
- **Itens**: boné + óculos escuros (disfarce), "nota oficial" (anula um escândalo uma vez), celular do assessor (distração).
- **Colecionáveis**: recortes de jornal fictícios, estilo charge.

## Estrutura (decidido 2026-10-27)

- **Cada fase é um minigame diferente**, com regras próprias. A shell só conhece o contrato `Minigame` (`src/minigame.ts`): título, dica de uma linha, `update`, `render`, `pointer` e `outcome`. Antes de cada fase aparece um cartão com título e dica ("Fuja!", "Disfarce!").
- **Retrato é o layout primário.** Resolução virtual 180x320 (9:16), escala inteira; no desktop vira letterbox. Todo controle tem que caber no polegar: toque, arrasto e swipe, sem teclado obrigatório.
- A Barra de Exposição na Mídia é o fio que atravessa as fases: cada minigame pode enchê-la, e ela vai junto para a fase seguinte.
