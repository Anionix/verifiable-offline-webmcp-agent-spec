---
title: "Open-Knowledge-Style Profile"
language: "en"
stable_uuid_v5: "b9277c65-f1cc-5ef2-91cc-a878aff924dd"
event_uuid_v7: "01a04291-b471-72e8-a839-d2003e38a4fc"
generated_at: "2026-08-27T09:34:00Z"
version: "0.1.0"
status: "design-specification"
---

# Open-Knowledge-Style Profile

This project uses **Open Knowledge Format–like** organization as a practical profile, not as a claim that one official standard named “Open Knowledge Format” governs the repository.

## Profile

- JSON-LD context for linked identifiers and bilingual labels.
- PROV-O-inspired entities, activities, agents, generation, derivation, and attribution.
- DCAT-inspired dataset/distribution catalog metadata.
- JSON Schema Draft 2020-12 for structural contracts.
- `source_refs` and `supports` edges for evidence lineage.
- UUIDv5 for stable semantic identity and UUIDv7 for time-ordered occurrences.
- RFC 3339 timestamps plus Unix epoch milliseconds.
- NDJSON for append-oriented time series and event streams.

Primary bases: [SRC-JSONLD-2020](source-map.md#src-jsonld-2020), [SRC-PROVO-2013](source-map.md#src-provo-2013), [SRC-DCAT3-2024](source-map.md#src-dcat3-2024), [SRC-JSONSCHEMA-2020-12](source-map.md#src-jsonschema-2020-12), [SRC-RFC9562](source-map.md#src-rfc9562), and [SRC-RFC3339](source-map.md#src-rfc3339).
