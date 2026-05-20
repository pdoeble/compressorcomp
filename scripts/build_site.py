"""Build static JSON data for the GitHub Pages visualisation."""

from __future__ import annotations

import csv
import json
from collections import Counter, defaultdict
from pathlib import Path
from typing import Any


ROOT = Path(__file__).resolve().parents[1]
DATA_DIR = ROOT / "docs" / "data"

PRODUCT_NUMERIC_FIELDS = {
    "launch_or_public_year",
    "displacement_cc_rev",
    "voltage_min_vdc",
    "voltage_max_vdc",
    "speed_min_rpm",
    "speed_max_rpm",
    "cooling_capacity_kw",
    "heating_capacity_kw",
    "electric_power_peak_kw",
    "electric_power_continuous_kw",
    "mass_kg",
    "length_mm",
    "diameter_mm",
}

TEST_CONDITION_MIXED_NUMERIC_FIELDS = {"voltage_vdc", "speed_rpm"}
TEST_CONDITION_NUMERIC_FIELDS = {
    "pd_mpa",
    "ps_mpa",
    "superheat_k",
    "subcool_k",
    "ambient_c",
    "reported_value",
}


def read_csv(filename: str) -> list[dict[str, str]]:
    with (ROOT / filename).open(newline="", encoding="utf-8-sig") as handle:
        return list(csv.DictReader(handle))


def parse_number(value: str) -> int | float | None:
    if value == "":
        return None
    number = float(value)
    return int(number) if number.is_integer() else number


def maybe_number(value: str) -> int | float | str | None:
    if value == "":
        return None
    try:
        return parse_number(value)
    except ValueError:
        return value


def normalize_record(row: dict[str, str], numeric_fields: set[str]) -> dict[str, Any]:
    normalized: dict[str, Any] = {}
    for key, value in row.items():
        if key in numeric_fields:
            normalized[key] = parse_number(value) if value != "" else None
        else:
            normalized[key] = value if value != "" else None
    return normalized


def write_json(filename: str, payload: Any) -> None:
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    path = DATA_DIR / filename
    path.write_text(
        json.dumps(payload, ensure_ascii=False, indent=2, sort_keys=True) + "\n",
        encoding="utf-8",
    )


def range_summary(rows: list[dict[str, Any]], field: str) -> dict[str, int | float | None]:
    values = [row[field] for row in rows if isinstance(row.get(field), (int, float))]
    if not values:
        return {"count": 0, "min": None, "max": None}
    return {"count": len(values), "min": min(values), "max": max(values)}


def missing_summary(rows: list[dict[str, Any]], fields: list[str]) -> dict[str, int]:
    return {field: sum(1 for row in rows if row.get(field) is None) for field in fields}


def main() -> int:
    source_rows = read_csv("ecompressor_sources.csv")
    raw_product_rows = read_csv("ecompressor_products.csv")
    raw_test_rows = read_csv("ecompressor_test_conditions.csv")

    sources = [normalize_record(row, set()) for row in source_rows]
    source_by_id = {source["source_id"]: source for source in sources}

    test_conditions: list[dict[str, Any]] = []
    conditions_by_product: dict[str, list[dict[str, Any]]] = defaultdict(list)
    for row in raw_test_rows:
        normalized = normalize_record(row, TEST_CONDITION_NUMERIC_FIELDS)
        for field in TEST_CONDITION_MIXED_NUMERIC_FIELDS:
            normalized[field] = maybe_number(row[field])
        normalized["source"] = source_by_id.get(row["source_id"])
        test_conditions.append(normalized)
        conditions_by_product[row["applies_to_product_id"]].append(normalized)

    products: list[dict[str, Any]] = []
    for index, row in enumerate(raw_product_rows, start=1):
        normalized = normalize_record(row, PRODUCT_NUMERIC_FIELDS)
        segments = [segment for segment in row["target_segments"].split("|") if segment]
        product_conditions = conditions_by_product.get(row["product_id"], [])
        source = source_by_id.get(row["primary_source_id"])
        normalized.update(
            {
                "row_index": index,
                "segments": segments,
                "segment_label": ", ".join(segment.replace("_", " ") for segment in segments) or None,
                "refrigerant_label": row["refrigerant"] or "Not specified",
                "source": source,
                "source_title": source["title"] if source else None,
                "source_url": source["url"] if source else None,
                "test_condition_ids": [condition["test_condition_id"] for condition in product_conditions],
                "has_test_condition": bool(product_conditions),
                "test_condition_count": len(product_conditions),
            }
        )
        products.append(normalized)

    manufacturers = sorted({product["manufacturer"] for product in products if product["manufacturer"]})
    segments = sorted({segment for product in products for segment in product["segments"]})
    refrigerants = sorted({product["refrigerant_label"] for product in products})

    summary = {
        "built_from": [
            "ecompressor_products.csv",
            "ecompressor_sources.csv",
            "ecompressor_test_conditions.csv",
        ],
        "comparison_note": (
            "Cooling-capacity values are public reported values under mixed test bases. "
            "Use test-condition metadata before making compressor-to-compressor comparisons."
        ),
        "counts": {
            "products": len(products),
            "sources": len(sources),
            "test_conditions": len(test_conditions),
            "manufacturers": len(manufacturers),
            "segments": len(segments),
        },
        "confidence_counts": dict(sorted(Counter(product["confidence"] for product in products).items())),
        "source_quality_counts": dict(sorted(Counter(product["source_quality"] for product in products).items())),
        "manufacturers": manufacturers,
        "segments": segments,
        "refrigerants": refrigerants,
        "missing_fields": missing_summary(
            products,
            [
                "displacement_cc_rev",
                "voltage_max_vdc",
                "cooling_capacity_kw",
                "electric_power_peak_kw",
                "mass_kg",
            ],
        ),
        "metric_ranges": {
            "launch_or_public_year": range_summary(products, "launch_or_public_year"),
            "voltage_max_vdc": range_summary(products, "voltage_max_vdc"),
            "displacement_cc_rev": range_summary(products, "displacement_cc_rev"),
            "cooling_capacity_kw": range_summary(products, "cooling_capacity_kw"),
        },
    }

    write_json("products.json", products)
    write_json("sources.json", sources)
    write_json("test_conditions.json", test_conditions)
    write_json("summary.json", summary)

    print(
        "Built docs/data: "
        f"{len(products)} products, {len(sources)} sources, "
        f"{len(test_conditions)} test-condition rows."
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
