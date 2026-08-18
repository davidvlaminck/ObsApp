"""
Script om alle Vlaamse scholen te downloaden van data-onderwijs.vlaanderen.be
en ze te koppelen aan een koepel voor seeden.

Gebruik (vanuit de backend venv):
    uv run python AnalysisDev/Migration/fetch_schools.py

Output:
    AnalysisDev/schools.json (voor controle)
    Roept ook seed_schools_from_csv() aan om direct in de database te seeden.
"""

import csv
import json
import os
import re
import urllib.request
from collections import defaultdict
from pathlib import Path

from app.core.database import SessionLocal
from app.models.koepel import Koepel
from app.models.school import School, SchoolAddress

CSV_URL = "https://data-onderwijs.vlaanderen.be/onderwijsaanbod/csv.ashx?s=01&n=1&hs=111+121"
OUTPUT_PATH = Path(__file__).resolve().parent.parent / "schools.json"


def slugify(value: str) -> str:
    value = value.strip().lower()
    value = re.sub(r"[^\w\s-]", "", value)
    value = re.sub(r"[\s_]+", "-", value)
    value = re.sub(r"-+", "-", value).strip("-")
    return value


NET_TO_KOEPEL_SLUG = {
    "Officieel gesubsidieerd onderwijs": "ovsg",
    "Gemeenschapsonderwijs": "go",
    "Vrij gesubsidieerd onderwijs": "katholiek-onderwijs-vlaanderen",
    "Andere": "ovsg",
}


def fetch_schools():
    print(f"Ophalen van CSV van {CSV_URL}...")
    req = urllib.request.Request(CSV_URL, headers={"User-Agent": "Mozilla/5.0"})
    with urllib.request.urlopen(req) as resp:
        text = resp.read().decode("utf-8")

    reader = csv.reader(text.splitlines(), delimiter=";")
    header = next(reader)
    header[0] = header[0].lstrip("\ufeff").strip('"')

    indices = {
        "schoolnummer": header.index("schoolnummer"),
        "net": header.index("net"),
        "naam": header.index("naam"),
        "adres": header.index("adres"),
        "postcode": header.index("postcode"),
        "gemeente": header.index("gemeente"),
        "hoofdzetel": header.index("hoofdzetel"),
        "status": header.index("status erkenning"),
    }

    rows = []
    for row in reader:
        if len(row) <= max(indices.values()):
            continue

        schoolnummer = row[indices["schoolnummer"]].strip()
        if not schoolnummer:
            continue

        naam = row[indices["naam"]].strip()
        if not naam:
            continue

        net = row[indices["net"]].strip()
        status = row[indices["status"]].strip()

        if status != "S":
            continue

        rows.append({
            "external_id": schoolnummer,
            "name": naam,
            "net": net,
            "koepel_slug": NET_TO_KOEPEL_SLUG.get(net, "ovsg"),
            "address": row[indices["adres"]].strip(),
            "postal_code": row[indices["postcode"]].strip(),
            "city": row[indices["gemeente"]].strip(),
            "is_head_office": row[indices["hoofdzetel"]].strip().lower() == "true",
        })

    print(f"Totaal rijen gevonden: {len(rows)}")

    grouped = defaultdict(list)
    for r in rows:
        grouped[r["external_id"]].append(r)

    schools = []
    seen_slugs = set()
    for external_id, group in grouped.items():
        primary = next((r for r in group if r["is_head_office"]), group[0])
        base_slug = slugify(primary["name"])
        slug = base_slug
        suffix = 1
        while slug in seen_slugs:
            slug = f"{base_slug}-{suffix}"
            suffix += 1
        seen_slugs.add(slug)

        extra_addresses = [
            {
                "address": r["address"],
                "postal_code": r["postal_code"],
                "city": r["city"],
                "is_head_office": r["is_head_office"],
            }
            for r in group
            if r["address"] != primary["address"] or r["postal_code"] != primary["postal_code"] or r["city"] != primary["city"]
        ]

        schools.append({
            "external_id": external_id,
            "name": primary["name"],
            "slug": slug,
            "net": primary["net"],
            "koepel_slug": primary["koepel_slug"],
            "address": primary["address"],
            "postal_code": primary["postal_code"],
            "city": primary["city"],
            "addresses": extra_addresses,
        })

    print(f"Totaal scholen gegroepeerd: {len(schools)}")

    OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    with open(OUTPUT_PATH, "w", encoding="utf-8") as f:
        json.dump(schools, f, ensure_ascii=False, indent=2)
    print(f"JSON opgeslagen naar: {OUTPUT_PATH}")

    return schools


def seed_schools_from_csv():
    schools = fetch_schools()
    db = SessionLocal()
    try:
        koepels = {k.slug: k for k in db.query(Koepel).all()}
        existing_ids = {row[0] for row in db.query(School.external_id).all() if row[0]}

        new_schools = []
        school_address_pairs = []

        for s in schools:
            if s["external_id"] in existing_ids:
                continue
            if s["koepel_slug"] not in koepels:
                continue

            school = School(
                external_id=s["external_id"],
                name=s["name"],
                slug=s["slug"],
                is_active=True,
                koepel_id=koepels[s["koepel_slug"]].id,
                address=s["address"],
                postal_code=s["postal_code"],
                city=s["city"],
            )
            new_schools.append(school)
            for addr in s.get("addresses", []):
                school_address_pairs.append((school, addr))

        db.add_all(new_schools)
        db.commit()

        address_objects = []
        for school, addr in school_address_pairs:
            address_objects.append(
                SchoolAddress(
                    school_id=school.id,
                    address=addr["address"],
                    postal_code=addr["postal_code"],
                    city=addr["city"],
                    is_head_office=addr["is_head_office"],
                )
            )

        db.add_all(address_objects)
        db.commit()

        print(f"Nieuwe scholen toegevoegd aan database: {len(new_schools)}")
    finally:
        db.close()


if __name__ == "__main__":
    seed_schools_from_csv()
