# Migration scripts (legacy shapes)

These PowerShell scripts convert PurpleCMS content/structure into the old RecTem data formats. Keep them as reference until they are rewritten to emit Tessera `SiteDocument` JSON (`version: 1` layouts, pages, items, media, nav).

| Script | Role |
|--------|------|
| `convert-content.ps1` | XML content → page JSON |
| `convert-structure.ps1` | Structure config → nav JSON |
| `combine-data-files.ps1` | Concatenate item JS files |
| `trim-pcms-history.ps1` | Trim CMS version history |
| `trim-pcms-orphans.ps1` | Remove orphan content |
