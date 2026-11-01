# YT Better Filters

Extensão independente para **Chrome, Brave e Firefox** que adiciona um painel de filtros à pesquisa do YouTube.

**Sem APIs de terceiros, chaves, cadastro, cobrança ou dependências externas.** Para metadados, a extensão consulta apenas as páginas de vídeos do próprio YouTube; preferências são mantidas localmente.

## Filtros

- **Legendas:** somente manuais, automáticas (ASR), qualquer legenda ou sem restrição.
- **Idioma das legendas manuais:** inglês, japonês, português, espanhol e diversos outros.
- **Idioma do áudio:** quando explicitamente informado pelo vídeo.
- **Duração:** limite mínimo/máximo com atalhos de até 5, 5–20, 20+ e 60+ minutos.
- **Categoria:** educação, música, jogos, entretenimento, ciência etc.
- **Visualizações:** limite mínimo e máximo.
- **Data de publicação:** intervalo de datas, se disponível nos metadados.
- **Título e canal:** inclusão e exclusão de palavras.
- **Ocultar:** Shorts, lives, playlists, mixes, canais e seções extras.

É possível combinar os filtros. As preferências ficam no armazenamento local do navegador.

## Identificação de legendas

A extensão lê os metadados do player diretamente na página do vídeo. Faixas identificadas por kind=asr ou identificadores iniciados em a. são classificadas como automáticas. Outras faixas disponibilizadas pelo YouTube são tratadas como manuais.

A opção de idioma das legendas manuais examina somente essas faixas. Por exemplo, **Somente legendas manuais + Japonês** solicita a presença de uma faixa japonesa não identificada como ASR.

O YouTube pode omitir ou alterar essas informações. Dados não verificáveis são tratados como **desconhecidos**, não como falsos. Por padrão, vídeos não confirmados são ocultados quando um filtro depende deles. Você pode escolher mantê-los visíveis.

## Instalação — Chrome / Brave

1. Abra [GitHub Actions](https://github.com/oyayasu/YT-Better-Filters/actions/workflows/build.yml).
2. Abra uma execução bem-sucedida e baixe o artefato **YT-Better-Filters-Chrome-Brave**.
3. Extraia o ZIP.
4. Abra chrome://extensions ou brave://extensions, habilite o modo desenvolvedor e escolha **Carregar sem compactação**.
5. Selecione a pasta extraída que contém manifest.json.

## Instalação — Firefox

1. Na mesma página de Actions, baixe **YT-Better-Filters-Firefox**.
2. Extraia o ZIP.
3. Para testes, abra about:debugging#/runtime/this-firefox, escolha **Carregar extensão temporária** e selecione manifest.json na pasta extraída.
4. O Firefox padrão exige assinatura pela Mozilla para instalação permanente. O build não produz automaticamente um XPI assinado.

## Uso

Abra uma pesquisa em youtube.com/results. Clique em **Filtros+** no canto inferior direito, pressione **Alt + F**, ou clique no botão da extensão na barra do navegador.

## Compilação local

Requer Node.js 22, sem bibliotecas extras e sem npm install.

    npm test
    npm run build

O build gera duas pastas prontas para carregamento:

- dist/chromium/
- dist/firefox/

O GitHub Actions testa e gera dois artefatos instaláveis por carregamento manual a cada alteração na branch main.

## Limitações técnicas

A extensão **filtra somente resultados já carregados pelo YouTube**. Não consegue descobrir todos os vídeos existentes nem alterar a ordenação do mecanismo de pesquisa.

Para legendas manuais, categoria, idioma do áudio e data exata, podem ser realizadas consultas limitadas às páginas youtube.com/watch. Para evitar excesso de requisições, a versão inicial limita a duas consultas concorrentes e 140 verificações por pesquisa. Isso não representa uma API gratuita com cota garantidamente ilimitada; o funcionamento está sujeito às mudanças e limitações do próprio YouTube.

O idioma do áudio não é inferido das legendas. Contadores de visualizações abreviados podem ser aproximados. Não há telemetria, analytics, anúncios ou serviços externos à plataforma YouTube.

Projeto independente, não afiliado ao YouTube ou à Google.
