# Strategy importer

Place downloaded personal strategy export files (the JSON attachments created by the "email me your strategies" button on the inventory page) into this folder. Each file should have the `personalStrategies` array produced by the app export.

Run the `strategy-importer` GitHub Action (workflow dispatch) to append any new strategies found in these files to `data/Strategies.csv`. The importer will skip entries that are missing titles, duplicate an existing slug, or repeat a slug within the batch. Need references are resolved using `data/Needs.csv` so the new rows include human-readable need titles.
