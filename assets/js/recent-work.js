async function loadRecentWork() {
  const container = document.getElementById("recent-work-list");
  if (!container) return;

  try {
    const response = await fetch("./assets/data/recent-work.json", { cache: "no-store" });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);

    const works = await response.json();
    if (!Array.isArray(works) || works.length === 0) {
      container.innerHTML = "<p>No public works found in ORCID yet.</p>";
      return;
    }

    container.innerHTML = `
      <ol class="pub-list">
        ${works.map(renderWork).join("")}
      </ol>
    `;
  } catch (error) {
    console.error("Failed to load recent work:", error);
    container.innerHTML = "<p>Recent work is temporarily unavailable.</p>";
  }
}

function renderWork(work) {
  const title = escapeHtml(work.title || "Untitled");
  const authors = work.authors ? `<span class="pub-authors">${escapeHtml(work.authors)}</span><br>` : "";

  const venueParts = [];
  if (work.venue) venueParts.push(escapeHtml(work.venue));
  if (work.year) venueParts.push(escapeHtml(String(work.year)));
  const venue = venueParts.length ? `<span class="pub-venue">${venueParts.join(", ")}</span><br>` : "";

  const links = [];
  if (work.url) {
    links.push(`<a href="${encodeURI(work.url)}" target="_blank" rel="noopener noreferrer">Link</a>`);
  }
  if (work.doi) {
    links.push(`<a href="https://doi.org/${encodeURIComponent(work.doi)}" target="_blank" rel="noopener noreferrer">DOI</a>`);
  }
  const linkHtml = links.length ? `<span class="pub-links">${links.join(" · ")}</span>` : "";

  return `
    <li>
      <span class="pub-title"><strong>${title}</strong></span><br>
      ${authors}
      ${venue}
      ${linkHtml}
    </li>
  `;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

document.addEventListener("DOMContentLoaded", loadRecentWork);
