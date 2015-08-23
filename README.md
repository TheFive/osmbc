# osmbc
Open Street Map Blog Collector

Master:   | develop:
----------|----------------------
[![Build Status](https://travis-ci.org/TheFive/osmbc.svg?branch=master)](https://travis-ci.org/TheFive/osmbc) | [![Build Status](https://travis-ci.org/TheFive/osmbc.svg?branch=develop)](https://travis-ci.org/TheFive/osmbc)
[![codecov.io](https://codecov.io/github/TheFive/osmbc/coverage.svg?branch=master)](https://codecov.io/github/TheFive/osmbc?branch=master) | [![codecov.io](https://codecov.io/github/TheFive/osmbc/coverage.svg?branch=develop)](https://codecov.io/github/TheFive/osmbc?branch=develop)

Timeline code coverage on development branch:
![codecov.io](http://codecov.io/github/TheFive/osmbc/branch.svg?branch=develop)

## Summary
OSMBC is a small tool to support the editorial process of the [OpenStreetMap](www.openstreetmap.org). [Wochennotiz](blog.openstreetmap.de).
it enables editor to collect references to news easily and supports editing them in markdown later.
From edited markdown the final blog entry (will be|is) created.
## Status 
Current status is prototyp, that can be used for discussing the process.
## Tooling
* Database: postgres (>= 9.3) JSON support required, 
* Webserver: node.js (with express and JADE rendering)
