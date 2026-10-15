---
"uroborosql-fmt": minor
---

Update uroborosql-fmt-napi to 1.1.2

- Add catalog checks (Beta): report tables and columns that do not exist in the database, using an exported SQLite snapshot or a PostgreSQL connection configured in the `db` section of `.uroborosqllintrc.json`
- Keep the analysis of the saved document when edits follow the save
- Log the reason when the lint configuration cannot be loaded
