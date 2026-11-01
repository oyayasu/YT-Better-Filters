/* Zero-dependency cross-browser WebExtension packaging. */
import fs from "node:fs";
import path from "node:path";
const root=path.resolve(import.meta.dirname,"..");
const out=path.join(root,"dist");
fs.rmSync(out,{recursive:true,force:true});
const shared=["logic.js","ui.js","content.js","styles.css","popup.html","popup.js"];
for(const browser of ["chromium","firefox"]){
  const dir=path.join(out,browser);
  fs.mkdirSync(dir,{recursive:true});
  for(const file of shared)fs.copyFileSync(path.join(root,"src",file),path.join(dir,file));
  const manifest={
    manifest_version:3,
    name:"YT Better Filters",
    version:"1.0.0",
    description:"Filtros avançados de busca, duração, idiomas, categorias e legendas manuais no YouTube.",
    permissions:["storage","activeTab"],
    host_permissions:["https://www.youtube.com/*"],
    content_scripts:[{
      matches:["https://www.youtube.com/*"],
      js:["logic.js","ui.js","content.js"],
      css:["styles.css"],
      run_at:"document_idle",
    }],
    action:{default_title:"YT Better Filters",default_popup:"popup.html"},
  };
  if(browser==="firefox"){
    manifest.browser_specific_settings={gecko:{
      id:"yt-better-filters@oyayasu",
      strict_min_version:"128.0",
    }};
  }
  fs.writeFileSync(path.join(dir,"manifest.json"),JSON.stringify(manifest,null,2)+"\n");
  console.log("Built "+browser+" extension:",dir);
}
