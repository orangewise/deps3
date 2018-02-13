process.env.AWS_PROFILE = process.env.AWS_PROFILE || 'apichef'
const bucket = process.env.AWS_DEPS3_BUCKET || 'apichef-npm-deps'

const d = require('debug')
const AWS = require('aws-sdk')
const s3 = new AWS.S3()
const fs = require('fs')
const path = require('path')
const join = path.join
const semver = require('semver')
const concat = require('concat-stream')
const sortObj = require('sort-object')

// Publish a tarball to s3:
// - fetch the index from s3 and update it
exports.publish = publish
function publish (file, cb) {
  const modSpec = spec(file)
  getS3Index(modSpec, bucket, (e, i) => {
    if (e) return cb && cb(e)

    // construct index
    const index = specIndex(modSpec, i)
    d('publish')(index)
    return uploadTarballAndUpdateIndex(modSpec, bucket, file, index, cb)
  })
}

exports.install = install
function install (spec, index) {
  // retrieve the index and
  // pick the latest version that satisfies
  d('install')(spec)
  const version = spec[Object.keys(spec)[0]]
  d('install')('version', version)
  return getTarball(version, index)
}

// const request = require('request')
// const tar = require('tar-fs')
// const gunzip = require('gunzip-maybe')
// const npmrc = require('../../utils/npmrc')

// module.exports = (pkg, cwd) => {
//   const options = {
//     url: pkg.tarball,
//     headers: {
//       'User-Agent': npmrc.userAgent
//     }
//   }
//   return new Promise((resolve, reject) => {
//     const extract = tar.extract(cwd, {strip: 1})
//     extract.on('finish', () => {
//       resolve()
//     })
//     request.get(options)
//       .pipe(gunzip())
//       .pipe(extract)
//       .on('error', reject)
//   })
// }

exports.getTarball = getTarball
function getTarball (version, index) {
  const i = index || { index: 'from s3' }
  const latestVersion = i['dist-tags'].latest
  d('install-latestVersion')(latestVersion)
  let tarball
  if (semver.satisfies(latestVersion, version)) {
    d('install')('latest version satisfies!')
    tarball = i.versions[latestVersion].tarball
  } else {
    // loop through versions, descending
    const versions = sortObj(i.versions, { sortOrder: 'DESC' })
    d('install-loop')(versions)
    Object.keys(versions).some(v => {
      d('install-loop')(v)
      if (semver.satisfies(v, version)) {
        d('install-loop')('this version satisfies!', v)
        tarball = versions[v].tarball
        return true
      }
    })
  }
  return tarball
}

exports.spec = spec
function spec (file) {
  // only tarballs can be published
  if (path.extname(file) !== '.tgz') return
  const basename = path.basename(file, 'tgz')
  d('spec')(basename)
  const semverIndex = basename.lastIndexOf('-')
  const mod = basename.substring(0, semverIndex)
  const version = basename.substring(semverIndex + 1, basename.length - 1)
  const s = {}
  s[mod] = version
  d('spec')(s)
  return s
}

// construct the package index
exports.specIndex = specIndex
function specIndex (spec, index) {
  d('specIndex')('-index', index)
  let theIndex = Object.assign(index)
  Object.keys(spec).forEach(k => {
    const thisVersion = spec[k]
    const tarball = `${k}-${thisVersion}.tgz`
    d('specIndex')('thisVersion', thisVersion)

    // determine latest version
    let latest = (theIndex && theIndex['dist-tags'] && theIndex['dist-tags'].latest)
      ? setLatest(theIndex['dist-tags'].latest, thisVersion)
      : thisVersion

    // set known versions
    let versions = (theIndex && theIndex.versions)
      ? theIndex.versions
      : {}

    // all together now
    theIndex['_id'] = k
    theIndex['name'] = k
    theIndex['dist-tags'] = {}
    theIndex['dist-tags'].latest = latest
    theIndex.versions = versions
    theIndex.versions[thisVersion] = {}
    theIndex.versions[thisVersion].tarball = `s3://${bucket}/${k}/-/${tarball}`
    theIndex.versions = sortObj(theIndex.versions)
    d('specIndex')(theIndex.versions)
  })
  return theIndex
}

function setLatest (current, thisVersion) {
  return semver.gt(current, thisVersion)
    ? current
    : thisVersion
}

exports.getS3Index = getS3Index
function getS3Index (spec, bucket, cb) {
  d('getS3Index')(spec)
  const pkg = Object.keys(spec)[0]
  const params = {
    Bucket: bucket,
    Key: `${pkg}/index.json`
  }
  d('getS3Index')(params)
  const readStream = s3.getObject(params).createReadStream()
  readStream
    .pipe(concat((r) => {
      let body = r.toString('utf8')
      body = JSON.parse(body)
      d('getS3Index-concat')(body)
      cb(null, body)
    }))
  readStream.on('error', (e) => {
    d('getS3Index-error')('e.code', e.code)
    // asume this is a new module
    let index = (e.code === 'NoSuchKey') ? {} : undefined
    return cb(null, index)
  })
}

exports.uploadTarballAndUpdateIndex = uploadTarballAndUpdateIndex
function uploadTarballAndUpdateIndex (spec, bucket, file, index, cb) {
  d('upload-tarball')(spec, file, index)
  const pkg = Object.keys(spec)[0]
  let body = fs.createReadStream(join(process.cwd(), file))
  const tarballParams = {
    Bucket: bucket,
    Key: `${pkg}/-/${file}`,
    Body: body
  }
  d('upload-tarball-tarballParams')(tarballParams.Bucket, tarballParams.Key)
  s3.upload(tarballParams, (e) => {
    if (e) return cb(e)

    // only update the index if tarball upload successfully
    const indexParams = {
      Bucket: bucket,
      Key: `${pkg}/index.json`,
      Body: Buffer.from(JSON.stringify(index))
    }
    d('upload-tarball-indexParams')(indexParams.Bucket, indexParams.Key)
    s3.upload(indexParams, (e) => {
      if (e) return cb(e)
      cb && cb()
    })
  })
}
