/* Runs only inside extension popup; never contacts third parties. */
document.querySelector("#open").addEventListener("click", async () => {
  const status = document.querySelector("#status");
  try {
    const api = globalThis.browser || globalThis.chrome;
    const [tab] = await api.tabs.query({active:true,currentWindow:true});
    if (!tab?.id || !/^https:\/\/www\.youtube\.com\/results(?:\?|$)/.test(tab.url || ""))
      throw Error("Abra uma pesquisa no YouTube antes de usar os filtros.");
    const response = await api.tabs.sendMessage(tab.id,{type:"YTBF_TOGGLE"});
    if (!response?.ok) throw Error(response?.reason || "Não foi possível abrir os filtros.");
    window.close();
  } catch (error) { status.textContent = error instanceof Error ? error.message : String(error); }
});
