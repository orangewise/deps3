deps3
======

[![npm version][npm-badge]][npm-url]
[![Build Status][travis-badge]][travis-url]
[![JavaScript Style Guide][standardjs-badge]][standardjs-url]

Publish to and install private module from an s3 bucket.
Installation of the tarball is delegated to npm so make sure it is installed.

# Installation

```bash
npm i -g deps3
```

# Usage

## Publish

```bash
export AWS_PROFILE='apichef'
export AWS_DEPS3_BUCKET='bla'
deps3 publish <your bundled module>.tgz
```

## Install

```bash
export AWS_PROFILE='apichef'
export AWS_DEPS3_BUCKET='bla'
deps3 install <your-module-on-s3@latest>
```

## Proxy

If you need to go through a proxy:

```bash
export http_proxy=http://....
deps3 <command> <tarball|package>
```

[npm-badge]: https://badge.fury.io/js/deps3.svg
[npm-url]: https://badge.fury.io/js/deps3
[travis-badge]: https://travis-ci.org/orangewise/deps3.svg?branch=master
[travis-url]: https://travis-ci.org/orangewise/deps3
[standardjs-badge]: https://img.shields.io/badge/code%20style-standard-brightgreen.svg
[standardjs-url]: http://standardjs.com/
