/* YT Better Filters: pure parsing utilities. No external APIs, dependencies or network calls. */
(function (root) {
  "use strict";
  function normalize(value) {
    return String(value ?? "").normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
  }
  function language(code) {
    return String(code || "").toLowerCase().split(/[-_]/)[0];
  }
  function parseTime(value) {
    const numbers = String(value || "").trim().split(":").map(x => Number(x));
    if (numbers.length < 2 || numbers.length > 3 || numbers.some(n => !Number.isInteger(n) || n < 0)) return null;
    if (numbers.slice(1).some(n => n > 59)) return null;
    return numbers.reduce((seconds, n) => seconds * 60 + n, 0);
  }
  function parseNumber(text) {
    const s = normalize(text).replace(/\u00a0/g, " ");
    const match = s.match(/(\d+(?:[.,]\d+)?)\s*(bilh(?:ao|oes)|bilhoes|billion|milhao|milhoes|millions?|mil|milhar|thousand|[kmb])\b/i);
    if (match) {
      let number = match[1].replace(",", ".");
      const scale = match[2];
      if (["mil", "milhar", "thousand", "k"].includes(scale)) return Math.round(Number(number) * 1e3);
      if (["m", "milhao", "milhoes", "million", "millions"].includes(scale)) return Math.round(Number(number) * 1e6);
      return Math.round(Number(number) * 1e9);
    }
    const plain = s.match(/\d[\d., ]*\d|\d/);
    return plain ? Number(plain[0].replace(/\D/g, "")) : null;
  }
  function jsonAssignedTo(html, variable) {
    const match = new RegExp("\\b" + variable + "\\s*=\\s*").exec(html);
    if (!match) return null;
    const start = html.indexOf("{", match.index + match[0].length);
    if (start < 0 || start - match.index > 15) return null;
    let depth = 0, quoted = false, escaped = false;
    for (let i = start; i < html.length && i < start + 2500000; i++) {
      const char = html[i];
      if (quoted) {
        if (escaped) escaped = false;
        else if (char === "\\") escaped = true;
        else if (char === '"') quoted = false;
      } else if (char === '"') quoted = true;
      else if (char === "{") depth++;
      else if (char === "}" && --depth === 0) {
        try { return JSON.parse(html.slice(start, i + 1)); } catch { return null; }
      }
    }
    return null;
  }
  function readVideoMetadata(html) {
    const response = jsonAssignedTo(html, "ytInitialPlayerResponse");
    if (!response || typeof response !== "object" || !response.videoDetails) return null;
    const video = response.videoDetails;
    const info = response.microformat?.playerMicroformatRenderer || {};
    const tracks = response.captions?.playerCaptionsTracklistRenderer?.captionTracks || [];
    const manual = [], automatic = [];
    for (const track of tracks) {
      const lang = language(track.languageCode);
      if (!lang) continue;
      const asr = track.kind === "asr" || String(track.vssId || "").startsWith("a.");
      const list = asr ? automatic : manual;
      if (!list.includes(lang)) list.push(lang);
    }
    const duration = Number(video.lengthSeconds);
    const audio = video.defaultAudioLanguage || info.defaultAudioLanguage || "";
    const date = String(info.publishDate || info.uploadDate || "");
    const category = String(info.category || "");
    return {
      manual, automatic,
      audioLanguage: language(audio),
      category,
      publishDate: /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : "",
      duration: Number.isFinite(duration) && duration >= 0 ? duration : null,
      isLive: Boolean(video.isLiveContent || response.playabilityStatus?.liveStreamability),
    };
  }
  const DEFAULTS = Object.freeze({
    enabled: true, captions: "any", captionLanguage: "", audioLanguage: "", category: "",
    minMinutes: "", maxMinutes: "", minViews: "", maxViews: "",
    fromDate: "", toDate: "", includeTitle: "", excludeTitle: "", includeChannel: "", excludeChannel: "",
    hideShorts: true, hideLive: false, hidePlaylists: false, hideChannels: false, hideShelves: false,
    unknown: "hide",
  });
  function requiresMetadata(f) {
    return f.captions !== "any" || !!f.captionLanguage || !!f.audioLanguage ||
      !!f.category || !!f.fromDate || !!f.toDate;
  }
  function checkCard(card, f, metadata, state) {
    if (!f.enabled) return { show: true };
    const text = normalize(card.title);
    const channel = normalize(card.channel);
    if (f.hideShorts && card.kind === "short") return { show: false, reason: "Shorts" };
    if (f.hideLive && card.isLive) return { show: false, reason: "Live" };
    if (f.hidePlaylists && card.kind === "playlist") return { show: false, reason: "Playlist" };
    if (f.hideChannels && card.kind === "channel") return { show: false, reason: "Channel" };
    if (f.hideShelves && card.kind === "shelf") return { show: false, reason: "Shelf" };
    if (f.includeTitle && !text.includes(normalize(f.includeTitle))) return { show: false, reason: "Title" };
    if (f.excludeTitle && f.excludeTitle.split(",").some(word => normalize(word) && text.includes(normalize(word)))) return { show: false, reason: "Excluded title" };
    if (f.includeChannel && !channel.includes(normalize(f.includeChannel))) return { show: false, reason: "Channel" };
    if (f.excludeChannel && f.excludeChannel.split(",").some(word => normalize(word) && channel.includes(normalize(word)))) return { show: false, reason: "Excluded channel" };
    const effectiveDuration = Number.isFinite(card.duration) ? card.duration : metadata?.duration;
    const min = f.minMinutes === "" ? null : Number(f.minMinutes) * 60;
    const max = f.maxMinutes === "" ? null : Number(f.maxMinutes) * 60;
    if (min !== null || max !== null) {
      if (effectiveDuration === null || !Number.isFinite(effectiveDuration)) return { show: f.unknown === "show", unknown: true };
      if (min !== null && effectiveDuration < min) return { show: false, reason: "Too short" };
      if (max !== null && effectiveDuration > max) return { show: false, reason: "Too long" };
    }
    const viewsMin = f.minViews === "" ? null : Number(f.minViews);
    const viewsMax = f.maxViews === "" ? null : Number(f.maxViews);
    if (viewsMin !== null || viewsMax !== null) {
      if (card.views === null || !Number.isFinite(card.views)) return { show: f.unknown === "show", unknown: true };
      if (viewsMin !== null && card.views < viewsMin) return { show: false, reason: "Too few views" };
      if (viewsMax !== null && card.views > viewsMax) return { show: false, reason: "Too many views" };
    }
    if (!requiresMetadata(f) || !card.videoId) return { show: !requiresMetadata(f) || f.unknown === "show", unknown: requiresMetadata(f) && !card.videoId };
    if (!metadata) return { show: f.unknown === "show", unknown: true, pending: state === "pending" };
    if (f.captions === "manual" && !metadata.manual.length) return { show: false, reason: "No manual captions" };
    if (f.captions === "automatic" && !metadata.automatic.length) return { show: false, reason: "No automatic captions" };
    if (f.captions === "captioned" && !metadata.manual.length && !metadata.automatic.length)
      return { show: false, reason: "No captions" };
    if (f.captionLanguage && !metadata.manual.includes(f.captionLanguage)) return { show: false, reason: "Caption language" };
    if (f.audioLanguage) {
      if (!metadata.audioLanguage) return { show: f.unknown === "show", unknown: true };
      if (metadata.audioLanguage !== f.audioLanguage) return { show: false, reason: "Audio language" };
    }
    if (f.category) {
      if (!metadata.category) return { show: f.unknown === "show", unknown: true };
      if (normalize(metadata.category) !== normalize(f.category)) return { show: false, reason: "Category" };
    }
    if (f.fromDate || f.toDate) {
      if (!metadata.publishDate) return { show: f.unknown === "show", unknown: true };
      if (f.fromDate && metadata.publishDate < f.fromDate) return { show: false, reason: "Date" };
      if (f.toDate && metadata.publishDate > f.toDate) return { show: false, reason: "Date" };
    }
    return { show: true };
  }
  root.YTBF = { normalize, language, parseTime, parseNumber, jsonAssignedTo, readVideoMetadata, DEFAULTS, requiresMetadata, checkCard };
})(globalThis);
