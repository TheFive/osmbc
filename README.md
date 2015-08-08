# osmbc
Open Street Map Blog Collector
## Summary
OSMBC is a small tool to support the editorial process of the [OpenStreetMap](www.openstreetmap.org). [Wochennotiz](blog.openstreetmap.de).
it enables editor to collect references to news easily and supports editing them in markdown later.
From edited markdown the final blog entry (will be|is) created.
## Status 
Current status is prototyp, that xan be used for discussing process
## Tooling
* Database: postgres (>= 9.3) JSON support required, 
* Webserver: node.js (with express and JADE rendering)
