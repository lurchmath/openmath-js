
// This file is only for when this package is installed via npm.
// It is what will be imported when users require this package.
// It imports the utilities from openmath.litcoffee.

path = require( 'path' );
var openmath = require( path.resolve( __dirname, 'openmath' ) );
exports.OM = exports.OMNode = openmath.OM;

