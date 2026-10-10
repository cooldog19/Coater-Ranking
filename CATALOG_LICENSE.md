# Tracklist catalog attribution

The bundled `catalog-data.js` contains structured ride facts extracted from public Coasterpedia articles, supplemented with Wikidata records. It contains no article prose, photographs, logos, or video files.

**Coasterpedia contributors** provide the source articles under [Creative Commons Attribution-ShareAlike 4.0](https://creativecommons.org/licenses/by-sa/4.0/). The derived catalog is distributed under that license. Every Coasterpedia-derived record includes a `source` link to the article revision used for extraction. Names, parks, countries, manufacturers, categories, operating status, RCDB identifiers, and YouTube identifiers have been extracted and normalized. USA and UK were expanded; type categories and status text were normalized; records without named parks were omitted. See [Coasterpedia’s reuse guidance](https://coasterpedia.net/wiki/Help:Reusing_content_from_Coasterpedia).

**Wikidata contributors** provide structured data under [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/). Supplemental records include a source item link. See [Wikidata’s data access policy](https://www.wikidata.org/wiki/Wikidata:Data_access).

The catalog is separate from application code and users’ original notes and ranking decisions. Redistributing this derived catalog or changes to it requires attribution and the same catalog license. That does not impose a license on your original personal notes.

This is a dated community-data snapshot, not an official park inventory or a live operating-status feed. Historic, relocated, closed, planned, and current rides may be included. A record may be missing, renamed, or outdated. Follow the record’s Source or RCDB link to verify details. A POV video may become unavailable; YouTube search is the fallback when no source video is provided.

Refresh scripts are explicit maintenance commands; visitors search the bundled catalog without sending their collection or search terms to catalog providers. `scripts/update-catalog.cjs` refreshes the Wikidata supplement. `scripts/update-coasterpedia.cjs` reads public articles using MediaWiki’s read API, uses a resumable ignored cache, and writes the combined snapshot only after a complete successful fetch. For a fresh Coasterpedia refresh, remove only `test-results/catalog-cache/` first. Catalog refreshes are not automatic deployment steps.
