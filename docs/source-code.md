
# Source Code

## Reading the source

The code in [the repository](https://github.com/lurchmath/openmath-js)
resides in [one
file](https://github.com/lurchmath/openmath-js/blob/master/openmath.litcoffee),
written in [Literate CoffeeScript](http://coffeescript.org/#literate).

## Changing the source

If you don't like that language, you can always compile it directly to
JavaScript with the following command.

```
coffee --compile openmath.litcoffee
```

This assumes that you've [installed
CoffeeScript](http://coffeescript.org/#installation) and have the [source
file](https://github.com/lurchmath/openmath-js/blob/master/openmath.litcoffee)
accessible.

## Importing the source

To import the source into your project, you can include it directly from a
CDN at [this
URL](https://cdn.jsdelivr.net/npm/openmath-js@1/openmath.js). There is a
source map file in the same folder that your browser should detect.
