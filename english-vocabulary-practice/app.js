const WORDS_PER_ROUND = 10;

// Common-word list only. Definitions are fetched separately.
// This file is public and works well for a static GitHub Pages site.
const WORD_LIST_URL =
  "https://raw.githubusercontent.com/first20hours/google-10000-english/master/google-10000-english-no-swears.txt";

// Tiny fallback only. You do not need to maintain this unless you want to.
const FALLBACK_WORDS = [
  "adjust", "admit", "afford", "approach", "assume", "avoid", "benefit", "bother",
  "brief", "challenge", "common", "compare", "concern", "confident", "consider",
  "convenient", "curious", "decent", "decline", "delay", "deserve", "develop",
  "effort", "encourage", "familiar", "flexible", "focus", "gentle", "handle",
  "hesitate", "honest", "ignore", "improve", "issue", "likely", "manage",
  "matter", "mention", "ordinary", "patient", "perhaps", "plenty", "polite",
  "prefer", "pressure", "pretend", "purpose", "realize", "reasonable",
  "recover", "regret", "remind", "require", "respect", "rough", "settle",
  "slightly", "specific", "steady", "struggle", "suggest", "support", "survive",
  "typical", "unless", "upset", "useful", "value", "waste", "wonder", "worth"
];

const state = {
  wordPool: [],
  currentWords: [],
  showDetails: true,
  loading: false
};

const grid = document.querySelector("#word-grid");
const statusBox = document.querySelector("#status");
const wordCount = document.querySelector("#word-count");
const newWordsBtn = document.querySelector("#new-words-btn");
const toggleDetailsBtn = document.querySelector("#toggle-details-btn");
const copyBtn = document.querySelector("#copy-btn");

