const d = require('debug')('cli')
const fs = require('fs')
const join = require('path').join
const pkg = require('../package.json')
const minimist = require('minimist')

const cli = {}
cli.usage = usage
cli.parse = parse
module.exports = cli

function parse () {
  let run
  const opts = minimist(process.argv.slice(2))
  d('opts', opts)
  const commands = opts._
  d('commands', commands)
  if (commands.length !== 2) {
    info()
    console.log(usage())
  } else {
    if (commands[0] === 'publish') {
      run = {}
      run['command'] = 'publish'
      run['tarball'] = commands[1]
    } else {
      info()
      console.log(usage())
    }
  }
  d('run', run)
  return run
}

function usage () {
  return fs.readFileSync(join(__dirname, '..', 'bin', 'usage.txt'), 'utf8')
}

function info () {
  console.log(`\n${pkg.name} (${pkg.version})\n`)
  console.log(pkg.description)
}
