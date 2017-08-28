
# Work Done

This repository implements a portion of [the OpenMath 2.0
standard](http://www.openmath.org/standard/om20-2004-06-30/) in JavaScript.
(For details, you may want to refer to [the API
Reference](api-reference.md).)

In particular, the following pieces have been implemented:

 * All types of OpenMath objects except for `OMFOREIGN`
 * Serialization to/deserialization from a simple JSON encoding
 * Serialization to the standard XML encoding

The following pieces have not been implemented:

 * Deserialization from the standard XML encoding
 * The standard binary encoding
 * `OMFOREIGN` objects
 * Only a subset of the range of Unicode characters valid in OpenMath
   identifiers is in use in this code; see the `identRE` regular expression
   used in [this function](https://github.com/lurchmath/openmath-js/blob/master/openmath.litcoffee#class-static-methods)

Futhermore, the following features have been added, above and beyond the
requirements of the standard:

 * Deep copying OpenMath objects and comparing them for structural equality
 * Serialization to/deserialization from a simple prefix notation string
   encoding useful for convenience (e.g., `f(x)` means what you'd think)
 * Routines for indexing and addressing child or descendant notes within an
   OpenMath tree structure
 * Routines for editing an OpenMath tree structure by inserting, removing,
   or replacing subtrees with others
 * Routines for finding free/bound variables, and testing whether an
   expression is free to replace a variable, and performing said replacement
 * Filtering children/descendants by a given predicate
 * Evaluating simple mathematical expressions numerically

To see how to use these features, check out [the API
Reference](api-reference.md).
