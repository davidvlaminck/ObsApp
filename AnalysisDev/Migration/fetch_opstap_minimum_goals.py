"""
Script om de koppeling tussen Opstap-doelen en minimumdoelen te extraheren
van de Opstap API en op te slaan als Excel-bestand.

Gebruik (vanuit de backend venv):
    uv run python AnalysisDev/Migration/fetch_opstap_minimum_goals.py

Output:
    AnalysisDev/opstap_naar_minimumdoelen.xlsx
"""

import html
import json
import os
import re
import urllib.request
from openpyxl import Workbook


def strip_html(text: str) -> str:
    """Verwijdert HTML tags en decodeert HTML-entiteiten uit tekst."""
    if not text:
        return ""
    text = html.unescape(text)
    text = re.sub(r"<[^>]+>", "", text)
    text = text.replace("\u200b", "").replace("\u200c", "").replace("\u200d", "").replace("\ufeff", "")
    text = text.replace("\u202f", " ").replace("\u2008", " ")
    return text

# Configuratie
API_BASE = "https://cached-api.katholiekonderwijs.vlaanderen"
DOCUMENT_ID = "bdc19260-bd4c-46a8-8009-b2a54f381120"
SNAPSHOT = "latest"
KRC_ITEMS_URL = f"{API_BASE}/documents/{DOCUMENT_ID}/snapshots/{SNAPSHOT}/krcItems"
OUTPUT_PATH = os.path.join(os.path.dirname(__file__), "..", "opstap_naar_minimumdoelen.xlsx")

HEADERS = {
    "User-Agent": "Mozilla/5.0 (compatible; MigrationScript/1.0)",
    "Accept": "application/json",
}


def fetch_json(url: str) -> dict:
    """Haalt JSON data op van een URL."""
    req = urllib.request.Request(url, headers=HEADERS)
    with urllib.request.urlopen(req) as resp:
        return json.loads(resp.read().decode("utf-8"))


def build_path(item: dict, lookup: dict) -> str:
    """Bouwt het pad (discipline > domein > subdomein > cluster) voor een doel."""
    path_parts = []
    cur = item
    while cur.get("parentHref"):
        parent_key = cur["parentHref"].split("/")[-1]
        parent = lookup.get(parent_key)
        if not parent:
            break
        if parent.get("type") in (
            "KRC_CURRICULUM_DISCIPLINE",
            "KRC_CURRICULUM_DOMAIN",
            "KRC_CURRICULUM_SUBDOMAIN",
            "KRC_CURRICULUM_CLUSTER",
        ):
            path_parts.insert(0, parent.get("title", ""))
        cur = parent
    return " > ".join(path_parts)


def extract_examples(description: str) -> str:
    """Extraheert voorbeelden uit de beschrijving (HTML)."""
    if not description:
        return ""
    
    # Zoek naar <strong>Voorbeeld(en):</strong> gevolgd door <ul>...<li>...</li>...</ul>
    # Patroon: <br><strong>Voorbeeld(en): </strong><ul><li>...</li></ul>
    pattern = r"<strong>Voorbeeld\(en\):\s*</strong>\s*<ul>(.*?)</ul>"
    match = re.search(pattern, description, re.DOTALL | re.IGNORECASE)
    if match:
        list_content = match.group(1)
        # Extract <li> items
        items = re.findall(r"<li>(.*?)</li>", list_content, re.DOTALL)
        if items:
            # Clean up HTML tags from each item
            cleaned = []
            for item in items:
                text = strip_html(item).strip()
                if text:
                    cleaned.append(text)
            return "\n".join(f"- {item}" for item in cleaned)
    
    # Fallback: zoek naar "Voorbeeld(en):" en neem de rest van de tekst
    # maar alleen als het lijst-items bevat
    if "Voorbeeld(en)" in description or "Voorbeeld" in description:
        # Try to find list items anywhere after "Voorbeeld"
        idx = description.find("Voorbeeld")
        if idx != -1:
            after = description[idx:]
            items = re.findall(r"<li>(.*?)</li>", after, re.DOTALL)
            if items:
                cleaned = []
                for item in items:
                    text = strip_html(item).strip()
                    if text:
                        cleaned.append(text)
                return "\n".join(f"- {item}" for item in cleaned)
    
    return ""


def main():
    print(f"Ophalen van KRC items van {KRC_ITEMS_URL}...")
    data = fetch_json(KRC_ITEMS_URL)
    items = data.get("items", [])
    print(f"Totaal items: {len(items)}")

    # Bouw lookup: key -> item
    lookup = {i["key"]: i for i in items}

    # Verzamel alle doel -> minimumdoel koppelingen
    rows = []
    goals_with_min = [i for i in items if i.get("type") == "KRC_CURRICULUM_GOAL" and i.get("minimumGoals")]
    print(f"Doelen met minimumdoelen: {len(goals_with_min)}")

    for item in goals_with_min:
        goal_identifier = item.get("identifier", "")
        goal_title = strip_html(item.get("title", ""))
        goal_description = item.get("description", "")
        path = build_path(item, lookup)
        examples = extract_examples(goal_description)

        for mg_url in item["minimumGoals"]:
            mg_key = mg_url.split("/")[-1]
            mg_item = lookup.get(mg_key)

            if mg_item:
                mg_code = mg_item.get("code", "")
                mg_title = strip_html(mg_item.get("title", ""))
                mg_unique = mg_item.get("uniqueCode", "")
            else:
                # Fallback: haal minimumdoel direct op
                try:
                    mg_data = fetch_json(f"{API_BASE}{mg_url}")
                    mg_code = mg_data.get("code", "")
                    mg_title = strip_html(mg_data.get("title", ""))
                    mg_unique = mg_data.get("uniqueCode", "")
                except Exception as e:
                    print(f"  Waarschuwing: kon {mg_url} niet ophalen: {e}")
                    mg_code = ""
                    mg_title = ""
                    mg_unique = ""

            rows.append([
                goal_identifier,
                goal_title,
                path,
                mg_url,
                mg_code,
                mg_unique,
                mg_title,
                examples,
            ])

    print(f"Totale koppelingen: {len(rows)}")

    # Schrijf naar Excel
    wb = Workbook()
    ws = wb.active
    ws.title = "Opstap naar Minimumdoelen"

    headers = [
        "Doel identifier",
        "Doel titel",
        "Pad",
        "Minimumdoel URL",
        "Minimumdoel code",
        "Minimumdoel unieke code",
        "Minimumdoel titel",
        "Voorbeelden",
    ]
    ws.append(headers)

    for row in rows:
        ws.append(row)

    # Zorg dat de output directory bestaat
    output_dir = os.path.dirname(OUTPUT_PATH)
    if output_dir:
        os.makedirs(output_dir, exist_ok=True)
    
    wb.save(OUTPUT_PATH)
    print(f"Excel opgeslagen naar: {OUTPUT_PATH}")


if __name__ == "__main__":
    main()
