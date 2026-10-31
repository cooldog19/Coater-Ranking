# Park map sources

The map runs entirely from bundled public data. It does not contact a map service, geocode your collection, request your location or use an API key. Only the source links you choose to open contact other websites.

## Land outline

The land outline is derived from **Natural Earth 1:110m land** via the [Natural Earth vector repository](https://github.com/nvkelso/natural-earth-vector/blob/master/geojson/ne_110m_land.geojson). Coordinates are projected to a simple longitude/latitude world view and rounded for display. Natural Earth data is [public domain](https://www.naturalearthdata.com/about/terms-of-use/). The outline is generalized and does not provide streets or exact local boundaries.

## Park locations and approximate centers

Park coordinates, English labels, aliases and countries come from [Wikidata](https://www.wikidata.org/). They are [CC0](https://www.wikidata.org/wiki/Wikidata:Licensing). Each bundled park includes its Wikidata source URL. The maintenance query selects amusement parks (including subclasses) with coordinate location and an English label. It may omit places classified differently or lacking coordinates, and community coordinates can be inaccurate.

Additional approximate park centers are derived from public ride-coordinate fields in the same **Coasterpedia** article cache used for the coaster catalog. Coasterpedia contributors license their articles under [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/); see [their reuse guidance](https://coasterpedia.net/wiki/Help:Reusing_content_from_Coasterpedia). Records with `approximate: true` and `license: CC-BY-SA-4.0` retain a `sources` array linking every contributing article revision. Ride coordinates are grouped by normalized park/country, a median center is computed, and groups with any coordinate more than 10 km from that center are omitted. Existing matching Wikidata locations take precedence. Country abbreviations and UK constituent-country labels are normalized for matching. A center derived from one ride can be near that ride rather than a park entrance.

The combined derived location dataset is distributed under **CC BY-SA 4.0**, with Wikidata CC0 and Natural Earth public-domain components retaining their original terms. Redistribution of the derived Coasterpedia locations or adaptations requires attribution and the same license. This data license does not apply to the application code or personal ranking decisions/notes.

`park-map-data.js` records the snapshot date. Map pins describe park locations, not a visitor's device or current position. Exact normalized park/alias and country matches are used; ambiguous matches remain unpinned. Counts refer to logged ride credits, not visits or number of times ridden. Nearby parks are clustered at the current zoom level, with credit counts summed across the area. Selecting a cluster lists its constituent parks and rides.

Current official-API park coordinates in `catalog.json` supplement and take precedence over the older fallback during Statistics rendering. These normalized park records retain their Coasterpedia revision source and CC BY-SA 4.0 attribution; see `CATALOG_LICENSE.md`. The original fallback above remains attributed to its historical sources.

After bootstrapping the official catalog, the optional `node scripts/update-park-map.cjs` command refreshes the Wikidata/Natural Earth fallback and adds source-attributed official park coordinates. Review and commit it separately. It no longer reads or fetches a bulk Coasterpedia article cache. No visitor collections are sent to providers.
