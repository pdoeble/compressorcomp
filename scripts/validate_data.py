"""Validate the public e-compressor CSV datasets.

The checks intentionally focus on structure and references. They do not try to
infer missing technical values from notes or prose.
"""

from __future__ import annotations

import csv
import sys
from collections import Counter
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]

EXPECTED_HEADERS = {
    "ecompressor_products.csv": [
        "product_id",
        "manufacturer",
        "product_family",
        "variant_name",
        "launch_or_public_year",
        "target_segments",
        "refrigerant",
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
        "communication",
        "application_summary",
        "source_quality",
        "confidence",
        "primary_source_id",
        "notes",
    ],
    "ecompressor_sources.csv": [
        "source_id",
        "manufacturer",
        "title",
        "source_type",
        "pub_date",
        "url",
        "exact_quote",
        "source_quality",
        "confidence",
        "notes",
    ],
    "ecompressor_test_conditions.csv": [
        "test_condition_id",
        "applies_to_product_id",
        "standard_or_basis",
        "refrigerant",
        "voltage_vdc",
        "speed_rpm",
        "pd_mpa",
        "ps_mpa",
        "superheat_k",
        "subcool_k",
        "ambient_c",
        "reported_value_type",
        "reported_value",
        "unit",
        "source_id",
        "notes",
    ],
}

EXPECTED_ROW_COUNTS = {
    "ecompressor_products.csv": 61,
    "ecompressor_sources.csv": 43,
    "ecompressor_test_conditions.csv": 25,
}

QUALITY_VALUES = {"A", "B", "C"}
CONFIDENCE_VALUES = {"high", "medium", "low"}

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

TEST_CONDITION_NUMERIC_FIELDS = {
    "pd_mpa",
    "ps_mpa",
    "superheat_k",
    "subcool_k",
    "ambient_c",
    "reported_value",
}

SYMBOLIC_TEST_VALUES = {
    "voltage_vdc": {"nominal"},
    "speed_rpm": {"max_speed"},
}


def is_number(value: str) -> bool:
    if value == "":
        return True
    try:
        float(value)
    except ValueError:
        return False
    return True


def read_csv_checked(filename: str, errors: list[str]) -> list[dict[str, str]]:
    path = ROOT / filename
    expected_header = EXPECTED_HEADERS[filename]

    with path.open(newline="", encoding="utf-8-sig") as handle:
        raw_rows = list(csv.reader(handle))

    if not raw_rows:
        errors.append(f"{filename}: file is empty")
        return []

    header = raw_rows[0]
    if header != expected_header:
        errors.append(f"{filename}: header mismatch")

    for line_no, row in enumerate(raw_rows[1:], start=2):
        if len(row) != len(expected_header):
            errors.append(
                f"{filename}:{line_no}: expected {len(expected_header)} fields, got {len(row)}"
            )

    with path.open(newline="", encoding="utf-8-sig") as handle:
        rows = list(csv.DictReader(handle))

    expected_count = EXPECTED_ROW_COUNTS[filename]
    if len(rows) != expected_count:
        errors.append(f"{filename}: expected {expected_count} data rows, got {len(rows)}")

    return rows


def check_unique(rows: list[dict[str, str]], field: str, label: str, errors: list[str]) -> set[str]:
    values = [row[field] for row in rows]
    counts = Counter(values)
    for value, count in counts.items():
        if value == "":
            errors.append(f"{label}: blank {field}")
        elif count > 1:
            errors.append(f"{label}: duplicate {field} {value!r}")
    return set(values)


def check_quality(rows: list[dict[str, str]], filename: str, errors: list[str]) -> None:
    for line_no, row in enumerate(rows, start=2):
        quality = row.get("source_quality", "")
        confidence = row.get("confidence", "")
        if quality and quality not in QUALITY_VALUES:
            errors.append(f"{filename}:{line_no}: invalid source_quality {quality!r}")
        if confidence and confidence not in CONFIDENCE_VALUES:
            errors.append(f"{filename}:{line_no}: invalid confidence {confidence!r}")


def check_numeric(
    rows: list[dict[str, str]],
    fields: set[str],
    filename: str,
    errors: list[str],
) -> None:
    for line_no, row in enumerate(rows, start=2):
        for field in fields:
            if not is_number(row.get(field, "")):
                errors.append(f"{filename}:{line_no}: {field} is not numeric: {row[field]!r}")


def check_symbolic_or_numeric(
    rows: list[dict[str, str]],
    filename: str,
    errors: list[str],
) -> None:
    for line_no, row in enumerate(rows, start=2):
        for field, allowed in SYMBOLIC_TEST_VALUES.items():
            value = row.get(field, "")
            if value and value not in allowed and not is_number(value):
                errors.append(f"{filename}:{line_no}: {field} has unsupported value {value!r}")


def main() -> int:
    errors: list[str] = []
    products = read_csv_checked("ecompressor_products.csv", errors)
    sources = read_csv_checked("ecompressor_sources.csv", errors)
    test_conditions = read_csv_checked("ecompressor_test_conditions.csv", errors)

    product_ids = check_unique(products, "product_id", "products", errors)
    source_ids = check_unique(sources, "source_id", "sources", errors)
    check_unique(test_conditions, "test_condition_id", "test conditions", errors)

    check_quality(products, "ecompressor_products.csv", errors)
    check_quality(sources, "ecompressor_sources.csv", errors)
    check_numeric(products, PRODUCT_NUMERIC_FIELDS, "ecompressor_products.csv", errors)
    check_numeric(test_conditions, TEST_CONDITION_NUMERIC_FIELDS, "ecompressor_test_conditions.csv", errors)
    check_symbolic_or_numeric(test_conditions, "ecompressor_test_conditions.csv", errors)

    for line_no, row in enumerate(products, start=2):
        source_id = row["primary_source_id"]
        if source_id not in source_ids:
            errors.append(f"ecompressor_products.csv:{line_no}: unknown primary_source_id {source_id!r}")
        if not row["manufacturer"]:
            errors.append(f"ecompressor_products.csv:{line_no}: manufacturer is required")
        if not row["variant_name"]:
            errors.append(f"ecompressor_products.csv:{line_no}: variant_name is required")

    for line_no, row in enumerate(test_conditions, start=2):
        product_id = row["applies_to_product_id"]
        source_id = row["source_id"]
        if product_id not in product_ids:
            errors.append(
                f"ecompressor_test_conditions.csv:{line_no}: unknown applies_to_product_id {product_id!r}"
            )
        if source_id not in source_ids:
            errors.append(f"ecompressor_test_conditions.csv:{line_no}: unknown source_id {source_id!r}")

    if errors:
        for error in errors:
            print(f"ERROR: {error}", file=sys.stderr)
        return 1

    print(
        "Validation passed: "
        f"{len(products)} products, {len(sources)} sources, "
        f"{len(test_conditions)} test-condition rows."
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
