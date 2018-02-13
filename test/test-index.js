const d = require('debug')
const fs = require('fs')
const test = require('tape')
const join = require('path').join
const fixtures = require('./fixtures/indexes')

// Start stubbing
const proxyquire = require('proxyquire')
const index = proxyquire('../.', {
  'aws-sdk': {
    S3: s3
  },
  fs: {
    createReadStream: () => {}
  }
})

function s3 () {
  const self = this
  self.getObject = getObject
  self.upload = upload
  function getObject (p) {
    d('mock-s3-getObject')(p)
    return {
      createReadStream: createReadStream
    }
  }
  function createReadStream () {
    const i = join(__dirname, 'fixtures', 'index.json')
    d('mock-createReadStream')(i)
    return fs.createReadStream(i)
  }
  function upload (p, cb) {
    d('mock-upload')(p.Bucket, p.Key)
    cb && cb()
  }
}
// End stubbing

test('specIndex', t => {
  t.plan(2)
  let spec = {
    'apichef-automation': '5.26.0'
  }
  let expected = {
    _id: 'apichef-automation',
    name: 'apichef-automation',
    'dist-tags':
      { latest: '5.26.0' },
    versions: {
      '0.0.1': { tarball: 's3://apichef-npm-deps/bla/-/bla-0.0.1.tgz' },
      '0.0.2': { tarball: 's3://apichef-npm-deps/bla/-/bla-0.0.2.tgz' },
      '5.26.0': { tarball: 's3://apichef-npm-deps/apichef-automation/-/apichef-automation-5.26.0.tgz' }
    }
  }
  const i1 = index.specIndex(spec, fixtures.index1)
  t.deepEqual(i1, expected, '1 - index looks good')

  spec = {
    'apichef-automation': '8.26.0'
  }
  expected = {
    _id: 'apichef-automation',
    name: 'apichef-automation',
    'dist-tags':
      { latest: '8.26.0' },
    versions: {
      '0.0.1': { tarball: 's3://apichef-npm-deps/bla/-/bla-0.0.1.tgz' },
      '0.0.2': { tarball: 's3://apichef-npm-deps/bla/-/bla-0.0.2.tgz' },
      '5.26.0': { tarball: 's3://apichef-npm-deps/apichef-automation/-/apichef-automation-5.26.0.tgz' },
      '8.26.0': { tarball: 's3://apichef-npm-deps/apichef-automation/-/apichef-automation-8.26.0.tgz' }
    }
  }
  const i2 = index.specIndex(spec, fixtures.index1)
  t.deepEqual(i2, expected, '2 - index looks good')
})

test('spec', t => {
  t.plan(3)
  t.deepEqual(index.spec('bla-0.0.1.tgz'), { bla: '0.0.1' }, 'spec 1 looks good')
  t.deepEqual(index.spec('bla-die-bla-10.0.10.tgz'), { 'bla-die-bla': '10.0.10' }, 'spec 2 looks good')
  t.deepEqual(index.spec('bla-0.0.1'), undefined, 'only tarballs are processed')
})

test('tarball', t => {
  t.plan(3)
  let installTarball = index.install({ 'apichef-automation': '10.26.0' }, fixtures.index2)
  t.equal(installTarball, 's3://apichef-npm-deps/bla/-/bla-10.26.0.tgz', '1 - correct tarball selected')
  installTarball = index.install({ 'apichef-automation': '0.0.2' }, fixtures.index2)
  t.equal(installTarball, 's3://apichef-npm-deps/bla/-/bla-0.0.2.tgz', '2 - correct tarball selected')
  installTarball = index.install({ 'apichef-automation': '0.0.10' }, fixtures.index2)
  t.equal(installTarball, undefined, '3 - correct tarball not found')
})

test('publish', t => {
  t.plan(2)
  index.publish('test/fixtures/apichef-automation-5.26.0.tgz', (e, r) => {
    t.equal(e, undefined, '1 - no error found')
    t.deepEqual(r, undefined, '1 - ok')
  })
})
