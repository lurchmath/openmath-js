
# Build processes using [Gulp](http://gulpjs.com)

Load Gulp modules.

    gulp = require 'gulp' # main tool
    coffee = require 'gulp-coffee' # compile coffeescript
    uglify = require 'gulp-uglify' # minify javascript
    sourcemaps = require 'gulp-sourcemaps' # create source maps
    shell = require 'gulp-shell' # run external commands
    babel = require 'gulp-babel' # to transpile ES6 to ES5

Create the build task to compile CoffeeScript source into JavaScript.

    gulp.task 'build', ->
        gulp.src 'openmath.litcoffee', sourcemaps : yes
            .pipe coffee bare : yes
            .pipe babel presets : [ '@babel/preset-env' ]
            .pipe uglify()
            .pipe gulp.dest '.'

Create "tests" task to run unit tests.

    gulp.task 'test', shell.task [
        'node'
        './node_modules/jasmine-node/lib/jasmine-node/cli.js'
        '--verbose --coffee'
        'openmath-spec.litcoffee'
    ].join ' '

Create "docs" task to build the documentation using
[MkDocs](http://www.mkdocs.org).  This requires that you have `mkdocs`
installed on your system.

    gulp.task 'docs', shell.task 'mkdocs build'

The default task is to do everything.

    gulp.task 'default', gulp.series 'build', 'test', 'docs'

