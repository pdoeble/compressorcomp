---
canonical_status: unknown
normative_status: informative
lifecycle_state: unknown
currency_assessment: not_assessed
audit_role: supporting_context
scope: project
review_disposition: review
provenance_origin: local_project_authoring
document_kind: report
derivation: direct_authoring
---
# Public HV eCompressor Visualisation

This repository contains a public-source dataset and static GitHub Pages prototype
for high-voltage electric refrigerant compressor capability trends.

## Data Sources

- `ecompressor_products.csv` is the normalized product/variant table used for plots.
- `ecompressor_sources.csv` stores source metadata and URLs.
- `ecompressor_test_conditions.csv` stores reported cooling-capacity bases where public information is available.
- `hv_ecompressor_seed_list_gap_closed.xlsx` is retained as the workbook audit source for the latest enrichment pass.

The workbook has many sheets and mixed confidence levels. The current import policy is:

- Include `verified_variant` / `validated_detail` rows with usable numeric data.
- Include C-quality detail pages as candidate rows, visibly labeled as `C/medium`.
- Exclude D-quality and `search_target_not_for_plots` rows from the CSV database until validated.
- Preserve test-condition metadata rather than treating all cooling-capacity values as directly comparable.

## Build

The site is static. Python is only used to validate CSVs and generate JSON files under `docs/data/`.

```powershell
python scripts\validate_data.py
python scripts\build_site.py
python -m http.server 8000 --directory docs
```

Then open:

```text
http://127.0.0.1:8000/
```

## GitHub Pages

The current prototype is designed for GitHub Pages configured to serve from the
repository `docs/` directory. The generated JSON files are committed so the page
does not need a server-side build step.

## Visualization Notes

The first view is an analysis dashboard, not a landing page. Each chart has axis
dropdowns. Global filters apply to all charts and the evidence table. Cooling
capacity values are public reported values under mixed standards or product-page
bases; always check the test-condition column and source link before comparing
compressors quantitatively.
