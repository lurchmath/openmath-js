
# Build processes using [Gulp](http://gulpjs.com)

Load Gulp modules.

    gulp = require 'gulp' # main tool
    coffee = require 'gulp-coffee' # compile coffeescript
    uglify = require 'gulp-uglify' # minify javascript
    sourcemaps = require 'gulp-sourcemaps' # create source maps
    pump = require 'pump' # good error handling of gulp pipes
    shell = require 'gulp-shell' # run external commands

Create default task to compile CoffeeScript source into JavaScript.

    gulp.task 'default', -> pump [
        gulp.src 'openmath.litcoffee'
        sourcemaps.init()
        coffee bare : yes
        uglify()
        sourcemaps.write '.'
        gulp.dest '.'
    ]

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
