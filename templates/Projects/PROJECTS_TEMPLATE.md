# Filling out the projects template

Open `PROJECTS_TEMPLATE.csv` in Excel / Numbers / Google Sheets and fill in
one row per project. There are 12 empty rows to start; add or delete rows
freely. When you're done, save the file (keep it as CSV) and hand it back —
I'll convert it into the typed `projects` array in
[`src/app/data/projects.ts`](src/app/data/projects.ts).

## Column reference

| Column | Required | Notes |
|---|---|---|
| `id` | yes | URL-safe slug, lowercase with hyphens, e.g. `waterfront-cultural-center`. Used in the project URL. |
| `title` | yes | Project title shown on the page. |
| `type` | yes | One of: `architecture` or `cartography`. Drives the marker shape (diamond / circle) and the legend grouping. |
| `year` | yes | Four-digit year of completion (or thesis/publication year). |
| `location` | yes | Primary city / region label, e.g. `Rotterdam`. |
| `country` | yes | Country name in English. |
| `lat` | yes | Latitude of the primary site (decimal degrees, e.g. `51.9244`). |
| `lng` | yes | Longitude of the primary site (decimal degrees, e.g. `4.4777`). |
| `extra_locations` | optional | Use only if the project spans multiple sites. Encoding: `Label\|lat\|lng; Label\|lat\|lng`. Example: `Rhône Glacier\|46.6156\|8.3929; Gorner Glacier\|45.9763\|7.7927`. Leave blank for single-site projects. |
| `short_description` | yes | One sentence shown on the hover preview card on the globe. ~140 characters max. |
| `description` | yes | One paragraph for the project detail page intro. ~300 characters. |
| `details` | yes | One longer paragraph (or two) covering technical/methodological detail. ~500–800 characters. |
| `client` | yes | Client / commissioner / institution. Use `—` if there's no client (academic, thesis). |
| `work_type` | yes | One of: `professional`, `academic`, `thesis`. |
| `area` | optional, architecture only | Built area, e.g. `18,400 m²`. Leave blank for cartography. |
| `scale` | optional, cartography only | Map scale range, e.g. `1:5,000 – 1:100,000`. Leave blank for architecture. |
| `image` | yes | URL or filename for the cover image. If you don't have one yet, write `TBD` and I'll wire it up later. |
| `tags` | yes | 3–5 short keywords, separated by semicolons, e.g. `Cultural; Public; Mixed-Use; Waterfront`. |

## Tips

- Right-click on Google Maps and the first menu line is `lat, lng`, ready to
  copy. Paste the two numbers into the `lat` and `lng` columns.
- For `extra_locations`, use the pipe `|` to separate fields and a semicolon
  `;` to separate locations. The pipe avoids conflicts with commas inside
  labels.
- For `tags`, use `;` (semicolons) to separate keywords so they don't conflict
  with commas in the surrounding text fields.
- Long text fields (`description`, `details`) can include commas / quotes —
  Excel / Numbers / Sheets handle CSV quoting automatically when you save.
- If you write `TBD` in any field, just let me know and we'll fill it in
  during the next pass.
