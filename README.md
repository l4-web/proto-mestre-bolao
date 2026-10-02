# Mestre do Bolão sobre o Atende Aí (wireframe navegável)

Cópia do front real do Atende Aí (`atendeai/l4os-atendeai`), mesmo layout e mesmo DS,
rodando sem backend: a API inteira é simulada em memória. Serve para a vendedora e os
stakeholders navegarem o fluxo antes de qualquer integração existir.

```
pnpm dev   # http://localhost:4323/conversas
```

Estado zera a cada recarga. Nada aqui é dado real.

## O que é novo em relação ao Atende Aí de hoje

- **Configuração por produto** (`src/features/bolao/recursos.ts`): troque o produto no
  seletor da barra lateral. Mestre do Bolão ganha abas, botões e filtros; APCAP VIP
  continua com o painel de sempre. Nenhum `if` de produto nas telas.
- **Painel com abas**: Bolões do dia (API Mestre do Bolão), Carrinho (reserva de 30 min
  + Pix), Cliente (iON).
- **Botões na conversa**: Enviar bolões, Criar arte (Cria Aí), Carrinho, Cliente.
- **Pix**: gera a cobrança, manda QR + copia e cola, faixa com contagem, etiqueta
  "Pix pendente"; "Simular pago" dispara o evento do módulo do bolão, que troca para
  "Pago" e manda o canhoto com o nome do cliente sozinho.
- **Transferir** com texto e para PESSOA ou fila. **Resolver** no lugar de Encerrar.
- **Nova conversa** por template aprovado (busca no iON, opt-out, custo, limite diário).
- **Simular** (topo da tela): lead novo da landing page, cliente responde, resultado
  premiado ou não.
- Filtros **Pix pendente / Prêmio** e etiquetas na lista.

## Onde mora cada coisa

- `src/mock/`: API do Atende Aí simulada (fetch interceptado). `window.__mock` no console.
- `src/features/bolao/loja.ts`: as integrações simuladas (cada função = uma chamada a
  um provedor). `ponte.ts` liga isso às mensagens e etiquetas da conversa.
- `src/components/bolao/`: painel, card de bolão, botões, modais (Cria Aí, enviar
  bolões, nova conversa).
