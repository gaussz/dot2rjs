#---------------require region----------------------
fs             = require 'fs'
path           = require 'path'
program        = require 'commander'
dot            = require 'dot'
{spawn, exec}  = require 'child_process'

#---------------global variable region----------------------
sources      = []
notSources   = {}
watchers     = {}

#---------------tools region----------------------
exists = fs.exists or path.exists
useWinPathSep = path.sep is '\\'
printLine = (line) -> process.stdout.write line + '\n'
printWarn = (line) -> process.stderr.write line + '\n'
wait = (milliseconds, func) -> setTimeout func, milliseconds
timeLog = (message) ->
  console.log "#{(new Date).toLocaleTimeString()} - #{message}"
hidden = (file) -> /^\.|~$/.test file
isdotfile = (file) -> /\.(jst)$/.test file

#---------------method define region----------------------
compilePath = (source, topLevel, base)->
  fs.stat source, (err, stats) ->
    throw err if err and err.code isnt 'ENOENT'
    if err?.code is 'ENOENT'
      printWarn "   error:File or Path not found: #{source}"
      process.exit 1
    if stats.isDirectory() and path.dirname(source) isnt 'node_modules'
      watchDir source, base if program.watch
      fs.readdir source, (err, files) ->
        throw err if err and err.code isnt 'ENOENT'
        return if err?.code is 'ENOENT'
        index = sources.indexOf source
        files = files.filter (file) -> not hidden file
        sources[index..index] = (path.join source, file for file in files)
        files.forEach (file) ->
          compilePath (path.join source, file), no, base
    else if topLevel or isdotfile source
      watch source, base if program.watch
      fs.readFile source, (err, code) ->
        throw err if err and err.code isnt 'ENOENT'
        return if err?.code is 'ENOENT'
        compileTemplate(source, code.toString(), base)
    else
      notSources[source] = yes
      removeSource source, base

compileTemplate = (file,input,base)->
  try
    modulename = baseFileName file,yes,useWinPathSep
    compiled = dot.template(input).toString()

    compiled = compiled.replace('anonymous', modulename)
    result = """
                define([],function(){
                   #{compiled}
                   return #{modulename}
                });
             """
    jsPath = outputPath file, base
    jsDir  = path.dirname jsPath

    compile = ->
      fs.writeFile jsPath, result, (err) ->
        if err
          printLine err.message
        else
          timeLog "compiled #{file}"

    if exists jsDir
      compile()
    else
      exec "mkdir -p #{jsDir}"
      compile()
  catch e
    console.error "#{file} compile failed"
  
watchDir = (source, base) ->
  readdirTimeout = null
  try
    watcher = fs.watch source, ->
      clearTimeout readdirTimeout
      readdirTimeout = wait 25, ->
        fs.readdir source, (err, files) ->
          if err
            throw err unless err.code is 'ENOENT'
            watcher.close()
            return unwatchDir source, base
          for file in files when not hidden(file) and not notSources[file]
            file = path.join source, file
            continue if sources.some (s) -> s.indexOf(file) >= 0
            sources.push file
            compilePath file, no, base
  catch e
    throw e unless e.code is 'ENOENT'

unwatchDir = (source, base) ->
  prevSources = sources[..]
  toRemove = (file for file in sources when file.indexOf(source) >= 0)
  removeSource file, base, yes for file in toRemove
  return unless sources.some (s, i) -> prevSources[i] isnt s

watch = (source, base) ->

  prevStats = null
  compileTimeout = null

  watchErr = (e) ->
    if e.code is 'ENOENT'
      return if sources.indexOf(source) is -1
      try
        rewatch()
        compile()
      catch e
        removeSource source, base, yes

    else throw e

  compile = ->
    clearTimeout compileTimeout
    compileTimeout = wait 25, ->
      fs.stat source, (err, stats) ->
        return watchErr err if err
        return rewatch() if prevStats and stats.size is prevStats.size and
          stats.mtime.getTime() is prevStats.mtime.getTime()
        prevStats = stats
        fs.readFile source, (err, code) ->
          return watchErr err if err
          compileTemplate(source, code.toString(), base)
          rewatch()

  try
    watcher = fs.watch source, compile
  catch e
    watchErr e

  rewatch = ->
    watcher?.close()
    watcher = fs.watch source, compile

removeSource = (source, base, removeJs) ->
  index = sources.indexOf source
  sources.splice index, 1
  if removeJs
    jsPath = outputPath source, base
    exists jsPath, (itExists) ->
      if itExists
        fs.unlink jsPath, (err) ->
          throw err if err and err.code isnt 'ENOENT'
          timeLog "removed #{source}"

outputPath = (source, base) ->
  baseName  = baseFileName source,yes,useWinPathSep
  srcDir    = path.dirname source
  baseDir   = if base is '.' then srcDir else srcDir.substring base.length
  dir       = if program.output then path.join program.output, baseDir else srcDir
  path.join dir, baseName + '.js'

baseFileName = (file, stripExt = no, useWinPathSep = no) ->
  pathSep = if useWinPathSep then /\\|\// else /\//
  parts = file.split(pathSep)
  file = parts[parts.length - 1]
  return file unless stripExt
  parts = file.split('.')
  parts.pop()
  parts.join('.')

#--------------------------------Main Region----------------------
program
  .version('0.0.1')
  .usage('[-w] [-o <output folder>] <src path|template file>')
  .option('-o, --output <folder>', 'output folder path. if this option is off, the compiled .js file will save to the folder which the sources template file in')
  .option('-w, --watch', 'watch the rebuild on the source folder and rebuild if the source template file was changed')
  .parse(process.argv)

if program.args.length is 0
  printWarn '   error:must specify the file or path to compile'
  process.exit 1
else
  sources = program.args

for source in sources
  compilePath source, yes, path.normalize source