function shuffle(array) {
  const arr = [...array];
  for (let i = arr.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function escapeHtml(text) {
  return String(text || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

async function fetchWithTimeout(url, options = {}, timeoutMs = 7000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(url, {
      ...options,
      signal: controller.signal
    });
  } finally {
    clearTimeout(timer);
  }
}

async function loadWordPool() {
  const cacheKey = "vocab-word-pool-definition-only-v1";
  const cached = localStorage.getItem(cacheKey);

  if (cached) {
    try {
      const parsed = JSON.parse(cached);
      const oneWeek = 7 * 24 * 60 * 60 * 1000;
      if (Array.isArray(parsed.words) && Date.now() - parsed.time < oneWeek) {
        state.wordPool = parsed.words;
        wordCount.textContent = `Online word pool: ${state.wordPool.length} common words`;
        return;
      }
    } catch {
      localStorage.removeItem(cacheKey);
    }
  }

  try {
    const response = await fetchWithTimeout(WORD_LIST_URL, {}, 8000);
    if (!response.ok) throw new Error(`Word list request failed: ${response.status}`);

    const text = await response.text();
    const rawWords = text
      .split(/\s+/)
      .map(w => w.trim().toLowerCase())
      .filter(Boolean);

    // Skip extremely basic words like "the", "and", "you".
    // Keep a practical middle-frequency range, then filter weird items.
    const usefulWords = rawWords
      .slice(300, 7000)
      .filter(w => /^[a-z]+$/.test(w))
      .filter(w => w.length >= 4 && w.length <= 13);

    state.wordPool = [...new Set(usefulWords)];

    localStorage.setItem(cacheKey, JSON.stringify({
      time: Date.now(),
      words: state.wordPool
    }));

    wordCount.textContent = `Online word pool: ${state.wordPool.length} common words`;
  } catch (error) {
    console.warn(error);
    state.wordPool = FALLBACK_WORDS;
    wordCount.textContent = `Fallback word pool: ${state.wordPool.length} words`;
    statusBox.textContent = "Could not fetch the online word pool, so I used the tiny built-in fallback list.";
  }
}

function extractDictionaryInfo(data, requestedWord) {
  if (!Array.isArray(data) || data.length === 0) return null;

  const entry = data[0];
  const meanings = entry.meanings || [];

  const candidates = [];
  for (const meaning of meanings) {
    for (const def of meaning.definitions || []) {
      if (!def.definition) continue;
      candidates.push({
        partOfSpeech: meaning.partOfSpeech || "",
        definition: def.definition,
        synonyms: def.synonyms || [],
        antonyms: def.antonyms || []
      });
    }
  }

  if (candidates.length === 0) return null;

  // Prefer short, clear definitions.
  const chosen =
    candidates.find(c => c.definition.length <= 160) ||
    candidates.find(c => c.definition.length <= 220) ||
    candidates[0];

  const phonetic =
    entry.phonetic ||
    (entry.phonetics || []).find(p => p.text)?.text ||
    "";

  return {
    word: entry.word || requestedWord,
    phonetic,
    partOfSpeech: chosen.partOfSpeech,
    definition: chosen.definition,
    synonyms: chosen.synonyms.slice(0, 5),
    antonyms: chosen.antonyms.slice(0, 5)
  };
}

async function fetchDefinition(word) {
  const cacheKey = `vocab-definition-v1:${word}`;
  const cached = localStorage.getItem(cacheKey);

  if (cached) {
    try {
      const parsed = JSON.parse(cached);
      const thirtyDays = 30 * 24 * 60 * 60 * 1000;
      if (parsed.info && Date.now() - parsed.time < thirtyDays) {
        return parsed.info;
      }
    } catch {
      localStorage.removeItem(cacheKey);
    }
  }

  const url = `https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(word)}`;

  try {
    const response = await fetchWithTimeout(url, {}, 7000);
    if (!response.ok) return null;
    const data = await response.json();
    const info = extractDictionaryInfo(data, word);

    if (info) {
      localStorage.setItem(cacheKey, JSON.stringify({
        time: Date.now(),
        info
      }));
    }

    return info;
  } catch (error) {
    console.warn("Definition failed:", word, error);
    return null;
  }
}

async function buildCard(word, rank) {
  const info = await fetchDefinition(word);
  if (!info) return null;

  return {
    ...info,
    rank
  };
}

function renderLoadingCards() {
  grid.innerHTML = Array.from({ length: WORDS_PER_ROUND }, () => `
    <article class="card loading" aria-label="Loading vocabulary card"></article>
  `).join("");
}

function render() {
  grid.innerHTML = state.currentWords.map((item, index) => {
    const synonyms = item.synonyms?.length ? item.synonyms.join(", ") : "";
    const antonyms = item.antonyms?.length ? item.antonyms.join(", ") : "";

    return `
      <article class="card">
        <div class="card-header">
          <h2 class="word">${index + 1}. ${escapeHtml(item.word)}</h2>
          <span class="rank">rank ~${escapeHtml(item.rank)}</span>
        </div>

        <div class="details ${state.showDetails ? "" : "hidden"}">
          <p class="part">
            ${escapeHtml(item.partOfSpeech || "word")}
            ${item.phonetic ? `<span class="phonetic">${escapeHtml(item.phonetic)}</span>` : ""}
          </p>

          <p class="meaning">${escapeHtml(item.definition)}</p>

          ${synonyms ? `<p class="extra"><strong>Similar:</strong> ${escapeHtml(synonyms)}</p>` : ""}
          ${antonyms ? `<p class="extra"><strong>Opposite:</strong> ${escapeHtml(antonyms)}</p>` : ""}

          <p class="source">Source: Free Dictionary API</p>
        </div>
      </article>
    `;
  }).join("");
}

async function pickWords() {
  if (state.loading) return;
  state.loading = true;
  newWordsBtn.disabled = true;
  copyBtn.disabled = true;

  state.currentWords = [];
  statusBox.textContent = "Fetching definitions...";
  renderLoadingCards();

  const pool = state.wordPool.length ? state.wordPool : FALLBACK_WORDS;
  const shuffled = shuffle(pool);
  const results = [];
  let tries = 0;

  // Some words from a frequency list may not have a clean dictionary entry.
  // Try extra words until we have 10 good cards.
  for (const word of shuffled) {
    if (results.length >= WORDS_PER_ROUND) break;
    if (tries >= 60) break;
    tries += 1;

    const rank = pool.indexOf(word) + 301;
    const card = await buildCard(word, rank);
    if (card) {
      results.push(card);
      statusBox.textContent = `Loaded ${results.length}/${WORDS_PER_ROUND} words...`;
    }
  }

  state.currentWords = results;
  state.loading = false;
  newWordsBtn.disabled = false;
  copyBtn.disabled = false;

  if (results.length < WORDS_PER_ROUND) {
    statusBox.textContent = `Loaded ${results.length} words. Some online definition requests failed; try “New 10 words” again.`;
  } else {
    statusBox.textContent = "Ready.";
  }

  render();
}

function toggleDetails() {
  state.showDetails = !state.showDetails;
  toggleDetailsBtn.textContent = state.showDetails ? "Hide explanations" : "Show explanations";
  toggleDetailsBtn.setAttribute("aria-pressed", String(state.showDetails));
  render();
}

async function copyList() {
  const text = state.currentWords.map((item, index) => {
    const similar = item.synonyms?.length ? `\nSimilar: ${item.synonyms.join(", ")}` : "";
    const opposite = item.antonyms?.length ? `\nOpposite: ${item.antonyms.join(", ")}` : "";

    return `${index + 1}. ${item.word}
Part of speech: ${item.partOfSpeech || ""}
Meaning: ${item.definition}${similar}${opposite}`;
  }).join("\n\n");

  try {
    await navigator.clipboard.writeText(text);
    copyBtn.textContent = "Copied";
    setTimeout(() => copyBtn.textContent = "Copy list", 900);
  } catch {
    const fallback = document.createElement("textarea");
    fallback.value = text;
    document.body.appendChild(fallback);
    fallback.select();
    document.execCommand("copy");
    fallback.remove();
    copyBtn.textContent = "Copied";
    setTimeout(() => copyBtn.textContent = "Copy list", 900);
  }
}

newWordsBtn.addEventListener("click", pickWords);
toggleDetailsBtn.addEventListener("click", toggleDetails);
copyBtn.addEventListener("click", copyList);

(async function init() {
  await loadWordPool();
  await pickWords();
})();
