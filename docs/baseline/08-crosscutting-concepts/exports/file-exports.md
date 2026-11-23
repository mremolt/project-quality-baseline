# File Exports and Generated Documents

Files the server produces for download or for another system: CSV, spreadsheets (`.xlsx`), PDF, and the XML, FO, SVG or HTML that some of them are built from. Uploads and imports are covered by SPRING-SEC-26 / the NestJS upload rules and ARCH-UC-19; e-mail by SPRING-I18N-05 and its NestJS equivalent.

## Rules

### Formats

- **EXP-01: Every export is either for people or for a machine, and the product's docs say which.** A human export (a report, a timesheet) is rendered in the recipient's stored language (I18N table "Who does what"): localized headers, dates and numbers. A machine export (payroll, accounting, another system's import) has one fixed format chosen by its consumer and is never localized; when people of several languages need it, the variants are explicit choices in the dialog, each a fixed format.
  *Why:* a machine import breaks on localized separators and headers; a person cannot read ISO timestamps and decimal hours.
- **EXP-02: A machine format is written down and pinned by a test.** The product's docs (chapter 8 or a format file next to the adapter) state encoding, line endings, separator, quoting, header names, date format (ISO 8601 unless the consumer demands otherwise), decimal separator and the unit of every number; an adapter test compares the output for fixed input with a committed sample file.
- **EXP-03: A CSV meant to be opened in Excel is UTF-8 with a byte order mark; spreadsheets for people are preferably `.xlsx`.** Without the BOM Excel reads UTF-8 as the system code page and breaks umlauts. The separator Excel expects depends on the user's regional settings, which is one more reason to offer `.xlsx` for people and keep CSV for machines (EXP-02).

### Security

- **EXP-04: Export cells that start with a formula character are neutralised.** A CSV or spreadsheet cell starting with `=`, `+`, `-`, `@`, a tab or a carriage return gets a single-quote prefix (or is written as a typed string cell in `.xlsx`), for every value that users or other systems can influence (names, comments, descriptions). A test exports a hostile value (`=HYPERLINK(…)`) and asserts it is inert. A machine format whose consumer rejects the prefix documents the exception (EXP-02) and is not offered as a download to people.
  *Why:* formula injection (CSV injection) runs in the victim's spreadsheet with their privileges.
- **EXP-05: XML, FO, SVG and HTML are built with a writer or a templating engine that escapes by context, never by string concatenation, even with manual escaping.** Java: StAX `XMLStreamWriter` or a DOM; TypeScript: a library that builds the tree. A test renders a hostile name (`<`, `&`, quotes, control characters) and asserts well-formed output. Static analysis findings on concatenated XML (FindSecBugs `POTENTIAL_XML_INJECTION`) are fixed this way, not suppressed (SEC-REV-02).
- **EXP-06: Server-side rendering of HTML or SVG to PDF or images has no network access.** The renderer resolves no external URLs (images, fonts, stylesheets, `file:`): resources are embedded or served from a fixed allow-list on the classpath or in the bundle, and the renderer's URL resolver refuses everything else. A test renders markup that references an external URL and asserts no request is made.
  *Why:* a renderer that fetches URLs from user-influenced markup is a server-side request forgery (SSRF) and local-file-read vector.

### Architecture and delivery

- **EXP-07: Exports are produced by an outgoing file adapter behind a port and delivered as a binary download.** The use case loads and authorizes the data and passes a format-neutral model to the port; the adapter lives in `adapter/out/file` with one sub-package per format (`file/csv`, `file/xlsx`, `file/pdf`) so format helpers can be shared inside it (ARCH-DEP-05; Spring stereotype `@FileAdapter`, SPRING-ARCH-04). The REST operation declares the binary media type (API-CON-13), sets `Content-Disposition: attachment` with an RFC 6266 `filename*`, `Cache-Control: no-store` when the file holds personal data, and streams large files. The data read is bounded like any query (API-REST-08); a long export runs as a job and offers the file when done.
- **EXP-08: Generated documents need no fonts, AWT or native libraries from the image.** Fonts are embedded from the application's resources; libraries that need AWT or fontconfig (SVG rasterisers, Java2D-based charting) are avoided, and where one is unavoidable the smoke tier runs one scenario of the feature against the built image (REL-RUN-08). A unit test guards the choice (e.g. no SVG in the PDF template).
- **EXP-09: PDFs for people meet PDF/UA-1 and are checked automatically, plus once per release by hand.** Tagged structure in reading order, document title and language, alternative text for figures, real text (no text as image), table headers marked, contrast of the palette checked in colour and greyscale (A11Y-09). veraPDF (PDF/UA-1 profile) runs in the adapter tests, with structure assertions (e.g. PDFBox) for the product's own tags; the screen-reader read-through and the side-by-side look are items of the L6 release checklist (A11Y-24).
- **EXP-10: A heavy export loads its data inside the read transaction and renders outside it, behind a concurrency limit.** Heavy means a PDF or spreadsheet up to the product's row limit. The use case returns the format-neutral model (EXP-07) after the transaction ends, and the file adapter renders it then, so no database connection is held while a PDF is laid out. Rendering runs behind a limit per instance (a semaphore or `@ConcurrencyLimit` in the adapter; NestJS: a bounded queue), sized from the memory one maximum-size render needs against the container limit; when the limit is reached the request gets `503` with `Retry-After`, never an unbounded queue. A test renders an export at the row limit and asserts its time and, in the container smoke test or a load test, that it fits the memory limit; the limit and the measured peak are recorded in chapter 7 with the timeout ladder (RES-TMO-04).
  *Why:* with virtual threads or an event loop every request is admitted; a few concurrent maximum-size PDFs exhaust the heap (OOM kill) and hold pool connections, so unrelated requests fail.

An export of other people's personal data also writes an audit event (SEC-AUD-05, [vulnerability-management.md](../security/vulnerability-management.md)).

## Anti-patterns

- A payroll CSV with German headers and decimal commas for German users and English ones for English users.
- `"<name>" + escape(value) + "</name>"` scattered through an adapter.
- An HTML-to-PDF renderer that follows `<img src="http://169.254.169.254/…">`.
- A PDF feature that works in every test and fails in production because the distroless image has no fonts.

*Agent checklist in [checklists/shared.md](../../checklists/shared.md), section "File Exports and Generated Documents".*
