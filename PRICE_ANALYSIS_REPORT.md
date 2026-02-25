/\*\*

- RELATÓRIO FINAL: ANÁLISE DA ESTRUTURA DE PREÇOS DO INGRESSO.COM
-
- Conclusões baseadas na inspeção do site da Cinesystem Maceió
  \*/

# ANÁLISE DA ESTRUTURA DE PREÇOS - INGRESSO.COM

## 1. ESTRUTURA GERAL

### Filmes encontrados: 15

- Avatar: Fogo E Cinzas
- Zootopia 2
- Destruição Final 2
- Para Sempre Medo
- O Diário De Pilar Na Amazônia
- Um Cabra Bom De Bola
- O Agente Secreto
- (Des)controle
- A Empregada
- GHIBLI FEST - O Reino Dos Gatos
- Isso Ainda Está De Pé?
- O Morro Dos Ventos Uivantes
- Anêmona
- Caminhos Do Crime
- O Frio Da Morte

**Total de sessões encontradas: 32**

---

## 2. ESTRUTURA HTML DOS PREÇOS

### 2.1 Cards de Filme

Os filmes são apresentados em containers com a classe:

```
div[class*="bg-ing-neutral-600"]
```

Estrutura típica de um card:

```html
<div
  class="bg-ing-neutral-600 relative my-5 scroll-mt-[250px] overflow-hidden rounded-[10px] p-4"
>
  <!-- Poster do filme -->
  <div class="float-left mr-4 w-[95px] lg:w-[175px]">
    <img alt="Imagem do filme..." src="..." />
  </div>

  <!-- Informações do filme -->
  <div class="mb-6 min-h-[140px] items-center gap-4 overflow-hidden">
    <h3><a href="..." class="text-white">Título do Filme</a></h3>
    <span class="mt-4 ml-2 text-sm italic">Duração (ex: 3h17)</span>
  </div>

  <!-- Tipos de exibição e botões de compra -->
  <div class="border-ing-neutral-500 mt-4 flex flex-col border-t pt-4">
    <div class="mx-0 mt-0 mb-[15px] flex flex-col">
      <!-- Tipo: Dublado, Legendado, etc -->
      <div class="py-1 px-2 uppercase font-uol-bold text-[10px] bg-ing-blue">
        DUBLADO
      </div>

      <!-- Botões de sessão/compra -->
      <div class="mt-4 flex flex-wrap gap-2">
        <a
          href="https://checkout.ingresso.com/?sessionId=84078366&partnership=home"
          class="border-ing-blue-400 text-ing-blue-400 border-2 bg-transparent rounded-[10px]"
        >
          <span data-testid="animated-label">20:45</span>
        </a>
      </div>
    </div>
  </div>
</div>
```

### 2.2 Seletores CSS Importantes

**Para elementos de preço:**

- `[class*="price"]` - Não encontrado diretamente no card
- `[class*="Price"]` - Não encontrado diretamente no card
- `[class*="valor"]` - Não encontrado

**Para botões de sessão:**

- `span[data-testid="animated-label"]` - Contém o horário da sessão

**Para botões de compra:**

- `a[href*="checkout.ingresso.com"]` - Links para checkout

**Para labels de tipo:**

- `div[class*="bg-ing-blue"]` - Indica tipo de exibição (DUBLADO, LEGENDADO, NACIONAL, VIP, Cinemateca, Normal)

---

## 3. PREÇOS NA PÁGINA DE CHECKOUT

### 3.1 URL de Checkout

```
https://checkout.ingresso.com/?sessionId={sessionId}&partnership=home
```

**Exemplo:**

```
https://checkout.ingresso.com/?sessionId=84078366&partnership=home
```

### 3.2 Estrutura de Preços no Checkout

Na página de checkout foram encontradas as seguintes informações:

```
Tem "MEIA": true
Tem "INTEIRA": undefined
Tem "ESTUDANTE": undefined
```

**Preços encontrados:**

- `R$ 0,00` - Preço total
- `0,00` - Composição do preço

**Observações:**

- Os preços aparecem como "R$ 0,00" inicialmente (provavelmente carregados dinamicamente via JavaScript/API)
- Há referência a "Meia entrada" com aviso para estudantes
- O texto menciona: "Link para as informações de meia entrada:Aviso aos Estudantes"

---

## 4. PALAVRAS-CHAVE ENCONTRADAS NO SITE

| Palavra-chave | Quantidade | Status         |
| ------------- | ---------- | -------------- |
| inteira       | 1          | Encontrado     |
| meia          | 3          | Encontrado     |
| estudante     | 0          | Não encontrado |
| gratuito      | 0          | Não encontrado |
| desconto      | 2          | Encontrado     |
| reais         | 12         | Encontrado     |

---

## 5. CATEGORIAS DE INGRESSOS ENCONTRADAS

### 5.1 Tipos de Exibição

