deps3
======
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