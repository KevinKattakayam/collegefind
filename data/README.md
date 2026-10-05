# data/

Raw source files go here. **Do not commit files whose terms you have not checked.**

- `institutes.example.csv` — format for mapping JoSAA institute names to colleges
  (`slug`, `city`, `state`, `type`). Copy to `institutes.csv` and fill in from the
  institute's official website.
- JoSAA CSVs: export the Opening & Closing Ranks table for one year + round and
  save as `josaa-<year>-round<round>.csv`. Keep the original header row.

See `docs/DATA_SOURCES.md` for the full ingestion workflow.