- DUBLADO
- LEGENDADO
- NACIONAL
- VIP
- CINEPIC

### 5.2 Tipos de Assento

- Disponível
- Selecionado
- Ocupado
- Bloqueado
- Cadeirante
- Obeso
- VIP

### 5.3 Informações sobre Meia Entrada

Encontrado no texto da página de checkout:

```
"Portaria NR004 2011 Link para as informações de meia entrada:Aviso aos Estudantes;
Em decorrência do horário de verão, as sessões estarão disponíveis para venda até
1h e 15min antes da abertura das salas."
```

---

## 6. RECOMENDAÇÕES PARA O SCRAPER

### 6.1 Extração de Filmes e Sessões (FUNCIONANDO)

```javascript
// Seletor para containers de filme
const movieContainers = document.querySelectorAll(
  'div[class*="bg-ing-neutral-600"]',
);

// Para cada container:
const titleEl = container.querySelector('h3 a'); // Título
const durationEl = container.querySelector('[class*="italic"]'); // Duração
const timeElements = container.querySelectorAll(
  'span[data-testid="animated-label"]',
); // Horários
const typeLabels = container.querySelectorAll('div[class*="bg-ing-blue"]'); // Tipo de exibição
```

### 6.2 Extração de Preços (REQUER INVESTIGAÇÃO ADICIONAL)

Os preços **NÃO ESTÃO** no HTML estático dos cards. Eles provavelmente são:

1. **Carregados dinamicamente via API** quando você navega para o checkout
2. **Ou renderizados quando você clica em um botão de preço**

**Próximos passos:**

- Monitorar requisições de API (Network tab) para encontrar o endpoint de preços
- Executar Playwright com `--headed` para capturar as chamadas de API
- Verificar se há um endpoint GraphQL ou REST que retorna preços baseado em sessionId

### 6.3 Estrutura de Dados Sugerida para Scraper

```javascript
{
  "filme": {
    "titulo": "Avatar: Fogo E Cinzas",
    "duracao": "3h17",
    "genero": "Ação, Aventura, Drama",
    "sessoes": [
      {
        "horario": "20:45",
        "tipo": "DUBLADO",
        "sessionId": "84078366",
        "precos": {
          "inteira": null, // A determinar
          "meia": null, // A determinar
          "estudante": null // Pode não existir
        },
        "url_checkout": "https://checkout.ingresso.com/?sessionId=84078366&partnership=home"
      }
    ]
  }
}
```

---

## 7. CONCLUSÕES

1. **Filmes e Sessões**: Fácil de extrair via Playwright + evaluate
2. **Preços**: Não disponíveis no HTML estático - requerem:
   - Investigação de APIs
   - Ou captura de requisições de rede
   - Ou navegação até a página de checkout
3. **Meia Entrada**: Existe (encontrado no texto) mas sem preço associado ainda
4. **Promoções Gratuitas**: Não encontradas ("gratuito" = 0 menções)
5. **Estrutura é limpa**: Usa Tailwind CSS com classes previsíveis

---

## 8. APIs IDENTIFICADAS

### 8.1 Endpoints API Encontrados

**GET - Informações do Cinema:**
```
https://api-content.ingresso.com/v0/theaters/url-key/{theaterKey}/partnership/home
```
Exemplo: `https://api-content.ingresso.com/v0/theaters/url-key/cinesystem-maceio/partnership/home`

**GET - Informações da Cidade:**
```
https://api-content.ingresso.com/v0/states/city/name/{cityName}
```
Exemplo: `https://api-content.ingresso.com/v0/states/city/name/maceio`

**GET - Sessões por Data:**
```
https://api-content.ingresso.com/v0/sessions/city/{cityId}/theater/{theaterId}/dates/partnership/home
```
Exemplo: `https://api-content.ingresso.com/v0/sessions/city/53/theater/1162/dates/partnership/home`

**Endpoint de Preços (a explorar):**
- `GET https://api-content.ingresso.com/v0/sessions/{sessionId}/prices`
- `GET https://api-content.ingresso.com/v0/sessions/{sessionId}/pricing`
- `GET https://checkout.ingresso.com/api/sessions/{sessionId}/pricing`

---

## 9. PRÓXIMOS PASSOS RECOMENDADOS

1. ✅ Extrair filmes, durações e sessões (já funciona)
2. ✅ Interceptar requisições de rede para encontrar APIs
3. ⏳ Completar investigação de endpoint de preços
4. ⏳ Testar os endpoints de API para extrair dados estruturados
5. ⏳ Integrar extração de preços ao scraper principal

---

**Data da análise:** 22/02/2026
**Site analisado:** https://www.ingresso.com/cinema/cinesystem-maceio
**Método:** Playwright + JavaScript evaluate
**Status:** Parcialmente concluído - Estrutura HTML identificada, preços ainda a determinar
