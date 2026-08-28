---
title: "Assumptions and Limitations"
language: "en"
stable_uuid_v5: "d199bde6-597f-5d81-b895-6f8d289b5d49"
event_uuid_v7: "01a04291-b472-72e1-ae5a-7c924bbf4341"
generated_at: "2026-08-27T09:34:00Z"
version: "0.1.0"
status: "design-specification"
---

# Assumptions and Limitations

1. WebMCP is treated as a draft interface and isolated behind an adapter.
2. OpenAI product details can change; integration code must be verified against current official documentation before deployment.
3. Numeric SLO examples are synthetic and not production measurements.
4. Independence assumptions in evidence/retry formulas are approximations that require calibration.
5. The bundled Python reachability checker is an independent finite abstraction, not a replacement for running TLC on the TLA+ model.
6. The generated sample audit keys are ephemeral; only public keys are shipped. They are not production trust anchors.
7. JCS-compatible code in the sample intentionally accepts a restricted no-float subset; production implementations should use a vetted RFC 8785 implementation.
8. Cryptographic integrity proves recorded provenance, not the physical truth of a tool claim.
9. CRDT merge is forbidden for noncommutative external side effects.
10. Legal, regulatory, accessibility, localization, and domain-specific safety review remain deployment obligations.
