import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import path from "node:path";
import {fileURLToPath} from "node:url";
const root=fileURLToPath(new URL("../",import.meta.url));
const context={};
vm.runInNewContext(fs.readFileSync(path.join(root,"src/logic.js"),"utf8"),context);
const u=context.YTBF;
assert(u,"parser must expose utilities");
assert.equal(u.parseTime("1:02:03"),3723);
assert.equal(u.parseTime("03:15"),195);
assert.equal(u.parseTime("LIVE"),null);
assert.equal(u.parseNumber("1.2M views"),1200000);
assert.equal(u.parseNumber("1,5 mil visualizações"),1500);
assert.equal(u.parseNumber("1,2 mi visualizações"),1200000);
assert.equal(u.language("ja-JP"),"ja");
const player={
  videoDetails:{videoId:"12345678901",lengthSeconds:"765",isLiveContent:false,defaultAudioLanguage:"ja-JP"},
  captions:{playerCaptionsTracklistRenderer:{captionTracks:[
    {languageCode:"en",vssId:".en",name:{simpleText:"English"}},
    {languageCode:"ja",vssId:".ja",name:{simpleText:"Japanese"}},
    {languageCode:"en",kind:"asr",vssId:"a.en",name:{simpleText:"English auto-generated"}},
  ]}},
  microformat:{playerMicroformatRenderer:{category:"Education",publishDate:"2025-07-03"}},
};
const html='<script>var ytInitialPlayerResponse = '+JSON.stringify(player)+';</script>';
const metadata=u.readVideoMetadata(html);
assert(metadata);
assert.deepEqual(Array.from(metadata.manual),["en","ja"]);
assert.deepEqual(Array.from(metadata.automatic),["en"]);
assert.equal(metadata.audioLanguage,"ja");
assert.equal(metadata.category,"Education");
assert.equal(metadata.publishDate,"2025-07-03");
assert.equal(metadata.duration,765);
assert.equal(u.readVideoMetadata("<html>no player data</html>"),null);
const card={kind:"video",videoId:"12345678901",title:" Learn   Japanese ",channel:"Language School",
  duration:765,views:1200000,isLive:false};
const basic={...u.DEFAULTS,hideShorts:false,captions:"manual",captionLanguage:"ja",category:"Education",
  audioLanguage:"ja",minMinutes:"10",maxMinutes:"20",minViews:"100000",fromDate:"2025-01-01",toDate:"2025-12-31"};
assert.equal(u.checkCard(card,basic,metadata,"").show,true);
assert.equal(u.checkCard(card,{...basic,captionLanguage:"fr"},metadata,"").show,false);
assert.equal(u.checkCard(card,basic,{...metadata,category:"Educação"},"").show,true);
assert.equal(u.checkCard(card,{...basic,captions:"automatic",captionLanguage:""},metadata,"").show,true);
assert.equal(u.checkCard(card,{...basic,captions:"manual"},null,"pending").show,false);
assert.equal(u.checkCard(card,{...basic,captions:"manual"},null,"pending").pending,true);
assert.equal(u.checkCard(card,{...basic,unknown:"show"},null,"pending").show,true);
assert.equal(u.checkCard(card,{...basic,minMinutes:"15"},metadata,"").show,false);
assert.equal(u.checkCard(card,{...basic,includeTitle:"JAPANESE"},metadata,"").show,true);
assert.equal(u.checkCard(card,{...basic,excludeTitle:"japanese"},metadata,"").show,false);
assert.equal(u.checkCard({...card,kind:"short"},u.DEFAULTS,null,"").show,false);
assert.equal(u.checkCard(card,{...basic,enabled:false},null,"").show,true);
const logic=fs.readFileSync(path.join(root,"src/logic.js"),"utf8");
const content=fs.readFileSync(path.join(root,"src/content.js"),"utf8");
const ui=fs.readFileSync(path.join(root,"src/ui.js"),"utf8");
assert(!/https:\/\/(?!www\.youtube\.com)/.test(content),"only YouTube host may be contacted for video metadata");
assert(content.includes('credentials:"same-origin"'));
assert(content.includes("queued.has(id)"));
assert(content.includes("activeJobs<2"));
assert(content.includes("yt-navigate-finish"));
assert(ui.includes("Somente legendas manuais"));
assert(ui.includes("Categoria do YouTube"));
assert(ui.includes("Duração exata"));
assert(!/fetch\(/.test(logic+ui),"parsing and UI modules must never make requests");
assert(!/eval\(|new Function\(/.test(logic+content+ui),"no dynamic code evaluation");
console.log("PASS: metadata parsing, manual vs ASR, language, category, duration, views, dates, safe rate-limited YouTube-only checks.");
