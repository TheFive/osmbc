# OSMBC

OpenStreetMap Blog Collector, a web tool for the editorial workflow of a
multilingual weekly news blog.

[![Tests](https://github.com/TheFive/osmbc/actions/workflows/test.yml/badge.svg?branch=master)](https://github.com/TheFive/osmbc/actions/workflows/test.yml)


## Summary

OSMBC supports a team of editors producing a regular news issue together.
Editors collect links to news, write and edit the articles in Markdown,
review each other's work and finally export the finished issue. Every
article can be written in several languages side by side, so one issue can
be published in parallel language editions.

It was built for the [OpenStreetMap] weekly news: the German
[Wochennotiz] and its international variant [WeeklyOSM]. It is not tied to
OpenStreetMap, though, and can be used for any multilingual blog that is
put together by a team.

[OpenStreetMap]: https://www.openstreetmap.org
[Wochennotiz]: https://blog.openstreetmap.de
[WeeklyOSM]: https://weeklyosm.eu/


## Features

* Collect references (URL plus a short note) and sort them into the
  categories of an issue
* Edit articles in Markdown, with a preview for each language
* Machine translation between languages via DeepL (optional)
* Workflow per issue: open → edit → closed, with review and close status
  per language
* Comments and notifications to editors by mail, Slack or Mattermost
* Export to WordPress HTML, Markdown or Hugo (configurable export profiles)
* Event list imported from [osmcal](https://osmcal.org)
* Login via OpenStreetMap OAuth, with full and guest users


## Status

OSMBC has been in daily use since Wochennotiz issue 272 (September 2015)
and is still actively maintained. Changes are listed in the
[Changelog](CHANGELOG.md).


## Requirements

* [Node.js](https://nodejs.org) (tested with 22 LTS)
* [PostgreSQL](https://www.postgresql.org) (tested with 16)

The server uses Express with Pug templates. Details are in the
[Installation Guide](docs/install.md).


## Documentation

* [Installation Guide](docs/install.md): setting up a server
* [Configuration](docs/config.md): the configuration file
* [Export Profiles](docs/export-profiles.md) and [Hugo Export](docs/hugo-export.md)
* [API](docs/API.md): interface for external tools
* [User Help](help/): the help pages shown inside OSMBC
* [Development](docs/development.md): local setup and tests
* [Tools](tools/README.md): maintenance and test scripts
* [Contributing](CONTRIBUTING.md): commit message format


## Reporting Bugs

Bug reports and feature requests are welcome as
[GitHub issues](https://github.com/TheFive/osmbc/issues). To help get to
the point quickly, please make sure your report

1. refers to the current release. If not, please name the version you are
   using.
2. describes briefly what you did.
3. describes briefly what happened, and what you expected to happen.

Screenshots and links help with 2. and 3., but do not replace them.
"is not working" or "is broken" is not a description. The way you got to
a result matters, because there are often several ways to do the same
thing in OSMBC.


## License

OSMBC is released under the [MIT License](LICENSE).
