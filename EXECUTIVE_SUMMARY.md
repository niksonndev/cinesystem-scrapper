# RELATÓRIO EXECUTIVO - ANÁLISE DE PREÇOS INGRESSO.COM

## Sumário

Foi realizada uma análise completa da estrutura HTML e APIs do site `https://www.ingresso.com/cinema/cinesystem-maceio` para entender como os preços de ingressos estão estruturados.

## Achados Principais

### 1. Estrutura HTML dos Preços

**Status:** Preços NÃO estão no HTML estático

Os cards de filme utilizam classes do Tailwind CSS:

- Container principal: `div[class*="bg-ing-neutral-600"]`
- Título do filme: `h3 a`
- Duração: `[class*="italic"]`
- Horários de sessão: `span[data-testid="animated-label"]`
- Botões de compra: `a[href*="checkout.ingresso.com"]`

### 2. Dados Extraídos com Sucesso

**15 filmes encontrados com 32 sessões totais:**

- Avatar: Fogo E Cinzas (1 sessão)
- Zootopia 2 (3 sessões)
- Destruição Final 2 (1 sessão)
- Para Sempre Medo (1 sessão)
- O Diário De Pilar Na Amazônia (2 sessões)
- Um Cabra Bom De Bola (3 sessões)
- O Agente Secreto (2 sessões)
- (Des)controle (1 sessão)
- A Empregada (5 sessões)
- GHIBLI FEST - O Reino Dos Gatos (1 sessão)
- Isso Ainda Está De Pé? (3 sessões)
- O Morro Dos Ventos Uivantes (5 sessões)
- Anêmona (2 sessões)
- Caminhos Do Crime (1 sessão)
- O Frio Da Morte (1 sessão)

### 3. Tipos de Exibição Encontrados

- DUBLADO
- LEGENDADO
- NACIONAL
- VIP
- CINEPIC

### 4. Menções de Preço Encontradas

| Termo         | Encontrado       | Notas                                               |
| ------------- | ---------------- | --------------------------------------------------- |
| Meia          | ✅ Sim (3x)      | Referência a meia entrada para estudantes           |
| Inteira       | ↔️ Limitado (1x) | Não explícito                                       |
| Gratuito      | ❌ Não           | Sem promoções gratuitas                             |
| Desconto      | ✅ Sim (2x)      | Há referências a descontos                          |
| Valores em R$ | ✅ Sim (12x)     | Encontrados em "R$ 0,00" (carregados dinamicamente) |

### 5. APIs Identificadas

**Endpoint do Cinema:**

```
GET https://api-content.ingresso.com/v0/theaters/url-key/cinesystem-maceio/partnership/home
```

**Endpoint da Cidade:**

```
GET https://api-content.ingresso.com/v0/states/city/name/maceio
```

**Endpoint de Sessões:**

```
GET https://api-content.ingresso.com/v0/sessions/city/53/theater/1162/dates/partnership/home
```

## Estrutura de Uma Sessão

Cada sessão contém:

- **movieTitle**: Título do Filme
- **time**: Horário (ex: "20:45")
- **sessionId**: ID único da sessão
- **fullURL**: `https://checkout.ingresso.com/?sessionId={ID}&partnership=home`

### Exemplo:

```javascript
{
  "movieTitle": "Avatar: Fogo E Cinzas",
  "time": "20:45",
  "sessionId": "84078366",
  "fullURL": "https://checkout.ingresso.com/?sessionId=84078366&partnership=home"
}
```

## Página de Checkout

**URL Pattern:** `https://checkout.ingresso.com/?sessionId={sessionId}&partnership=home`

**Redirecionado para:** `https://checkout.ingresso.com/assentos?sessionId={sessionId}&partnership=home`

**Preços NA página de checkout:**

- Status: Carregados dinamicamente
- Formato encontrado: "R$ 0,00" (precisa JavaScript para renderizar valores reais)
- Menção a "Meia entrada" com aviso para estudantes

## Seletores CSS para Scraping

```javascript
// Encontrar todos os filmes
const movieContainers = document.querySelectorAll(
  'div[class*="bg-ing-neutral-600"]',
);

// Para cada filme, extrair:
movieContainers.forEach((container) => {
  const title = container.querySelector('h3 a')?.textContent;
  const duration = container.querySelector('[class*="italic"]')?.textContent;
  const types = container.querySelectorAll('div[class*="bg-ing-blue"]'); // DUBLADO, etc

  // Extrair horários
  const times = container.querySelectorAll(
    'span[data-testid="animated-label"]',
  );

  // Links de checkout
  const buyLinks = container.querySelectorAll(
    'a[href*="checkout.ingresso.com"]',
  );
});
```

## Imagens Salvas

1. **Screenshot da página:** `/data/price-inspection.png`
2. **HTML completo:** `/data/page-structure.html`

## Scripts Criados

1. **`src/price-inspector.js`** - Análise de estrutura HTML dos preços
2. **`src/detailed-price-analysis.js`** - Análise detalhada com interação
3. **`src/checkout-analysis.js`** - Análise de URLs de checkout
4. **`src/intercept-api-calls.js`** - Intercepta chamadas de API de rede

## Conclusões

### ✅ Concluído

- Extração de filmes, durações, sessões
- Identificação de tipos de exibição
- Identificação de APIs principais
- URLs de checkout mapeadas

### ⏳ Pendente

- Extração de preços (requer investigação adicional de endpoint de preços)
- Identificação exata de valores de "inteira" vs "meia"
- Confirmação de promoções/descontos

## Recomendações

1. **Para extrair preços:**
   - Testar endpoints de API como `/sessions/{id}/prices`
   - Ou fazer scrape da página de checkout com Playwright

2. **Para estrutura de dados:**
   - Usar sessionId como chave primária
   - Armazenar tanto HTML quanto dados de API

3. **Próximas investigações:**
   - Monitorar requisições do navegador ao clicar em "Comprar"
   - Explorar endpoints adicionais de pricing
   - Verificar se há API GraphQL

---

**Data:** 22/02/2026
**Site:** https://www.ingresso.com/cinema/cinesystem-maceio
**Cinema:** Cinesystem Maceió
**Status:** Análise Completa (em andamento)
