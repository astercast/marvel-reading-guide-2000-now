// Marvel Reading Guide: simple renderer over data/guide.json
// Main list: GUIDE.collections in guide order. The Fast track view shows
// only the must-read stops; the Full list view shows every stop.
// Side tracks: GUIDE.side_tracks, shown as plain boxes at their anchor
// collection (begins_at_anchor), never mixed into the numbered list.
// Progress: localStorage "marvel-guide-progress-v1" = {collectionId: true}
const LS_KEY = "marvel-guide-progress-v1";
let GUIDE = { collections: [], side_tracks: [], eras: [] };
let ERA_BY_ID = {};
let progress = {};
let viewMode = "fast";
try { progress = JSON.parse(localStorage.getItem(LS_KEY) || "{}"); } catch (e) { progress = {}; }

const $ = (id) => document.getElementById(id);
function saveProgress() { localStorage.setItem(LS_KEY, JSON.stringify(progress)); }
function esc(s) { return String(s ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c])); }

// Marvel app handoff links. Each issue page on marvelcomicsapp.com has an
// Open the app control that builds an AppsFlyer OneLink URL in code. These
// helpers build that same format from a numeric id. With the app installed
// the link opens the comic in the app; without it, the link lands on the
// app store page instead.
function parseIdFromLink(link, kind) {
  const m = String(link || "").match(new RegExp("/" + kind + "/(\\d+)"));
  return m ? m[1] : null;
}

function appIssueLink(issueId) {
  if (issueId === null || issueId === undefined || issueId === "") return "";
  const deep = encodeURIComponent("marvelcomicsapp://issueHome?issueId=" + issueId);
  return "https://goto.marvelcomicsapp.com/w9za?pid=MCWeb&c=WtA_IssueHome&af_channel=MoWeb&af_dp=" + deep +
    "&deep_link_value=" + deep + "&issueId=" + issueId + "&af_force_deeplink=true&af_ss_ui=true";
}

function appSeriesLink(seriesId) {
  if (seriesId === null || seriesId === undefined || seriesId === "") return "";
  const deep = encodeURIComponent("marvelcomicsapp://seriesHome?seriesId=" + seriesId);
  return "https://goto.marvelcomicsapp.com/w9za?pid=MCWeb&c=WtA_SeriesHome&af_channel=MoWeb&af_dp=" + deep +
    "&deep_link_value=" + deep + "&seriesId=" + seriesId + "&af_force_deeplink=true&af_ss_ui=true";
}

function issueAppLink(issue) {
  if (!issue) return "";
  if (issue.issueId !== null && issue.issueId !== undefined && issue.issueId !== "") return appIssueLink(issue.issueId);
  const id = parseIdFromLink(issue.link, "issues");
  return id ? appIssueLink(id) : "";
}

function seriesAppLink(c) {
  const id = parseIdFromLink(c.series_link, "series") || (c.seriesId ? String(c.seriesId) : null);
  return id ? appSeriesLink(id) : "";
}

// The Read in the app target for a stop: its first issue when we have one,
// otherwise its series page, otherwise empty (not in the app yet).
function readAppLink(c) {
  const issues = Array.isArray(c.issues) ? c.issues : [];
  if (issues.length) {
    const first = issueAppLink(issues[0]);
    if (first) return first;
  }
  const fromFirst = parseIdFromLink(c.first_issue_link, "issues");
  if (fromFirst) return appIssueLink(fromFirst);
  if (c.first_issueId !== null && c.first_issueId !== undefined && c.first_issueId !== "") return appIssueLink(c.first_issueId);
  return seriesAppLink(c);
}

function issueCount(c) {
  if (Array.isArray(c.issues) && c.issues.length) return c.issues.length;
  if (Array.isArray(c.issue_numbers)) return c.issue_numbers.length;
  return 0;
}

// The why field starts with a writer credit, then a separator, then tier
// notes and other research text. Keep only a short clean writer line.
function authorLine(c) {
  const why = String(c.why || "");
  const sep = " \u00B7 ";
  const cut = why.indexOf(sep);
  const first = (cut >= 0 ? why.slice(0, cut) : why).trim();
  if (!first.startsWith("Writer:")) return "";
  if (first.length >= 120) return "";
  if (first.includes("\u2014") || first.includes("\u2013")) return "";
  return first;
}

function tierWord(c) {
  if (c.tier === "must-read") return "Fast track";
  if (c.tier === "expert-depth") return "Extra";
  if (c.tier === "completionist") return "For completists";
  return "";
}

function detailsHTML(c) {
  const parts = [];
  const author = authorLine(c);
  if (author) parts.push(`<p class="detail-line">${esc(author)}</p>`);
  const tier = tierWord(c);
  if (tier) parts.push(`<p class="detail-line">List: ${esc(tier)}</p>`);
  const issues = Array.isArray(c.issues) ? c.issues : [];
  if (issues.length) {
    const items = issues.map(i =>
      `<li><a href="${esc(issueAppLink(i) || i.link || "")}">#${esc(i.number)}</a> <span>${esc(i.title || "")}</span> <small>${esc(i.date || "")}</small></li>`).join("");
    parts.push(`<ol class="issues">${items}</ol>`);
  } else if (Array.isArray(c.issue_numbers) && c.issue_numbers.length) {
    const items = c.issue_numbers.map(n => `<li>#${esc(n)}</li>`).join("");
    parts.push(`<ol class="issues">${items}</ol>`);
  }
  if (c.series_link) {
    parts.push(`<p class="detail-line"><a class="series-link" href="${esc(seriesAppLink(c) || c.series_link)}">Series page in the app</a></p>`);
  }
  if (!parts.length) return "";
  return `<details class="details"><summary>Details</summary><div class="details-body">${parts.join("")}</div></details>`;
}

