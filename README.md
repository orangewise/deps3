deps3
======
Publish to and install private module from an s3 bucket.

# Installation

```bash
npm i -g deps3
```

# Usage

## Publishing

```bash
export AWS_PROFILE='apichef'
export AWS_DEPS3_BUCKET='bla'
deps3 publish <your bundled module>.tgz
```

## Proxy

If you need to go through a proxy:

```bash
export http_proxy=http://....
deps3 <command> <tarball|package>
```