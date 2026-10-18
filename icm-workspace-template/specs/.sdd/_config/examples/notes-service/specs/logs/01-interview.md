# Interview

One row per question the Lead Architect asked (format: `specs/.sdd/_config/interview-template.md`). Budget: 20 per slice; what does not fit is answered at a prototype demo.

| # | Question | Answer | Recorded in |
|---|---|---|---|
| 1 | Who uses the service, and is there more than one actor? | A single anonymous actor behind an authenticating gateway | DEC001, SPEC §3 |
| 2 | Can a published note be edited? | No; published text must stay citable | DEC002, SPEC §5.2, V2 |
| 3 | Can a published note be deleted? | Yes, hard delete in any state | DEC003, SPEC §5.2 |
| 4 | What should an empty patch `{}` do? | Count as a successful mutation | DEC004, SPEC §5.2 |
| 5 | Is `body` required on create? | No; omitted body is stored as `""` | DEC005, SPEC §4 |
| 6 | Are tags and search part of the first slice? | No; see the product first | DEC006, G-001 |
