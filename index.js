const d = require('debug')
const AWS = require('./lib/aws')
const s3 = new AWS.S3()
const fs = require('fs')
const path = require('path')
const join = path.join
const semver = require('semver')
const concat = require('concat-stream')
const sortObj = require('sort-object')
const spawn = require('child_process').spawn

// Publish a tarball to s3:
// - fetch the index from s3 and update it
// - upload the tarball
// - upload the index
exports.publish = publish
function publish (file, cb) {
  const dir = path.dirname(file)
  const pkgName = require(join(process.cwd(), dir, 'package.json')).name
  const spec = specFromTarball(pkgName, file)
  getS3Index(spec, AWS.bucket, (e, i) => {
    if (e) return cb && cb(e)

    // construct index
    const index = specIndex(spec, i)
    d('publish')(index)
    return uploadTarballAndUpdateIndex(spec, AWS.bucket, file, index, cb)
  })
}

exports.install = install
function install (pkg, cb) {
  // retrieve the index and
  // pick the latest version that satisfies
  d('install')(pkg)
  const spec = specFromPkg(pkg)
  getS3Index(spec, AWS.bucket, (e, i) => {
    if (e) return cb && cb(e)
    const version = spec[Object.keys(spec)[0]]
    d('install-version')(version)
    const pkg = Object.keys(spec)[0]

    const installed = installedVersion(pkg)
    if (
      !installed ||
      installed !== i['dist-tags'].latest
    ) {
      d('install')('version', version, i)
      const tarball = getTarball(version, i)
      if (!tarball) return cb && cb(new Error(`${JSON.stringify(spec)} not found`))
      d('install-tarball')(tarball)
      return downloadTarballAndInstall(pkg, tarball, cb)
    } else {
      d('install-installed')(installed, 'satisfies')
      return cb()
    }
  })
}

exports.getTarball = getTarball
function getTarball (requestedVersion, index) {
  const i = index
  const latestVersion = i['dist-tags'].latest
  d('install-latestVersion')(latestVersion)

  const version = (requestedVersion === 'latest')
    ? latestVersion
    : requestedVersion
  d('install-version')(version)

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

exports.specFromPkg = specFromPkg
function specFromPkg (pkg) {
  d('specFromPkg')(pkg)
  const s = {}
  const semverIndex = (pkg.lastIndexOf('@') > 0)
    ? pkg.lastIndexOf('@')
    : pkg.length
  const mod = pkg.substring(0, semverIndex)
  const version = pkg.substring(semverIndex + 1, pkg.length)
  s[mod] = version || 'latest'
  d('specFromPkg')(s)
  return s
}

exports.specFromTarball = specFromTarball
function specFromTarball (pkg, file) {
  // only tarballs can be published
  d('spec-pkg')(pkg)
  if (path.extname(file) !== '.tgz') return
  const basename = path.basename(file, 'tgz')
  d('spec-basename')(basename)
  const semverIndex = pkg.length // basename.lastIndexOf('-')
  const mod = basename.substring(0, semverIndex)
  const version = basename.substring(semverIndex + 1, basename.length - 1)
  const s = {}
  s[mod] = version
  d('spec->')(s)
  return s
}

// construct the package index
exports.specIndex = specIndex
function specIndex (spec, index) {
  d('specIndex-spec')(spec)
  d('specIndex-index')(index)
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
    theIndex.versions[thisVersion].tarball = `s3://${AWS.bucket}/${k}/-/${tarball}`
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
  const tarball = path.basename(file)
  const pkg = Object.keys(spec)[0]
  let body = fs.createReadStream(join(process.cwd(), file))
  const tarballParams = {
    Bucket: bucket,
    Key: `${pkg}/-/${tarball}`,
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

function downloadTarballAndInstall (pkg, tarball, cb) {
  d('downloadTarballAndInstall-tarball')(tarball)
  const basename = path.basename(tarball)
  const params = {
    Bucket: AWS.bucket,
    Key: `${pkg}/-/${basename}`
  }
  d('downloadTarballAndInstall')(params)
  const writeStream = fs.createWriteStream(basename)
  const readStream = s3.getObject(params).createReadStream()
  readStream
    .pipe(writeStream)
  readStream.on('error', (e) => {
    d('downloadTarballerror')(e)
    return cb(e)
  })
  readStream.on('finish', install)
  readStream.on('close', install)
  function install () {
    d('downloadTarball')('close-or-finish')
    if (process.env.DEPS3_SKIP_INSTALL) return cb(null, basename)
    return npmInstall(basename, cb)
  }
}

function npmInstall (tarball, cb) {
  d('npm-install')('start')
  const env = Object.assign({}, process.env)
  const script = spawn('npm', ['install', tarball], { cwd: process.cwd(), shell: true, env: env })
  script.stdout.on('data', (data) => {
    d('npm-install-stdout')(data.toString())
  })
  script.stderr.on('data', (data) => {
    d('npm-install-stderr')(data.toString())
  })
  script.on('error', cb)
  script.on('close', (data) => {
    d('npm-install-close')(data)
    return cb(null, tarball)
  })
}

function installedVersion (pkg) {
  let version
  try {
    version = require(join(process.cwd(), 'node_modules', pkg, 'package.json')).version
  } catch (e) {
    d('installedVersion-error')(e)
  }
  d('installedVersion')(version)
  return version
}
