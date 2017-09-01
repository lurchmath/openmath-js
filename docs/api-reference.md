
# API Reference

## Getting started

### In the browser

Import the minified JavaScript, which you can [download from our repository
directly](https://raw.githubusercontent.com/lurchmath/openmath-js/master/openmath.js)
or import from a CDN with the following one-liner.

```html
<script src='https://cdn.jsdelivr.net/npm/openmath-js@1/openmath.js'></script>
```

### From the command line

Or install this package into your project the usual way:

```bash
npm install openmath-js
```

Then within any of your modules, import it as follows.

```js
OM = require( "openmath-js" ).OM;
```

After that, any of the example code snippets in this documentation should
function as-is.

## Creating OpenMath objects

The prototype for OpenMath data structures (that is, expression trees) is
named `OMNode` in the global namespace (the browser `window`) and is also
named `OM` for convenience; they are the same object.  It is defined as a
CoffeeScript class, which translates to a JavaScript prototype.

Rather than use its constructor, there are a number of factory functions
that create `OM` instances, as follows.

 * `OM.integer(i)` creates a new OpenMath integer object from the given
   JavaScript integer `i`.  If you want to store a big integer, pass it as
   a string instead of an integer, as in `OM.integer('583257320489234290')`.
 * `OM.float(f)` creates a new OpenMath float object from the given
   JavaScript number `f` which cannot be infinite or NaN
 * `OM.string(s)` creates a new OpenMath string object from the given
   JavaScript string `s`
 * `OM.bytearray(a)` creates a new OpenMath bytearray object from the given
   JavaScript Uint8Array `a`
 * `OM.symbol(name,cd[,uri])` creates a new OpenMath symbol with the given
   name (`name`) and content dictionary (`cd`), which are both strings.  An
   optional base `uri` can also be passed.
 * `OM.variable(x)` creates a new OpenMath variable whose name is given in
   the string `x`
 * `OM.application(c1,c2,...,cn)` creates a new OpenMath application whose
   children are the `OM` instances `c1` through `cn`.  This represents an
   application of `c1` as a function to the arguments `c2` through `cn`,
   where n may be 1.  Note that this makes copies of all the children given
   to it, rather than removing them from their current contexts.  This
   allows the function to be called on the same argument several times, for
   instance.
 * `OM.attribution(x,k1,v1,k2,v2,...,kn,vn)` creates a copy of the `OM`
   instance `x` with new attribute pairs added.  Each (`ki`,`vi`) pair is a
   key-value pair, in which `ki` must be an OpenMath symbol (an `OM`
   instance) and each `vi` must be any `OM` instance.
 * `OM.binding(h,v1,v2,...,vn,b)` creates a new OpenMath binding in which
   the head symbol `h` (which must be an OpenMath symbol node, an `OM`
   instance) binds the variables `v1` through `vn` (which must be OpenMath
   variable nodes, also `OM` instances) in the body `b` (which can be any
   `OM` instance).
 * `OM.error(s,c1,c2,...,cn)` creates a new OpenMath error object in which
   `s` is the head symbol (an `OM` instance representing an OpenMath symbol)
   and there are zero or more other children `c1` through `cn` that can be
   any `OM` instances

Example use:

<div class="runnable-example">
plus = OM.symbol( 'plus', 'arith1' );
arg1 = OM.variable( 'x' );
arg2 = OM.integer( 5 );
OM.application( plus, arg1, arg2 ).toXML(); // gives XML encoding for x+5
</div>

Because the above method can easily become annoyingly lengthy, we also
provide a shorthand for writing OpenMath expressions as strings and having
them parsed in a convenient way.  Full details are covered in [the source
code documentation
here](https://github.com/lurchmath/openmath-js/blob/master/openmath.litcoffee#simple-encoding-and-decoding).
It is called "simple encoding and decoding," and you can create new `OM`
instances from that encoding with the following function.

 * `OM.simpleDecode(string)` creates a new `OM` instance decoded from the
   given string.  If your input is invalid (not a string, or a string not
   containing a valid simple encoding) then the return value will be a
   string error message, rather than an `OM` instance.

Example usage:

<div class="runnable-example">
OM.simpleDecode( 'plus.arith1(x,5)' ).toXML();
</div>

Each of the functions in this section have nicknames.  For each factory
function given above, it has a three-letter nickname to help you write
shorter code that builds OpenMath tree structures.  The nicknames are all in
the `OM` namespace, and include `int`, `flo`, `str`, `byt`, `sym`, `var`,
`app`, `att`, `bin`, and `err`.  Thus, for instance, you can write the
following code to build a valid OpenMath expression.

<div class="runnable-example">
OM.app( OM.sym( 'plus', 'arith1' ), OM.var( 'x' ), OM.int( 5 ) ).toXML();
</div>

Finally, the `simpleDecode` function also has the nickname `simple`, so the
most compact form is the following.

<div class="runnable-example">
OM.simple( 'plus.arith1(x,5)' ).toXML();
</div>

The `OM` objects are just wrappers around JSON tree structures that provide
methods for interacting with those tree structures.  You can get access to
the tree structur itself with `myInstance.tree`.  It is not quite JSON,
because it has circular references, as children nodes point to their parent
nodes, but it is close to JSON.

The specification for how OpenMath expressions are stored as JSON trees is
given [at the top of the source code documentation](https://github.com/lurchmath/openmath-js/blob/master/openmath.litcoffee#openmath-module), should you need it.  The following methods are
available for working with such structures, but these are rarely used by the
client, and are mostly for internal purposes.

 * `OM.checkJSON(jsonObject)` returns `null` if the object is valid JSON
   that represents and OpenMath data structure, and thus could be wrapped in
   an `OM` instance, or a string error message if it is not
 * `OM.decode(jsonObject)` creates an `OM` instance by wrapping the given
   object in an `OM` object, if possible, or throws an error if
   `OM.checkJSON` fails on the given input
 * `OM.decode(string)` parses the string as JSON and then calls the previous
   function.
 * `OM(tree)` creates a new `OM` instance wrapping the given JSON tree; this
   is the same as `OM.decode`, but more compact.  Note that you can thus get
   two instances that refer to the same internal data via
   `OM(otherInstance.tree)`.

## Writing/saving OpenMath objects

 * `instance.encode()` is the inverse of `OM.decode()`, and yields a JSON
   string useful for serializing instances in a compact way
 * `instance.simpleEncode()` is the inverse of `OM.simpleDecode()`, and
   converts instances into the simple encoding mentioned above.  Note that
   it does not support errors, byte arrays, or attributions.
 * `instance.toXML()` yields the XML encoding defined in [the OpenMath
   standard](http://www.openmath.org/standard/om20-2004-06-30/).

## Properties of OpenMath Objects

 * `instance.type` yields the type of an `OM` instance, a string containing
   just one or two letters, one of i, f, st, ba, sy, v, a, bi, e, which mean
   integer, float, string, bytearray, symbol, variable, application,
   binding, and error, respectively.  These come directly from the JSON
   encoding documented [here](https://github.com/lurchmath/openmath-js/blob/master/openmath.litcoffee#openmath-module).
 * `instance.value` yields the value of those atomic types that have one, as
   an atomic JavaScript datum.  Integers and floats yield a JavaScript
   number, strings yield a JavaScript string, and bytearrays yield a
   JavaScript UInt8Array.  This property is undefined in all other cases.
 * `instance.name` yields the string name of a variable or symbol, and is
   undefined in all other cases.
 * `instance.cd` yields the content dictionary of a symbol, and is
   undefined in all other cases.
 * `instance.uri` yields the base URI of a symbol, if one was provided, and
   is undefined in all other cases.
 * `instance.symbol` yields the head symbol for a binding or error object,
   and is undefined in all other cases.
 * `instance.body` yields the body of a binding object, and is undefined in
   all other cases.
 * `instance.children` yields a JavaScript array containing the child nodes
   for application or error objects, and is an empty array in all other
   cases.  It may be an empty array in the case of error objects as well,
   if they have only a head symbol.
 * `instance.variables` yields the list of variables bound by a binding
   object, as a JavaScript array, and is undefined in all other cases.

Note that each of these properties is actually produced by a getter
function, and thus is not always as efficient as you might think.  For
instance, you may not wish to write loops like this:

```js
for ( var i = 0 ; i < anOMinstance.children.length ; i++ )
    process( anOMinstance.children[i] ); // calls getter many times
```

Rather, you might do better with a loop like this:

```js
for ( var i = 0, ch = anOMinstance.children ; i < ch.length ; i++ )
    process( ch[i] ); // doesn't call getter at all on this line
```

## Tree-Related Functions

As mentioned at the end of [the first section](#creating-openmath-objects),
it is possible to create two different `OM` instances that refer to the same
internal tree structure.  And as mentioned immediately above, calling
`instance.children[i]` produces a new instance each time you call it.
Thus `instance.children[0]` and `instance.children[0]` will refer to the
same internal JSON structure, but will be different `OM` instances.  We can
thus check equality in two ways.

 * `instance.sameObjectAs(otherInstance)` asks whether two `OM` instances
   refer to the same internal JSON data, the same node in the same tree.
 * `instance.equals(other[,checkAttributes])` compares structural equality
   only, and does not care whether the two instances are the same tree.  It
   includes attributes in the comparison if and only if the second argument
   is set to true, which is its default.
 * `instance.copy()` makes a structural deep copy of an `OM` instance.

Examples:

<div class="runnable-example">
A = OM.application( OM.variable( 'f', OM.integer( 3 ) ) ); // f(3)
B = A.copy(); // deep copy
C = A.children[0]; // builds a new OM instance for the f
D = A.children[0]; // does the same thing again
console.log( A.equals( B ) ); // true
console.log( A.sameObjectAs( B ) ); // false
console.log( A == B ); // false
console.log( C.equals( D ) ); // true
console.log( C.sameObjectAs( D ) ); // true
console.log( C == D ); // false
</div>

You can also modify tree structures as follows.

 * `instance.remove()` returns no value, but removes the instance from its
   parent tree, if that does not break the parent tree's validity.  If it
   does, this function takes no action.  For instance, you cannot remove
   the head symbol from a binding or error structure.
 * `instance.replaceWith(other)` replaces the instance in its parent
   structure with the given other `OM` object, if the resulting tree would
   be valid, or does nothing otherwise.  The original is returned on
   success, and undefined is returned on failure.
 * `instance.getAttribute(keySymbol)` returns the corresponding value for
   the given key symbol (an `OM` instance) in the instance's attributes, if
   there is one, or undefined if there is not.
 * `instance.setAttribute(keySymbol,value)` adds or changes an attribute on
   the instance.  The key symbol must be an `OM` symbol instance, and the
   value must be any `OM` instance.

## Searching OpenMath Trees

We have devised a way for indexing and addressing children and descendants
within parent/ancestor trees, and the following functions use that
convention.  You can read about the indexing/addressing convention [in the
source code documentation here](https://github.com/lurchmath/openmath-js/blob/master/openmath.litcoffee#parent-child-relationships).

 * `instance.findInParent()` returns a single index of the form cn/vn/b/s,
    or a JSON attribute key, or undefined if the instance has no parent, as
    per the indexing scheme linked to above.  It returns undefined if there
    is no such child.
 * `instance.findChild(indexString)` is the inverse of the previous, in that
   it takes as input a string that the previous might give as output, and
   finds the corresponding child tree by that index.

Example:

<div class="runnable-example">
A = OM.application( OM.variable( 'print' ),
                        OM.string( 'Hello' ), OM.string( 'World' ) );
str1 = A.children[1]; // zero-based
console.log( str1.value ); // "Hello"
index = str1.findInParent();
console.log( index ); // "c1"
child = A.findChild( index );
console.log( child.sameObjectAs( str1 ) ); // true
</div>

 * `instance.address(inThisAncestor)` is a generalization of `indexInParent`
   to arbitrary depth.  It returns an array of indices that one would need
   to follow, as a path, to walk from the given ancestor node, down through
   the tree, to reach this instance.  If no ancestor is given (or a
   non-ancestor is given) then the topmost ancestor is used instead.
 * `instance.index(indexArray)` is the inverse of the previous function,
   taking an array of indices and walking that path into its descendants,
   returning the resulting subtree, or undefined if one or more of the steps
   were invalid.

Examples:

<div class="runnable-example">
deepTree = OM.simple( 'arith1.plus(f(g(x,y)),h(k(z)))' );
descendant = deepTree.index( [ 'c1', 'c1', 'c2' ] );
console.log( descendant.name ); // "y"
console.log( descendant.address( deepTree ) ); // c1,c1,c2
console.log( descendant.address( deepTree.children[1] ) ); // c1,c2
</div>

You can filter children or descendants by predicates.

 * `instance.childrenSatisfying(P)` returns an array of all immediate
   children c for which P(c) returns true.  This array may be empty.  For
   the purposes of this function, immediate children include not only what
   is returned by `instance.children`, but also head symbols of bindings and
   errors, and bodies of bindings.
 * `instance.descendantsSatisfying(P)` is the same as the previous, but
   considers indirect descendants as well.  Note that original subtrees are
   returned, not copies, so modifying them will change the original
   instance.
 * `instance.hasDescendantsSatisfying(P)` returns true or false, equal to
   calling `instance.descendantsSatisfying(P).length > 0`, except this is
   faster because it can stop searching once it has found one.

## Free and Bound Variables

Many applications of OpenMath relate to logic and/or programming, in which
variable binding and substitutin plays a critical role.  The following
functions make it easy to ask questions and perform the most common
operations related to variable binding and substitution.

 * `instance.freeVariables()` returns and array of free variable names, as
   strings, that appear anywhere as descendants of the instance.  Each name
   is only reported once, even if it occurs many times.  This does not recur
   into attributes or error children.
 * `instance.isFree(inThisAncestor)` returns true if all variables free in
   the instance are free in the given ancestor.  An invalid (or omitted)
   ancestor causes the routine to use the top-most ancestor as well.  If any
   variable free in the instance is not free in the ancestor, return false.
 * `instance.occursFree(other)` returns true if there exists a descendant of
   the instance that's structurally equivalent to `other` and that is free
   where it occurs in the given instance, or returns false if there is not.
 * `instance.isFreeToReplace(subtree,inThisAncestor)` returns true if
   replacing the given subtree with the given instance would make any
   variables free in the instance become bound in the given ancestor.  As
   before, an invalid or omitted ancestor will use the topmost ancestor of
   the subtree instead.
 * `instance.replaceFree(original,replacement,inThisAncestor)` recursively
   searches through all descendants D of the instance that are structurally
   equiavlent to the given original, and whenever
   `replacement.isFreeToReplace(D,inThisAncestor)` yields true, call
   `D.replaceWith(replacement)`.  It does not recur into attributes.

## Miscellany

Sometimes it is useful to be able to take any JavaScript string and convert
it into a string that could be used as a valid OpenMath identifier (such as
a variable or symbol name).  Because only a subset of Unicode is permitted,
we provide an injection (although not a very compact one) from all strings
into the set of strings accepted as valid OpenMath identifiers.  The range
of the function is strings of the form "id_[many decimal digits here]".

 * `OM.encodeAsIdentifier(anyString)` performs the encoding
 * `OM.decodeIdentifier(encodedString)` inverts the previous function

Example:

<div class="runnable-example">
console.log( OM.encodeAsIdentifier( '#$&@' ) ); // id_0023002400260040
console.log( OM.decodeIdentifier( "id_0023002400260040" ) ); // #$&@
</div>

Some applications find it useful to be able to evaluate simple numerical
OpenMath expressions.

 * `instance.evaluate()` attempts to evaluate a numerical expression that
   uses the basic operations of arithmetic, powers, roots, trigonometry,
   pi, e, and a few other simple concepts.  It returns a JavaScript object
   with two members, `value` contains the numerical value (if one was able
   to be computed) and `message` is a string that may contain some details,
   such as when rounding needed to occur.

Example:

<div class="runnable-example">
console.log( OM.simple( 'transc1.cos(0)' ).evaluate() ); // 1
console.log( OM.simple( 'f(x)' ).evaluate() ); // error message
console.log( OM.simple( 'e' ).evaluate() ); // 2.71828... w/rounding message
</div>

## More Examples

In addition to the brief examples shown in this file, the test suite in the
source code repository is (naturally) a large set of examples of how the
module works, and they become useful [at about this point in the
file](https://github.com/lurchmath/openmath-js/blob/master/openmath-spec.litcoffee#factory-functions).

<script src="https://embed.runkit.com"></script>
<script>
var elements = document.getElementsByClassName( 'runnable-example' );
for ( var i = 0 ; i < elements.length ; i++ ) {
    var source = elements[i].textContent;
    elements[i].textContent = '';
    var notebook = RunKit.createNotebook( {
        element: elements[i],
        source: source,
        preamble: 'OM = require( "openmath-js" ).OM;'
    } );
}
</script>
