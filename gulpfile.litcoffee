
# Build processes using [Gulp](http://gulpjs.com)

Load Gulp modules.

    gulp = require 'gulp' # main tool
    coffee = require 'gulp-coffee' # compile coffeescript
    uglify = require 'gulp-uglify' # minify javascript
    sourcemaps = require 'gulp-sourcemaps' # create source maps
    pump = require 'pump' # good error handling of gulp pipes

Create default task to compile CoffeeScript source into JavaScript.

    gulp.task 'default', -> pump [
        gulp.src 'openmath.litcoffee'
        sourcemaps.init()
        coffee bare : yes
        uglify()
        sourcemaps.write '.'
        gulp.dest '.'
    ]
