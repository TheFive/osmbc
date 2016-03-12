# OSMBC

Open Street Map Blog Collector, a tool for editing the weekly news in OpenStreetMap.


## Summary

OSMBC is a small tool to support the editorial process of the [OpenStreetMap]&nbsp;[Wochennotiz]. It enables editores collects references for news easily, and supports editing them in Markdown later. From edited markdown code, the final blog entry is created. As all articles can be edited "bilinual" so in german and in english, the production of the [WeeklyOSM], the international variant of the Wochennotiz, is supported by OSMBC too.


[OpenStreetMap]: http://www.openstreetmap.org
[Wochennotiz]: http://blog.openstreetmap.de
[WeeklyOSM]: http://www.weeklyosm.eu/


## Status 

The system is active used since Wochennotiz 272 in September 2015. 

The running instance for the editors is: https://thefive.sabic.uberspace.de/osmbc.html  
For tests, use the development instance: http://thefive.sabic.uberspace.de/devosmbc/osmbc.html

## Next Steps & Progress

[![Stories in Ready](https://badge.waffle.io/TheFive/osmbc.png?label=ready&title=Ready)](https://waffle.io/TheFive/osmbc)
[![Stories in Progress](https://badge.waffle.io/TheFive/osmbc.png?label=in progress&title=In Progress)](https://waffle.io/TheFive/osmbc)

[![Throughput Graph](https://graphs.waffle.io/TheFive/osmbc/throughput.svg)](https://waffle.io/TheFive/osmbc/metrics)

## Software Build Status

Master:   | develop:
----------|----------------------
[![Build Status](https://travis-ci.org/TheFive/osmbc.svg?branch=master)](https://travis-ci.org/TheFive/osmbc) | [![Build Status](https://travis-ci.org/TheFive/osmbc.svg?branch=develop)](https://travis-ci.org/TheFive/osmbc)
[![codecov.io](https://codecov.io/github/TheFive/osmbc/coverage.svg?branch=master)](https://codecov.io/github/TheFive/osmbc?branch=master) | [![codecov.io](https://codecov.io/github/TheFive/osmbc/coverage.svg?branch=develop)](https://codecov.io/github/TheFive/osmbc?branch=develop)

Timeline for code coverage on development branch:
![codecov.io](http://codecov.io/github/TheFive/osmbc/branch.svg?branch=develop&agg=month)

Timeline for code coverage on master branch:
![codecov.io](http://codecov.io/github/TheFive/osmbc/branch.svg?branch=master&agg=month)


## Tooling

* Database: postgres (>= 9.3) and JSON support required
* Webserver: node.js with express and JADE rendering

More info in the [Installation Guide](Install_Guide.md).
