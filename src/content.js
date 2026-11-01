/* YT Better Filters: local content script, no external providers or API keys. */
(() => {
  "use strict";
  if (window.__ytbfLoaded) return;
  window.__ytbfLoaded = true;
  const util = globalThis.YTBF, ui = globalThis.YTBF_UI;
  if (!util || !ui) return;
  const STORE_KEY = "ytbfSettingsV1", LIMIT = 140;
  const CACHE_MS = 8 * 60 * 60 * 1000, FAILURE_MS = 5 * 60 * 1000;
  const SELECTOR = [
    "ytd-video-renderer","ytd-rich-grid-media","ytd-reel-item-renderer",
    "ytd-playlist-renderer","ytd-channel-renderer","ytd-shelf-renderer",
    "ytd-reel-shelf-renderer","ytd-radio-renderer",
  ].join(",");
  let settings = {...util.DEFAULTS};
  let root = null, panel = null, observer = null, lastHref = "";
  let scanTimer = 0, saveTimer = 0, activeJobs = 0, requested = 0, generation = 0;
  const queue = [], queued = new Set(), inflight = new Set(), cache = new Map(), failures = new Map();
  const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

  async function loadSettings() {
    try {
      const storage = (globalThis.browser || globalThis.chrome)?.storage?.local;
      const saved = storage ? await storage.get(STORE_KEY) : null;
      if (saved && saved[STORE_KEY] && typeof saved[STORE_KEY] === "object")
        settings = {...util.DEFAULTS,...saved[STORE_KEY]};
    } catch (error) { console.debug("[YTBF] Storage read failed", error); }
  }
  function persist() {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
      try {
        const storage = (globalThis.browser || globalThis.chrome)?.storage?.local;
        if (storage) void storage.set({[STORE_KEY]:settings});
      } catch (error) { console.debug("[YTBF] Storage write failed", error); }
    }, 250);
  }
  function toggle(value) {
    if (window.location.pathname !== "/results") return;
    if (!root) mount();
    const open = typeof value === "boolean" ? value : panel.hidden;
    panel.hidden = !open;
    root.querySelector("#ytbf-launcher").setAttribute("aria-expanded",String(open));
    if (open) panel.querySelector('[data-field="captions"]').focus();
  }
  function fillControls() {
    if (!root) return;
    root.querySelectorAll("[data-field]").forEach(input => {
      const key = input.dataset.field;
      if (input.type === "checkbox") input.checked = !!settings[key];
      else input.value = settings[key] ?? "";
    });
  }
  function changeField(event) {
    const input = event.currentTarget, field = input.dataset.field;
    if (!Object.prototype.hasOwnProperty.call(util.DEFAULTS,field)) return;
    settings[field] = input.type === "checkbox" ? input.checked : input.value;
    persist(); scheduleScan();
  }
  function preset(name) {
    if (name === "short-duration") Object.assign(settings,{minMinutes:"",maxMinutes:"5"});
    if (name === "medium-duration") Object.assign(settings,{minMinutes:"5",maxMinutes:"20"});
    if (name === "long-duration") Object.assign(settings,{minMinutes:"20",maxMinutes:""});
    if (name === "longer-duration") Object.assign(settings,{minMinutes:"60",maxMinutes:""});
    fillControls();persist();scheduleScan();
  }
  function mount() {
    if (root || !document.body) return;
    root = ui.render(LIMIT);
    document.body.append(root);
    panel = root.querySelector("#ytbf-panel");
    root.querySelector("#ytbf-launcher").addEventListener("click",()=>toggle());
    root.querySelector("#ytbf-close").addEventListener("click",()=>toggle(false));
    root.querySelector("#ytbf-reset").addEventListener("click",()=>{
      settings={...util.DEFAULTS};fillControls();persist();scheduleScan();
    });
    root.querySelectorAll("[data-field]").forEach(input=>{
      input.addEventListener("change",changeField);
      input.addEventListener("input",changeField);
    });
    root.querySelectorAll("[data-preset]").forEach(button=>
      button.addEventListener("click",()=>preset(button.dataset.preset)));
    fillControls();
  }
  function idFromLink(link) {
    try {
      const url = new URL(link,location.href);
      const shorts = url.pathname.match(/^\/shorts\/([\w-]{11})/);
      const id = shorts?.[1] || url.searchParams.get("v");
      return /^[\w-]{11}$/.test(id||"") ? id : "";
    } catch { return ""; }
  }
  function parseCard(element) {
    const titleLink = element.querySelector("a#video-title, a#video-title-link, a[href*='/watch?v='], a[href*='/shorts/']");
    const link = titleLink?.href || "", videoId = idFromLink(link);
    const kind = element.matches("ytd-playlist-renderer,ytd-radio-renderer") ? "playlist"
      : element.matches("ytd-channel-renderer") ? "channel"
      : element.matches("ytd-shelf-renderer") ? "shelf"
      : element.matches("ytd-reel-shelf-renderer,ytd-reel-item-renderer") || link.includes("/shorts/") ? "short" : "video";
    const title = element.querySelector("#video-title,#video-title-link,h3,#title-text")?.textContent?.trim() ||
      titleLink?.textContent?.trim() || "";
    const channel = element.querySelector("ytd-channel-name,#channel-name,#byline-container")?.textContent?.trim() || "";
    const time = element.querySelector("ytd-thumbnail-overlay-time-status-renderer #text,ytd-thumbnail-overlay-time-status-renderer span,#time-status #text")?.textContent?.trim() || "";
    const lines = Array.from(element.querySelectorAll("#metadata-line span,#metadata span"))
      .map(node=>node.textContent?.trim() || "");
    const viewsText = lines.find(text=>/views?|visualiza|觀看|視聴|aufrufe|vues|vistas/i.test(text)) || "";
    const isLive = !!element.querySelector("[overlay-style='LIVE'],.badge-style-type-live-now-alternate,[aria-label*='LIVE'],[aria-label*='Ao vivo']");
    return {videoId,kind,title,channel,duration:util.parseTime(time),
      views:viewsText ? util.parseNumber(viewsText):null,isLive};
  }
  function cards() {
    const search = document.querySelector("ytd-search");
    if (!search) return [];
    return Array.from(search.querySelectorAll(SELECTOR)).filter(element =>
      !element.parentElement?.closest("ytd-shelf-renderer,ytd-reel-shelf-renderer,ytd-rich-grid-media"));
  }
  function metadata(id) {
    const hit=cache.get(id);
    return hit && Date.now()-hit.at<CACHE_MS ? hit.value : null;
  }
  async function loadMetadata(id) {
    const controller = new AbortController();
    const timeout = setTimeout(()=>controller.abort(),10000);
    try {
      const response=await fetch("https://www.youtube.com/watch?v="+encodeURIComponent(id),{
        credentials:"same-origin",signal:controller.signal,redirect:"follow",
      });
      if (!response.ok) throw Error("YouTube HTTP "+response.status);
      const player=util.readVideoMetadata(await response.text());
      if (!player) throw Error("YouTube player metadata unavailable");
      cache.set(id,{value:player,at:Date.now()});
      if(cache.size>250)cache.delete(cache.keys().next().value);
    } catch (error) { failures.set(id,{error:String(error),at:Date.now()}); }
    finally {clearTimeout(timeout);}
  }
  function enqueue(id) {
    if(!id||metadata(id)||queued.has(id)||inflight.has(id)||requested>=LIMIT)return;
    const failed=failures.get(id);
    if(failed&&Date.now()-failed.at<FAILURE_MS)return;
    queued.add(id);queue.push({id,generation});void pump();
  }
  function pump() {
    while(activeJobs<2&&queue.length&&requested<LIMIT){
      const task=queue.shift();
      queued.delete(task.id);
      if(task.generation!==generation||metadata(task.id))continue;
      activeJobs++;requested++;inflight.add(task.id);
      void (async()=>{
        await sleep(350);
        try{await loadMetadata(task.id);}
        finally{inflight.delete(task.id);activeJobs--;scheduleScan();pump();}
      })();
    }
  }
  function scheduleScan(){
    clearTimeout(scanTimer);
    scanTimer=setTimeout(scan,150);
  }
  function scan(){
    if(!root||location.pathname!=="/results")return;
    const visible=cards();
    let showing=0,hidden=0,unknown=0,pending=0;
    const needs=settings.enabled&&util.requiresMetadata(settings);
    for(const element of visible){
      const card=parseCard(element);
      const meta=card.videoId?metadata(card.videoId):null;
      let state="";
      if(needs&&card.videoId&&(card.kind==="video"||card.kind==="short")&&!meta){
        // Avoid fetching metadata for items rejected by local title, duration or view filters.
        const local=util.checkCard(card,{...settings,captions:"any",captionLanguage:"",
          audioLanguage:"",category:"",fromDate:"",toDate:""},null,"");
        if(local.show){
          enqueue(card.videoId);
          const failed=failures.get(card.videoId);
          state=failed?"failed":requested>=LIMIT&&!queued.has(card.videoId)?"limit":"pending";
        }
      }
      const result=util.checkCard(card,settings,meta,state);
      element.classList.toggle("ytbf-hidden",!result.show);
      if(result.show)showing++;else hidden++;
      if(result.unknown)unknown++;
      if(result.pending)pending++;
    }
    const summary=showing+" de "+visible.length+" exibidos"+(pending?" · "+pending+" verificando":"")+
      (unknown?" · "+unknown+" não confirmados":"")+(hidden?" · "+hidden+" ocultos":"");
    const node=root.querySelector("#ytbf-stats");
    if(node.textContent!==summary)node.textContent=summary;
  }
  function cleanup(){
    if(observer){observer.disconnect();observer=null;}
    if(root){root.remove();root=null;panel=null;}
    for(const element of document.querySelectorAll(".ytbf-hidden"))element.classList.remove("ytbf-hidden");
    queue.length=0;queued.clear();generation++;requested=0;
  }
  function navigation(){
    const route=location.pathname==="/results";
    if(lastHref===location.href&&!!root===route&&(!route||observer))return;
    const before=lastHref;
    lastHref=location.href;
    if(!route){cleanup();return;}
    if(before!==lastHref){queue.length=0;queued.clear();generation++;requested=0;}
    mount();
    if(observer){observer.disconnect();observer=null;}
    const search=document.querySelector("ytd-search");
    if(search){
      observer=new MutationObserver(scheduleScan);
      observer.observe(search,{childList:true,subtree:true});
    }
    scheduleScan();
  }
  document.addEventListener("yt-navigate-finish",()=>setTimeout(navigation,120));
  window.addEventListener("popstate",navigation);
  document.addEventListener("keydown",event=>{
    if(event.altKey&&!event.ctrlKey&&!event.metaKey&&event.key.toLowerCase()==="f"&&
      location.pathname==="/results"){
      event.preventDefault();toggle();
    }
  });
  try{
    (globalThis.browser||globalThis.chrome)?.runtime?.onMessage.addListener((msg,_sender,reply)=>{
      if(msg?.type!=="YTBF_TOGGLE")return;
      if(location.pathname==="/results"){toggle();reply({ok:true});}
      else reply({ok:false,reason:"Abra uma pesquisa no YouTube."});
    });
  }catch{}
  void loadSettings().then(()=>{navigation();fillControls();scheduleScan();});
  let observedUrl=location.href;
  setInterval(()=>{
    if(location.href!==observedUrl){observedUrl=location.href;navigation();}
    else if(location.pathname==="/results"&&!observer)navigation();
  },1200);
})();