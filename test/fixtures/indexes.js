const bucket = 'apichef-npm-deps'

const index1 = {
  'dist-tags': {
    latest: '5.26.0'
  },
  versions: {
    '0.0.1': {
      tarball: `s3://${bucket}/bla/-/bla-0.0.1.tgz`
    },
    '0.0.2': {
      tarball: `s3://${bucket}/bla/-/bla-0.0.2.tgz`
    },
    '5.26.0': {
      tarball: `s3://${bucket}/bla/-/bla-5.26.0.tgz`
    }
  }
}

const index2 = {
  'dist-tags': {
    latest: '10.26.0'
  },
  versions: {
    '0.0.1': {
      tarball: `s3://${bucket}/bla/-/bla-0.0.1.tgz`
    },
    '0.0.2': {
      tarball: `s3://${bucket}/bla/-/bla-0.0.2.tgz`
    },
    '10.26.0': {
      tarball: `s3://${bucket}/bla/-/bla-10.26.0.tgz`
    }
  }
}

const indexes = {
  index1: index1,
  index2: index2
}
module.exports = indexes
