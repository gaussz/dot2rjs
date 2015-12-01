#!/usr/bin/env node
(function() {
  var baseFileName, compilePath, compileTemplate, dot, exec, exists, fs, hidden, isdotfile, mkdirSyncWithR, notSources, outputPath, path, printLine, printWarn, program, removeSource, source, sources, spawn, timeLog, unwatchDir, useWinPathSep, wait, watch, watchDir, watchers, _i, _len, _ref;

  fs = require('fs');

  path = require('path');

  program = require('commander');

  dot = require('dot');

  _ref = require('child_process'), spawn = _ref.spawn, exec = _ref.exec;

  sources = [];

  notSources = {};

  watchers = {};

  exists = fs.existsSync;

  useWinPathSep = path.sep === '\\';

  printLine = function(line) {
    return process.stdout.write(line + '\n');
  };

  printWarn = function(line) {
    return process.stderr.write(line + '\n');
  };

  wait = function(milliseconds, func) {
    return setTimeout(func, milliseconds);
  };

  timeLog = function(message) {
    return console.log("" + ((new Date).toLocaleTimeString()) + " - " + message);
  };

  hidden = function(file) {
    return /^\.|~$/.test(file);
  };

  isdotfile = function(file) {
    return /\.(jst)$/.test(file);
  };

  compilePath = function(source, topLevel, base) {
    return fs.stat(source, function(err, stats) {
      if (err && err.code !== 'ENOENT') {
        throw err;
      }
      if ((err != null ? err.code : void 0) === 'ENOENT') {
        printWarn("   error:File or Path not found: " + source);
        process.exit(1);
      }
      if (stats.isDirectory() && path.dirname(source) !== 'node_modules') {
        if (program.watch) {
          watchDir(source, base);
        }
        return fs.readdir(source, function(err, files) {
          var file, index, _ref1;
          if (err && err.code !== 'ENOENT') {
            throw err;
          }
          if ((err != null ? err.code : void 0) === 'ENOENT') {
            return;
          }
          index = sources.indexOf(source);
          files = files.filter(function(file) {
            return !hidden(file);
          });
          [].splice.apply(sources, [index, index - index + 1].concat(_ref1 = (function() {
            var _i, _len, _results;
            _results = [];
            for (_i = 0, _len = files.length; _i < _len; _i++) {
              file = files[_i];
              _results.push(path.join(source, file));
            }
            return _results;
          })())), _ref1;
          return files.forEach(function(file) {
            return compilePath(path.join(source, file), false, base);
          });
        });
      } else if (topLevel || isdotfile(source)) {
        if (program.watch) {
          watch(source, base);
        }
        return fs.readFile(source, function(err, code) {
          if (err && err.code !== 'ENOENT') {
            throw err;
          }
          if ((err != null ? err.code : void 0) === 'ENOENT') {
            return;
          }
          return compileTemplate(source, code.toString(), base);
        });
      } else {
        notSources[source] = true;
        return removeSource(source, base);
      }
    });
  };

  mkdirSyncWithR = function(path, mode) {
    var dirs, paths, thePath, tmp, _results;
    thePath = path.indexOf('\\') >= 0 ? path.replace('\\', '/') : path;
    dirs = thePath.split('/');
    paths = [];
    _results = [];
    while (dirs.length >= 1) {
      paths.push(dirs.shift());
      tmp = paths.join('/');
      if (!exists(tmp)) {
        _results.push(fs.mkdirSync(tmp, mode));
      } else {
        _results.push(void 0);
      }
    }
    return _results;
  };

  compileTemplate = function(file, input, base) {
    var compile, compiled, e, jsDir, jsPath, modulename, result;
    try {
      modulename = baseFileName(file, true, useWinPathSep);
      compiled = dot.template(input).toString();
      compiled = compiled.replace('anonymous', modulename);
      result = "define([],function(){\n   " + compiled + "\n   return " + modulename + "\n});";
      jsPath = outputPath(file, base);
      jsDir = path.dirname(jsPath);
      compile = function() {
        return fs.writeFile(jsPath, result, function(err) {
          if (err) {
            return printLine(err.message);
          } else {
            return timeLog("compiled " + file);
          }
        });
      };
      if (exists(jsDir)) {
        return compile();
      } else {
        mkdirSyncWithR(jsDir, 0x1ed);
        return compile();
      }
    } catch (_error) {
      e = _error;
      return console.error("" + file + " compile failed");
    }
  };

  watchDir = function(source, base) {
    var e, readdirTimeout, watcher;
    readdirTimeout = null;
    try {
      return watcher = fs.watch(source, function() {
        clearTimeout(readdirTimeout);
        return readdirTimeout = wait(25, function() {
          return fs.readdir(source, function(err, files) {
            var file, _i, _len, _results;
            if (err) {
              if (err.code !== 'ENOENT') {
                throw err;
              }
              watcher.close();
              return unwatchDir(source, base);
            }
            _results = [];
            for (_i = 0, _len = files.length; _i < _len; _i++) {
              file = files[_i];
              if (!(!hidden(file) && !notSources[file])) {
                continue;
              }
              file = path.join(source, file);
              if (sources.some(function(s) {
                return s.indexOf(file) >= 0;
              })) {
                continue;
              }
              sources.push(file);
              _results.push(compilePath(file, false, base));
            }
            return _results;
          });
        });
      });
    } catch (_error) {
      e = _error;
      if (e.code !== 'ENOENT') {
        throw e;
      }
    }
  };

  unwatchDir = function(source, base) {
    var file, prevSources, toRemove, _i, _len;
    prevSources = sources.slice(0);
    toRemove = (function() {
      var _i, _len, _results;
      _results = [];
      for (_i = 0, _len = sources.length; _i < _len; _i++) {
        file = sources[_i];
        if (file.indexOf(source) >= 0) {
          _results.push(file);
        }
      }
      return _results;
    })();
    for (_i = 0, _len = toRemove.length; _i < _len; _i++) {
      file = toRemove[_i];
      removeSource(file, base, true);
    }
    if (!sources.some(function(s, i) {
      return prevSources[i] !== s;
    })) {

    }
  };

  watch = function(source, base) {
    var compile, compileTimeout, e, prevStats, rewatch, watchErr, watcher;
    prevStats = null;
    compileTimeout = null;
    watchErr = function(e) {
      if (e.code === 'ENOENT') {
        if (sources.indexOf(source) === -1) {
          return;
        }
        try {
          rewatch();
          return compile();
        } catch (_error) {
          e = _error;
          return removeSource(source, base, true);
        }
      } else {
        throw e;
      }
    };
    compile = function() {
      clearTimeout(compileTimeout);
      return compileTimeout = wait(25, function() {
        return fs.stat(source, function(err, stats) {
          if (err) {
            return watchErr(err);
          }
          if (prevStats && stats.size === prevStats.size && stats.mtime.getTime() === prevStats.mtime.getTime()) {
            return rewatch();
          }
          prevStats = stats;
          return fs.readFile(source, function(err, code) {
            if (err) {
              return watchErr(err);
            }
            compileTemplate(source, code.toString(), base);
            return rewatch();
          });
        });
      });
    };
    try {
      watcher = fs.watch(source, compile);
    } catch (_error) {
      e = _error;
      watchErr(e);
    }
    return rewatch = function() {
      if (watcher != null) {
        watcher.close();
      }
      return watcher = fs.watch(source, compile);
    };
  };

  removeSource = function(source, base, removeJs) {
    var index, jsPath;
    index = sources.indexOf(source);
    sources.splice(index, 1);
    if (removeJs) {
      jsPath = outputPath(source, base);
      return exists(jsPath, function(itExists) {
        if (itExists) {
          return fs.unlink(jsPath, function(err) {
            if (err && err.code !== 'ENOENT') {
              throw err;
            }
            return timeLog("removed " + source);
          });
        }
      });
    }
  };

  outputPath = function(source, base) {
    var baseDir, baseName, dir, srcDir;
    baseName = baseFileName(source, true, useWinPathSep);
    srcDir = path.dirname(source);
    baseDir = base === '.' ? srcDir : srcDir.substring(base.length);
    dir = program.output ? path.join(program.output, baseDir) : srcDir;
    return path.join(dir, baseName + '.js');
  };

  baseFileName = function(file, stripExt, useWinPathSep) {
    var parts, pathSep;
    if (stripExt == null) {
      stripExt = false;
    }
    if (useWinPathSep == null) {
      useWinPathSep = false;
    }
    pathSep = useWinPathSep ? /\\|\// : /\//;
    parts = file.split(pathSep);
    file = parts[parts.length - 1];
    if (!stripExt) {
      return file;
    }
    parts = file.split('.');
    parts.pop();
    return parts.join('.');
  };

  program.version('0.0.1').usage('[-w] [-o <output folder>] <src path|template file>').option('-o, --output <folder>', 'output folder path. if this option is off, the compiled .js file will save to the folder which the sources template file in').option('-w, --watch', 'watch the rebuild on the source folder and rebuild if the source template file was changed').parse(process.argv);

  if (program.args.length === 0) {
    printWarn('   error:must specify the file or path to compile');
    process.exit(1);
  } else {
    sources = program.args;
  }

  for (_i = 0, _len = sources.length; _i < _len; _i++) {
    source = sources[_i];
    compilePath(source, true, path.normalize(source));
  }

}).call(this);