function cardHTML(c, num) {
  const media = c.cover_url
    ? `<div class="card-media"><img class="cover" src="${esc(c.cover_url)}" alt="" loading="lazy" decoding="async"></div>` : "";
  const count = issueCount(c);
  const countLine = count ? `<p class="count-line">${count} ${count === 1 ? "issue" : "issues"}</p>` : "";
  const eventLine = c.event ? `<p class="event-line">Part of: ${esc(c.event)}</p>` : "";
  const readHref = readAppLink(c);
  const readBtn = readHref
    ? `<a class="start-link" href="${esc(readHref)}">Read in the app</a>`
    : `<span class="no-link">Not in the app yet</span>`;
  return `${media}
    <div class="card-body">
      <div class="card-top">
        <span class="stop-num">${esc(num)}</span>
        <h3>${esc(c.guide_title)}</h3>
      </div>
      ${countLine}
      ${eventLine}
      <div class="read-row">
        ${readBtn}
        <label class="done-row"><input type="checkbox" data-id="${esc(c.id)}" ${progress[c.id] ? "checked" : ""}> Done</label>
      </div>
      ${detailsHTML(c)}
    </div>`;
}

function sideTrackHTML(st) {
  const cols = (st.collections || []).map((c, i) =>
    `<article class="collection${progress[c.id] ? " done" : ""}" data-collection-id="${esc(c.id)}">${cardHTML(c, i + 1)}</article>`).join("");
  return `<div class="sidetrack">
    <h3>Side story: ${esc(st.side_track_name)}</h3>
    <p class="side-note">Optional. It does not change the main story.</p>
    <details class="details"><summary>Details</summary><div class="details-body">${cols}</div></details>
  </div>`;
}

function matchesSearch(c, q) {
  if (!q) return true;
  const hay = [c.guide_title, c.series_name, c.event].join(" ").toLowerCase();
  return hay.includes(q);
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
  const list = $("list");
  list.innerHTML = "";
  const q = $("q").value.trim().toLowerCase();
  const hideDone = $("f-hide-done").checked;
  const byAnchor = {};
  for (const st of GUIDE.side_tracks || []) {
    (byAnchor[st.begins_at_anchor] = byAnchor[st.begins_at_anchor] || []).push(st);
  }
  let shown = 0;
  let lastEra = null;
  for (const c of GUIDE.collections) {
    if (viewMode === "fast" && c.tier !== "must-read") continue;
    if (!matchesSearch(c, q)) continue;
    if (hideDone && progress[c.id]) continue;
    shown++;
    if (c.era && c.era !== lastEra) {
      lastEra = c.era;
      const era = ERA_BY_ID[c.era];
      if (era) {
        const div = document.createElement("div");
        div.className = "era-divider";
        div.innerHTML = `<h2>${esc(era.name)}</h2>` +
          (era.years ? `<span class="era-years">${esc(era.years)}</span>` : "");
        list.appendChild(div);
      }
    }
    const el = document.createElement("article");
    el.className = "collection" + (progress[c.id] ? " done" : "");
    el.dataset.collectionId = c.id;
    el.innerHTML = cardHTML(c, shown);
    list.appendChild(el);
    for (const st of byAnchor[c.id] || []) {
      const box = document.createElement("section");
      box.innerHTML = sideTrackHTML(st);
      list.appendChild(box);
    }
  }
  $("empty").hidden = shown > 0;
  const ftAll = GUIDE.collections.filter(c => c.tier === "must-read");
  const ftDone = ftAll.filter(c => progress[c.id]).length;
  const ftPct = ftAll.length ? Math.round(100 * ftDone / ftAll.length) : 0;
  $("progress-line").textContent = `You finished ${ftDone} of ${ftAll.length} stops.`;
  $("progress-fill").style.width = ftPct + "%";
  bindCheckboxes(list);
}

function setView(mode) {
  viewMode = mode;
  $("view-fast").classList.toggle("active", mode === "fast");
  $("view-full").classList.toggle("active", mode === "full");
  $("view-fast").setAttribute("aria-pressed", mode === "fast" ? "true" : "false");
  $("view-full").setAttribute("aria-pressed", mode === "full" ? "true" : "false");
  render();
}

// A cover that fails to load removes its media block so the card falls
// back to the clean text layout, never a broken image box.
document.addEventListener("error", (e) => {
  const t = e.target;
  if (t && t.classList && t.classList.contains("cover")) {
    const wrap = t.closest(".card-media");
    if (wrap) wrap.remove();
  }
}, true);

fetch("data/guide.json")
  .then(r => r.json())
  .then(data => {
    GUIDE = data;
    ERA_BY_ID = {};
    for (const e of data.eras || []) ERA_BY_ID[e.id] = e;
    $("q").addEventListener("input", render);
    $("f-hide-done").addEventListener("input", render);
    $("view-fast").addEventListener("click", () => setView("fast"));
    $("view-full").addEventListener("click", () => setView("full"));
    $("reset-progress").addEventListener("click", () => { progress = {}; saveProgress(); render(); });
    $("continue-btn").addEventListener("click", () => {
      const next = document.querySelector("#list .collection:not(.done)");
      if (next) next.scrollIntoView({ behavior: "smooth", block: "start" });
    });
    render();
  })
  .catch(e => { $("progress-line").textContent = "Could not load the guide data. " + e; });
