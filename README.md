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

### Development Version

The development version is used, to let the team test new features without affecting the productive system. If there are no now features, the developement version is not updated, so please ask me for an update to the actual branch, if any problem occurs.

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
(Every dot is a month)
![codecov.io](http://codecov.io/github/TheFive/osmbc/branch.svg?branch=develop&agg=month&hg=on&vg=on&legend=on)

Timeline for code coverage on master branch:
(Every dot is a month)
![codecov.io](http://codecov.io/github/TheFive/osmbc/branch.svg?branch=master&agg=month&hg=on&vg=on&legend=on)


## Tooling

* Database: postgres (>= 9.3) and JSON support required
* Webserver: node.js with express and JADE rendering

More info in the [Installation Guide](Install_Guide.md).


## Support the Developer

I am happy to do any bugfixes for the system. But please make sure, that your error report here in Git fullfills the following rules

a) The error message occurs in the productive system, if you are working on the development version, please put the info in the bug report, to avoid unnecessary work (see section development version above).

b) The error message occurs in the current version, so it can can be reproduced on the day, the error message has given. (than you do not need to put any version number to your request, otherwise please include the version number of OSMBC).

c) Please describe shortly what you have done, to produce the error.

d) Please describe shortly, what the result of your action was, and what result you have expected.

e) Pictures and Hyperlinks can support c) and d) but does not replace them.

f) "is not working" or "is broken" obvious does not fullfill c) and d).

The rules does support the developer to come quicker to the point. Sometimes you are using other ways in OSMBC to come to your result and the way coming to a result is importand for bugfixing.
