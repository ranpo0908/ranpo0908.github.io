# Vocabulary Practice — Definition Only

This version does not use a local `vocab-data.js` file.

## What it does

- Fetches a common English word pool online.
- Randomly selects 10 practical words.
- Fetches definitions from Free Dictionary API.
- Shows:
  - word
  - part of speech
  - phonetic spelling if available
  - explanation / definition
  - synonyms and antonyms if available
- No sample sentences are required.
- Uses a tiny fallback word list only when the online word pool cannot be loaded.

## Files

```text
vocab-practice-definition-only/
  index.html
  style.css
  app.js
  README.md
```

## Deploy to GitHub Pages

Copy this folder into your personal page repository:

```text
ranpo0908.github.io/
  vocab-practice/
    index.html
    style.css
    app.js
```

Then visit:

```text
https://ranpo0908.github.io/vocab-practice/
```

## Local test

```bash
cd vocab-practice-definition-only
python -m http.server 8000
```

Open:

```text
http://localhost:8000
```

## Notes

This is a static front-end page. It calls public online resources directly from the browser.

Because public APIs can fail or change, the code includes:
- timeout handling
- localStorage cache for the word pool
- localStorage cache for definitions
- a small fallback word list
