# Cyber Yarrow

Cyber Yarrow is a tiny static web page for a minimalist six-line coin casting ritual. It works offline as plain HTML, CSS, and vanilla JavaScript: click to cast on desktop, or shake to cast on supported phones after motion access is granted.

## Run Locally

```bash
cd cyber-yarrow
python -m http.server 8000
```

Open `http://localhost:8000`.

## Desktop Testing

Use the `Cast This Line` button. It is always available during casting and triggers the same coin animation and line recording as a valid phone shake.

## Phone Testing

Host the page through HTTPS, such as GitHub Pages. Open it on your phone, tap `Start Casting`, grant motion permission if prompted, then shake to cast.

## Notes

Motion sensors may require HTTPS and user permission. If motion is unavailable, denied, unsupported, or impractical on the current device, the `Cast This Line` button remains available.
