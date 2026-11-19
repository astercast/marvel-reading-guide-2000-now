// Marvel Reading Guide — plain renderer over data/guide.json
// Layers: GUIDE.collections = Earth-616 main order only.
// GUIDE.side_tracks = alternate universes, rendered as callouts at their
// anchor collection (begins_at_anchor), never interleaved in the main list.
// GUIDE.primers = character primers, attached to their anchor collection
// (attach_to) and to matching character names — shown as popovers.
// GUIDE.character_tracks = alternate per-character reading paths; the
// track selector swaps the main list for one track's ordered steps.
// Progress: localStorage "marvel-guide-progress-v1" = {collectionId: true}
const LS_KEY = "marvel-guide-progress-v1";
let GUIDE = { collections: [], side_tracks: [], primers: [], character_tracks: [] };
let progress = {};
try { progress = JSON.parse(localStorage.getItem(LS_KEY) || "{}"); } catch (e) { progress = {}; }

// Lookup maps, built once the data lands.
let BY_ID = {};          // main collection id -> collection
let ERA_BY_ID = {};      // era id -> era record (name / years for display)
let SIDE_BY_ID = {};     // side collection id -> {track, collection}
let PRIMERS_BY_ATTACH = {}; // main collection id -> [primer indexes]
let PRIMERS_BY_CHAR = {};   // character tag -> [primer indexes]

const $ = (id) => document.getElementById(id);
function saveProgress() { localStorage.setItem(LS_KEY, JSON.stringify(progress)); }
function esc(s) { return String(s ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c])); }
function isVerified(c) { return String(c.status || "").startsWith("verified"); }
function needsAttention(c) { return ["partial","mismatch","unresolved","not_on_app"].includes(c.status); }

// "1,2,3,5" -> "1-3, 5" for compact segment issue lists.
function compressNums(nums) {
  const out = []; let run = [];
  const flush = () => { if (run.length) { out.push(run.length > 1 ? run[0] + "-" + run[run.length - 1] : run[0]); run = []; } };
  for (const x of nums || []) {
    if (/^\d+$/.test(x)) {
      if (run.length && parseInt(x, 10) !== parseInt(run[run.length - 1], 10) + 1) flush();
      run.push(x);
    } else { flush(); out.push(x); }
  }
  flush(); return out.join(", ");
}

// Split series (M17): a collection whose issues live under more than one
// app series ID says which issues sit in which bucket, with links.
function segmentsHTML(c) {
  const segs = (c.series_segments || []).filter(s => (s.collection_issues || s.issues || []).length);
  if (!segs.length) return "";
  if (segs.length === 1 && segs[0].seriesId === c.seriesId) return "";
  const parts = segs.map(s => {
    const nums = s.collection_issues || s.issues || [];
    const label = "#" + compressNums(nums);
    return s.series_link
      ? `${esc(label)} → <a href="${esc(s.series_link)}" target="_blank" rel="noopener">Series ${esc(s.seriesId)}</a>`
      : `${esc(label)} → Series ${esc(s.seriesId)}`;
  }).join(" · ");
  return `<p class="segments"><strong>Split across app series:</strong> ${parts}</p>`;
}

function primerChips(indexes) {
  return indexes.map(i => {
    const p = GUIDE.primers[i];
    return `<button type="button" class="primer-chip" data-primers="${i}">${esc(p.name)}</button>`;
  }).join(" ");
}

function eraYears(id) {
  const e = ERA_BY_ID[id];
  return e && e.years ? e.years : id;
}

