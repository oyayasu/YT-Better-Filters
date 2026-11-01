/* Local, dependency-free filter interface. */
(function (root) {
  "use strict";
  const LANGUAGES = [
    ["","Qualquer idioma"],["en","Inglês"],["ja","Japonês"],["pt","Português"],
    ["es","Espanhol"],["fr","Francês"],["de","Alemão"],["ko","Coreano"],
    ["zh","Chinês"],["it","Italiano"],["ru","Russo"],["ar","Árabe"],
    ["hi","Hindi"],["id","Indonésio"],["tr","Turco"],["nl","Holandês"],
    ["pl","Polonês"],["th","Tailandês"],["vi","Vietnamita"],
  ];
  const CATEGORIES = ["","Film & Animation","Autos & Vehicles","Music",
    "Pets & Animals","Sports","Travel & Events","Gaming","People & Blogs",
    "Comedy","Entertainment","News & Politics","Howto & Style","Education",
    "Science & Technology","Nonprofits & Activism"];
  function options(items) {
    return items.map(item => '<option value="' + item[0] + '">' + item[1] + '</option>').join("");
  }
  function field(label, name, type = "text", placeholder = "") {
    return '<label class="ytbf-field"><span>' + label + '</span><input data-field="' +
      name + '" type="' + type + '" placeholder="' + placeholder + '" ' +
      (type === "number" ? 'min="0" step="any"' : "") + '></label>';
  }
  function select(label, name, values) {
    return '<label class="ytbf-field"><span>' + label + '</span><select data-field="' +
      name + '">' + options(values) + "</select></label>";
  }
  function checkbox(label, name) {
    return '<label class="ytbf-check"><input type="checkbox" data-field="' + name + '"><span>' + label + "</span></label>";
  }
  function section(title, children) {
    return '<section class="ytbf-section"><h3>' + title + '</h3>' + children + '</section>';
  }
  function render(limit) {
    const container = document.createElement("div");
    container.id = "ytbf-root";
    const parts = [
      '<button class="ytbf-launcher" id="ytbf-launcher" type="button" aria-expanded="false" aria-controls="ytbf-panel">☷ <span>Filtros+</span></button>',
      '<section id="ytbf-panel" class="ytbf-panel" role="dialog" aria-modal="false" aria-label="Filtros avançados do YouTube" hidden>',
      '<header class="ytbf-header"><div><strong>YT Better Filters</strong><small>Busca avançada • sem serviços externos</small></div>',
      '<button type="button" id="ytbf-close" class="ytbf-icon" aria-label="Fechar">✕</button></header>',
      '<div class="ytbf-scroll">',
      checkbox("Ativar filtros","enabled"),
      section("Legendas e idiomas",
        select("Tipo de legenda","captions",[
          ["any","Sem restrição"],["manual","Somente legendas manuais"],
          ["captioned","Qualquer legenda"],["automatic","Legendas automáticas (ASR)"]
        ])+
        select("Idioma das legendas manuais","captionLanguage",LANGUAGES)+
        select("Idioma do áudio (quando informado)","audioLanguage",LANGUAGES)+
        '<p class="ytbf-hint">As legendas manuais são verificadas nos metadados do próprio vídeo. Tradução automática não conta como faixa manual.</p>'
      ),
      section("Duração exata",
        '<div class="ytbf-grid">'+field("Mínimo (min)","minMinutes","number","0")+
        field("Máximo (min)","maxMinutes","number","∞")+'</div>'+
        '<div class="ytbf-presets">'+
        '<button data-preset="short-duration" type="button">Até 5 min</button>'+
        '<button data-preset="medium-duration" type="button">5–20 min</button>'+
        '<button data-preset="long-duration" type="button">20+ min</button>'+
        '<button data-preset="longer-duration" type="button">60+ min</button></div>'
      ),
      section("Conteúdo e publicação",
        select("Categoria do YouTube","category",CATEGORIES.map(x=>[x,x||"Qualquer categoria"]))+
        '<div class="ytbf-grid">'+field("Publicado depois de","fromDate","date")+
        field("Publicado até","toDate","date")+'</div>'+
        '<div class="ytbf-grid">'+field("Mínimo de visualizações","minViews","number","0")+
        field("Máximo de visualizações","maxViews","number","∞")+'</div>'
      ),
      section("Palavras e canais",
        field("Título deve conter","includeTitle","text","Palavra ou frase")+
        field("Excluir do título","excludeTitle","text","Separe por vírgula")+
        field("Canal deve conter","includeChannel","text","Nome do canal")+
        field("Excluir canais","excludeChannel","text","Separe por vírgula")
      ),
      section("Ocultar",
        '<div class="ytbf-check-grid">'+checkbox("Shorts","hideShorts")+
        checkbox("Lives","hideLive")+checkbox("Playlists e mixes","hidePlaylists")+
        checkbox("Canais","hideChannels")+checkbox("Seções recomendadas","hideShelves")+'</div>'
      ),
      section("Dados indisponíveis",
        select("Se não puder confirmar um filtro","unknown",[
          ["hide","Ocultar resultado não confirmado"],
          ["show","Manter resultado não confirmado"]
        ])+
        '<p class="ytbf-hint">Para exigir legendas manuais, mantenha “Ocultar resultado não confirmado”.</p>'
      ),
      '<p class="ytbf-note">Os filtros atuam nos resultados carregados pelo YouTube; não descobrem resultados ausentes. Até '+
        limit+' consultas de metadados por pesquisa, com limite de velocidade.</p>',
      '</div><footer class="ytbf-footer"><div id="ytbf-stats" role="status" aria-live="polite">Buscando resultados...</div>',
      '<button type="button" id="ytbf-reset">Restaurar filtros</button></footer></section>',
    ];
    container.innerHTML = parts.join("");
    return container;
  }
  root.YTBF_UI = { render };
})(globalThis);
