import json
import os
from pathlib import Path
from typing import Any

import requests

ORCID_ID = os.environ["ORCID_ID"].strip()
CLIENT_ID = os.environ["ORCID_CLIENT_ID"].strip()
CLIENT_SECRET = os.environ["ORCID_CLIENT_SECRET"].strip()
MAX_WORKS = int(os.getenv("MAX_WORKS", "5"))
OUTPUT_PATH = Path("assets/data/recent-work.json")
TOKEN_URL = "https://orcid.org/oauth/token"
API_BASE = "https://pub.orcid.org/v3.0"
ALLOWED_TYPES = {
    "journal-article",
    "conference-paper",
    "conference-abstract",
    "preprint",
    "book-chapter",
    "dissertation-thesis",
    "working-paper",
}


def get_access_token() -> str:
    response = requests.post(
        TOKEN_URL,
        headers={"Accept": "application/json"},
        data={
            "client_id": CLIENT_ID,
            "client_secret": CLIENT_SECRET,
            "grant_type": "client_credentials",
            "scope": "/read-public",
        },
        timeout=30,
    )
    response.raise_for_status()
    payload = response.json()
    return payload["access_token"]


def api_get(path: str, access_token: str) -> dict[str, Any]:
    response = requests.get(
        f"{API_BASE}/{ORCID_ID}/{path.lstrip('/')}",
        headers={
            "Accept": "application/vnd.orcid+json",
            "Authorization": f"Bearer {access_token}",
        },
        timeout=30,
    )
    response.raise_for_status()
    return response.json()


def nested_get(data: dict[str, Any], *keys: str, default: Any = "") -> Any:
    current: Any = data
    for key in keys:
        if not isinstance(current, dict):
            return default
        current = current.get(key)
    if current is None:
        return default
    return current


def parse_int(value: Any, default: int = 0) -> int:
    try:
        return int(value)
    except (TypeError, ValueError):
        return default


def publication_sort_key(detail: dict[str, Any]) -> tuple[int, int, int, str]:
    year = parse_int(nested_get(detail, "publication-date", "year", "value", default=0))
    month = parse_int(nested_get(detail, "publication-date", "month", "value", default=0))
    day = parse_int(nested_get(detail, "publication-date", "day", "value", default=0))
    title = nested_get(detail, "title", "title", "value", default="")
    return year, month, day, str(title)


def preferred_summary(group: dict[str, Any]) -> dict[str, Any] | None:
    summaries = group.get("work-summary", []) or []
    if not summaries:
        return None
    return max(summaries, key=lambda item: parse_int(item.get("display-index", 0)))


def extract_doi_and_url(detail: dict[str, Any]) -> tuple[str, str]:
    doi = ""
    url = str(nested_get(detail, "url", "value", default="")).strip()

    external_ids = nested_get(detail, "external-ids", "external-id", default=[]) or []
    for external_id in external_ids:
        ext_type = str(external_id.get("external-id-type", "")).strip().lower()
        ext_value = str(external_id.get("external-id-value", "")).strip()
        ext_url = external_id.get("external-id-url")
        if isinstance(ext_url, dict):
            ext_url = ext_url.get("value", "")
        ext_url = str(ext_url or "").strip()

        if ext_type == "doi" and ext_value:
            doi = (
                ext_value.replace("https://doi.org/", "")
                .replace("http://doi.org/", "")
                .replace("doi:", "")
                .strip()
            )
            if not url:
                url = ext_url or f"https://doi.org/{doi}"
            break

    return doi, url


def extract_authors(detail: dict[str, Any]) -> str:
    contributors = nested_get(detail, "contributors", "contributor", default=[]) or []
    authors: list[str] = []
    for contributor in contributors:
        name = str(nested_get(contributor, "credit-name", "value", default="")).strip()
        if name:
            authors.append(name)
    return ", ".join(authors)


def normalize_work(detail: dict[str, Any]) -> dict[str, Any] | None:
    work_type = str(detail.get("type", "")).strip().lower()
    if work_type and work_type not in ALLOWED_TYPES:
        return None

    title = str(nested_get(detail, "title", "title", "value", default="")).strip()
    if not title:
        return None

    venue = str(nested_get(detail, "journal-title", "value", default="")).strip()
    year = parse_int(nested_get(detail, "publication-date", "year", "value", default=0), default=0)
    doi, url = extract_doi_and_url(detail)

    return {
        "title": title,
        "authors": extract_authors(detail),
        "venue": venue,
        "year": year if year > 0 else "",
        "doi": doi,
        "url": url,
        "type": work_type,
    }


def main() -> None:
    access_token = get_access_token()
    works_payload = api_get("works", access_token)

    summaries = []
    for group in works_payload.get("group", []) or []:
        summary = preferred_summary(group)
        if summary is not None and summary.get("put-code"):
            summaries.append(summary)

    normalized = []
    for summary in summaries:
        put_code = summary["put-code"]
        detail = api_get(f"work/{put_code}", access_token)
        record = normalize_work(detail)
        if record is not None:
            normalized.append((publication_sort_key(detail), record))

    normalized.sort(key=lambda item: item[0], reverse=True)
    final_records = [item[1] for item in normalized[:MAX_WORKS]]

    OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT_PATH.write_text(
        json.dumps(final_records, indent=2, ensure_ascii=False) + "\n",
        encoding="utf-8",
    )

    print(f"Wrote {len(final_records)} works to {OUTPUT_PATH}")


if __name__ == "__main__":
    main()
