# osmbc

Open Street Map Blog Collector

Master:   | develop:
----------|----------------------
[![Build Status](https://travis-ci.org/TheFive/osmbc.svg?branch=master)](https://travis-ci.org/TheFive/osmbc) | [![Build Status](https://travis-ci.org/TheFive/osmbc.svg?branch=develop)](https://travis-ci.org/TheFive/osmbc)
[![codecov.io](https://codecov.io/github/TheFive/osmbc/coverage.svg?branch=master)](https://codecov.io/github/TheFive/osmbc?branch=master) | [![codecov.io](https://codecov.io/github/TheFive/osmbc/coverage.svg?branch=develop)](https://codecov.io/github/TheFive/osmbc?branch=develop)

Timeline for code coverage on development branch:
![codecov.io](http://codecov.io/github/TheFive/osmbc/branch.svg?branch=develop)

## Summary

OSMBC is a small tool to support the editorial process of the [OpenStreetMap]&nbsp;[Wochennotiz]. It enables editores collects references for news easily, and supports editing them in Markdown later. From edited Markdown code, the final blog entry will be (or is) created.

[OpenStreetMap]: http://www.openstreetmap.org
[Wochennotiz]: http://blog.openstreetmap.de

## Status 

The current status is: **prototype**. That can be used for discussing the process.

## Tooling

* Database: postgres (>= 9.3) and JSON support required
* Webserver: node.js with express and JADE rendering

More info in the [Installation Guide](Install_Guide.md).