function collectionHTML(c, label) {
  const eraChip = c.era ? `<span>${esc(eraYears(c.era))}</span>` : "";
  const arcChip = c.arc ? `<span>${esc(c.arc)}</span>` : "";
  const eventChip = c.event
    ? `<span class="event-badge">${esc(c.event + (c.event_phase ? " · " + c.event_phase : ""))}</span>` : "";
  const tierBadge = c.tier
    ? `<span class="tier-badge tier-${esc(c.tier)}">${esc(c.tier)}</span>` : "";
  const badges = eraChip + arcChip + eventChip + tierBadge;
  const issueList = Array.isArray(c.issues) ? c.issues : [];
  const issueItems = issueList.map(i =>
    `<li><a href="${esc(i.link)}" target="_blank" rel="noopener">#${esc(i.number)}</a> ${esc(i.title || "")} <small>${esc(i.date || "")}</small></li>`).join("");
  const attached = PRIMERS_BY_ATTACH[c.id] || [];
  const chars = (c.characters || []).map(ch => {
    const idxs = PRIMERS_BY_CHAR[ch];
    return idxs ? `<button type="button" class="primer-chip" data-primers="${idxs.join(",")}">${esc(ch)}</button>` : esc(ch);
  }).join(" · ");
  const media = c.cover_url
    ? `<div class="card-media"><img class="cover" src="${esc(c.cover_url)}" alt="" loading="lazy" decoding="async"></div>` : "";
  return `${media}
    <div class="card-body">
    ${c.chapter ? `<p class="kicker">${esc(c.chapter)}</p>` : ""}
    <h3><label><input type="checkbox" data-id="${esc(c.id)}" ${progress[c.id] ? "checked" : ""}>
    ${esc(label)} ${esc(c.guide_title)}</label></h3>
    <div class="badges">${badges} <span class="status-badge status-${esc(c.status)}">${esc(c.status)}</span></div>
    ${chars ? `<p class="chars">Featuring: ${chars}</p>` : ""}
    ${c.why ? `<p class="why">${esc(c.why)}</p>` : ""}
    ${c.creators ? `<p class="why">By ${esc(c.creators)}</p>` : ""}
    <p class="read-row">${c.first_issue_link
      ? `<a class="start-link" href="${esc(c.first_issue_link)}" target="_blank" rel="noopener">▶ Start reading</a>`
      : `<strong class="no-link">No verified link yet</strong>`}
    ${c.series_link ? `<a class="series-link" href="${esc(c.series_link)}" target="_blank" rel="noopener">Series page</a>` : ""}</p>
    ${segmentsHTML(c)}
    ${attached.length ? `<p class="whoswho"><strong>Who's who:</strong> ${primerChips(attached)}</p>` : ""}
    ${issueItems ? `<details><summary>All ${issueList.length} issues</summary><ol class="issues">${issueItems}</ol></details>` : ""}
    ${c.note ? `<p class="why"><small>Note: ${esc(c.note)}</small></p>` : ""}
    </div>`;
}

function sideTrackHTML(st) {
  const cross = st.crosses_into_main || {};
  const cols = (st.collections || []).map(c =>
    `<div class="collection${progress[c.id] ? " done" : ""}">${collectionHTML(c, "S" + (c.order ?? "") + ".")}</div>`).join("");
  return `<div class="sidetrack">
    <h3>↳ Side track: ${esc(st.side_track_name)}</h3>
    ${st.blurb ? `<p class="why">${esc(st.blurb)}</p>` : ""}
    ${st.suggested_read_window ? `<p class="why"><strong>When to read:</strong> ${esc(st.suggested_read_window)}</p>` : ""}
    <p class="why"><strong>Crosses into the main universe:</strong> ${cross.crosses ? "Yes — " + esc(cross.where || "") : "No" + (cross.where ? " — " + esc(cross.where) : "")}</p>
    <details><summary>Side track reading list (${(st.collections || []).length} collections)</summary>${cols}</details>
  </div>`;
}

// Compact row for a side-track collection referenced from a character
// track step — full cards would bury the step list when a step cites a
// whole side run.
function sideRefHTML(ref) {
  const hit = SIDE_BY_ID[ref.id];
  if (!hit) return "";
  const c = hit.collection;
  return `<div class="side-ref${progress[c.id] ? " done" : ""}">
    <label><input type="checkbox" data-id="${esc(c.id)}" ${progress[c.id] ? "checked" : ""}>
    ↳ ${esc(hit.track.side_track_name)} S${esc(ref.order ?? c.order ?? "")}. ${esc(c.guide_title)}</label>
    <span class="status-${esc(c.status)}">${esc(c.status)}</span>
    ${c.first_issue_link ? ` · <a href="${esc(c.first_issue_link)}" target="_blank" rel="noopener">Start reading</a>` : ""}
    ${c.series_link ? ` · <a href="${esc(c.series_link)}" target="_blank" rel="noopener">Series page</a>` : ""}
    ${segmentsHTML(c)}
  </div>`;
}

function stripCite(s) { return String(s || "").replace(/^\[[^\]]*\]\s*/, ""); }

function trackStepHTML(track, s) {
  const label = stripCite(s.label);
  let body = stripCite(s.text);
  if (label && body.startsWith(label)) body = body.slice(label.length).replace(/^[\s—–-]+/, "");
  const badges = [s.kind && s.kind !== "step" ? s.kind : "", s.citation, s.thread ? "Thread: " + s.thread : ""]
    .filter(Boolean).map(b => `<span>${esc(b)}</span>`).join("");
  const cards = (s.collection_ids || []).map(id => BY_ID[id]).filter(Boolean).map(c =>
    `<div class="collection${progress[c.id] ? " done" : ""}">${collectionHTML(c, "Main order " + (c.order ?? "") + ".")}</div>`).join("");
  const refs = (s.side_refs || []).map(sideRefHTML).join("");
  return `<section class="track-step">
    <h3>Step ${esc(s.n)}. ${esc(label)}</h3>
    ${badges ? `<div class="badges">${badges}</div>` : ""}
    ${body ? `<p class="why">${esc(body)}</p>` : ""}
    ${cards}
    ${refs}
    ${!cards && !refs ? `<p class="why"><small>No collection matched this step yet — it points at a guide section or a known gap (see the step text).</small></p>` : ""}
  </section>`;
}

function matchesFilters(c, f) {
  if (f.era && c.era !== f.era) return false;
  if (f.tier && c.tier !== f.tier) return false;
  if (f.ev && c.event !== f.ev) return false;
  if (f.character && !(c.characters || []).includes(f.character)) return false;
  if (f.status === "verified" && !isVerified(c)) return false;
  if (f.status === "needs-attention" && !needsAttention(c)) return false;
  if (f.hideDone && progress[c.id]) return false;
  if (f.q) {
    const hay = [c.guide_title, c.series_name, c.arc, c.event, c.chapter,
                 (c.characters || []).join(" "), c.creators, c.why].join(" ").toLowerCase();
    if (!hay.includes(f.q)) return false;
  }
  return true;
}

function bindCheckboxes(list) {
  list.querySelectorAll('input[type="checkbox"][data-id]').forEach(cb => {
    cb.addEventListener("change", () => {
      if (cb.checked) progress[cb.dataset.id] = true; else delete progress[cb.dataset.id];
      saveProgress(); render();
    });
  });
}

function render() {
  const trackId = $("f-track").value;
  const list = $("list");
  list.innerHTML = "";
  if (trackId) {
    // Character-track view: the track's own order replaces the main list;
    // the other filters pause (the progress line says so).
    const track = (GUIDE.character_tracks || []).find(t => t.id === trackId);
    if (track) {
      for (const s of track.steps) {
        const el = document.createElement("div");
        el.innerHTML = trackStepHTML(track, s);
        list.appendChild(el);
      }
      const ids = new Set();
      for (const s of track.steps) {
        for (const id of s.collection_ids || []) ids.add(id);
        for (const r of s.side_refs || []) ids.add(r.id);
      }
      const done = [...ids].filter(id => progress[id]).length;
      $("progress-line").textContent =
        `Character track: ${track.name} — ${track.steps.length} steps · ${ids.size} collections (${done} read) · other filters are paused in track view`;
      $("progress-fill").style.width = (ids.size ? Math.round(100 * done / ids.size) : 0) + "%";
    }
    $("empty").hidden = true;
    bindCheckboxes(list);
    return;
  }
  const f = { q: $("q").value.trim().toLowerCase(), era: $("f-era").value,
    tier: $("f-tier").value, ev: $("f-event").value, character: $("f-character").value,
    status: $("f-status").value, hideDone: $("f-hide-done").checked };
  const byAnchor = {};
  for (const st of GUIDE.side_tracks || []) {
    (byAnchor[st.begins_at_anchor] = byAnchor[st.begins_at_anchor] || []).push(st);
  }
  let shown = 0;
  let lastEra = null;
  for (const c of GUIDE.collections) {
    if (!matchesFilters(c, f)) continue;
    shown++;
    // Era chapter divider whenever the visible flow crosses into a new era.
    if (c.era && c.era !== lastEra) {
      lastEra = c.era;
      const era = ERA_BY_ID[c.era];
      if (era) {
        const div = document.createElement("div");
        div.className = "era-divider";
        const num = String((GUIDE.eras || []).indexOf(era) + 1).padStart(2, "0");
        div.innerHTML = `<span class="era-num">${esc(num)}</span><h2>${esc(era.name)}</h2>` +
          (era.years ? `<span class="era-years">${esc(era.years)}</span>` : "");
        list.appendChild(div);
      }
    }
    const el = document.createElement("article");
    el.className = "collection" + (progress[c.id] ? " done" : "");
    el.innerHTML = collectionHTML(c, (c.order ?? "") + ".");
    list.appendChild(el);
    // Side tracks anchored here render as callouts, outside the numbered flow.
    for (const st of byAnchor[c.id] || []) {
      const callout = document.createElement("section");
      callout.innerHTML = sideTrackHTML(st);
      list.appendChild(callout);
    }
  }
  $("empty").hidden = shown > 0;
  const ftAll = GUIDE.collections.filter(c => c.tier === "must-read");
  const ftDone = ftAll.filter(c => progress[c.id]).length;
  const ftPct = ftAll.length ? Math.round(100 * ftDone / ftAll.length) : 0;
  $("progress-line").textContent = `${ftDone} / ${ftAll.length} fast-track stops read (${ftPct}%) · showing ${shown} · side tracks are extra, anchored where they branch off`;
  $("progress-fill").style.width = ftPct + "%";
  bindCheckboxes(list);
}

// ---- primer popover (one shared modal; delegation survives re-renders)
function openPrimers(indexes) {
  const ps = indexes.map(i => GUIDE.primers[i]).filter(Boolean);
  if (!ps.length) return;
  $("primer-modal-title").textContent = ps.length === 1 ? ps[0].name : "Character primers";
  $("primer-modal-body").innerHTML = ps.map(p => `
    ${ps.length > 1 ? `<h4>${esc(p.name)}</h4>` : ""}
    <p class="why"><small>${esc([p.anchor_chapter, p.anchor_series].filter(Boolean).join(" · "))}</small></p>
    <p>${esc(p.text)}</p>`).join("");
  $("primer-modal").hidden = false;
}
function closePrimers() { $("primer-modal").hidden = true; }
document.addEventListener("click", (e) => {
  const chip = e.target.closest("[data-primers]");
  if (chip) {
    openPrimers(chip.dataset.primers.split(",").map(x => parseInt(x, 10)));
    return;
  }
  if (e.target === $("primer-modal")) closePrimers();
});
document.addEventListener("keydown", (e) => { if (e.key === "Escape") closePrimers(); });

// A cover that fails to load (dead CDN link) removes its media block so
// the card falls back to the clean text layout, never a broken-image box.
document.addEventListener("error", (e) => {
  const t = e.target;
  if (t && t.classList && t.classList.contains("cover")) {
    const wrap = t.closest(".card-media");
    if (wrap) wrap.remove();
  }
}, true);

function fillFilter(id, values) {
  const sel = $(id);
  for (const v of [...new Set(values.filter(Boolean))].sort()) {
    const o = document.createElement("option"); o.value = v; o.textContent = v; sel.appendChild(o);
  }
}

fetch("data/guide.json")
  .then(r => r.json())
  .then(data => {
    GUIDE = data;
    BY_ID = {};
    for (const c of data.collections) BY_ID[c.id] = c;
    ERA_BY_ID = {};
    for (const e of data.eras || []) ERA_BY_ID[e.id] = e;
    SIDE_BY_ID = {};
    for (const st of data.side_tracks || []) {
      for (const c of st.collections || []) SIDE_BY_ID[c.id] = { track: st, collection: c };
    }
    PRIMERS_BY_ATTACH = {};
    PRIMERS_BY_CHAR = {};
    (data.primers || []).forEach((p, i) => {
      if (p.attach_to) (PRIMERS_BY_ATTACH[p.attach_to] = PRIMERS_BY_ATTACH[p.attach_to] || []).push(i);
    });
    for (const ch of new Set(data.collections.flatMap(c => c.characters || []))) {
      const idxs = [];
      (data.primers || []).forEach((p, i) => {
        if (p.name === ch || p.name.startsWith(ch + " —")) idxs.push(i);
      });
      if (idxs.length) PRIMERS_BY_CHAR[ch] = idxs;
    }
    const eraNotes = (data.eras || []).filter(e => e.blurb || e.skipped).map(e =>
      `<div class="collection"><h3>${esc(e.name)} <small>${esc(e.years || "")}</small></h3>` +
      (e.blurb ? `<p class="why">${esc(e.blurb)}</p>` : "") +
      (e.skipped ? `<p class="why"><strong>Skipped:</strong> ${esc(e.skipped)}</p>` : "") + `</div>`).join("");
    $("era-notes").innerHTML = eraNotes ? `<h2>Eras — what's in, what's skipped</h2>${eraNotes}` : "";
    const ftCols = data.collections.filter(c => c.tier === "must-read");
    const ftIssues = ftCols.reduce((a, c) => a + ((c.issues && c.issues.length) ? c.issues.length : (c.issue_numbers || []).length), 0);
    $("meta-line").textContent =
      `The fast track: ${ftCols.length} stops · ${ftIssues} issues · the full order holds ${data.meta?.collections_count ?? data.collections.length} main (Earth-616) collections · ${data.meta?.verified_count ?? "?"} verified · ${(data.side_tracks || []).length} side tracks · ${(data.primers || []).length} character primers · ${(data.character_tracks || []).length} character tracks · data ${data.meta?.generated ?? ""}`;
    fillFilter("f-era", data.collections.map(c => c.era));
    fillFilter("f-event", data.collections.map(c => c.event));
    fillFilter("f-character", data.collections.flatMap(c => c.characters || []));
    const trackSel = $("f-track");
    for (const t of data.character_tracks || []) {
      const o = document.createElement("option");
      o.value = t.id;
      o.textContent = `${t.name} (${t.steps.length} steps)`;
      trackSel.appendChild(o);
    }
    ["q","f-era","f-tier","f-event","f-character","f-status","f-hide-done","f-track"].forEach(id =>
      $(id).addEventListener("input", render));
    $("reset-progress").addEventListener("click", () => { progress = {}; saveProgress(); render(); });
    $("primer-modal-close").addEventListener("click", closePrimers);
    render();
  })
  .catch(e => { $("meta-line").textContent = "Could not load data/guide.json — " + e; });
