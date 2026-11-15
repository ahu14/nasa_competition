# NASA record provenance

`donki-snapshot.json` is a selection of real NASA DONKI event records. Observation timestamps are in 2024; download/verification occurred on November 15, 2026. The historical window is May 8–13, 2024.

- CME, SEP and notifications were fetched from NASA's public Open APIs gateway after the CCMC host timed out.
- The flare `2024-05-10T00:10:00-FLR-001`, class M1.3, was captured in a successful HTTP 200 CCMC query for May 10, 2024 (15 records returned). Later full-window and repeat flare requests returned errors, so this verified selection was retained. Its original NASA record is https://ccmc.gsfc.nasa.gov/DONKI/view/FLR/30665/-1.
- At most eight selected records per type are kept for the compact learning view; the initial FLR selection contains one record. Returned counts and selected counts differ.
- Records shown beside each other are not necessarily causally linked. Instrument names identify the observing spacecraft, not the fictional outpost.
- `npm run nasa:sync` refreshes the archive and recent window. If a feed fails, verified archived selections remain available with reuse metadata. No API key is written to these files.

The game uses these observations as educational context. Mars weather, Day 2 storm arrival, the local radiation alert, airlock gating and decision outcomes are simulations. The bundle is not an operational space-weather service.
