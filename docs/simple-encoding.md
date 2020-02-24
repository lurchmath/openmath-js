
# Simple encoding and decoding

The basic OpenMath API can be used to create OpenMath data structures of
arbitrary complexity and type.  But most use cases can be handled with only
a subset of that full complexity, and we provide the following tools for
doing so.

## Simple encoding

`OMNode.simpleDecode()` takes a string as input (like `OMNode.decode()`
does), but this string is in a much simpler form.  Here are the formats it
supports.

  * `anyIdentifier` will be treated as a variable.  Examples:
     * `x`
     * `thing_7`
  * `ident1.ident2` will be treated as a symbol (CD and name, respectively).
    Examples:
     * `arith1.plus`
     * `transc1.arcsin`
  * any integer will be treated as an integer.  Examples:
     * -6
     * 57328074078459027340 (value will be a string, due to size)
  * any float will be treated as a float.  Examples:
     * 582.53280
     * -0.00001
  * a string literal enclosed in quotation marks (`"`) will be treated as a
    string, but with no support for escape codes, other than `\"`.  Examples:
     * `"this is a string"`
     * `""`
  * a string literal enclosed in single quotes (`'`) behaves the same way,
    escaping only `\'`
     * `'this is also a string, ain\'t it?'`
     * `'""'`
  * `F(A1,...,An)`, where `F` is any valid form and each `Ai` is as well,
    is interpreted as the application of `F` to the `Ai` in the order given.
    Here `n` may be zero.  Examples:
     * `f(x)`
     * `transc1.arcsin(arith1.divide(1,2))`
  * `F[A1,...,An]` behaves the same as the previous case, except that the
    `Ai` entries before `An` must all be variables, and they will be bound;
    i.e., this yields an OpenMath binding object, not an application object.
    Examples:
     * `logic.forall[x,P(x)]`
     * `foo.lambda[x,f(x,7,"bar")]`

This syntax does not allow for the expression of OpenMath error objects,
attributions, symbol URIs, byte arrays, or very large integers.

## Simple decoding

The inverse to the above function is a simple encoding function.  It can
operate on only a subset of the full complexity of OMNode trees, and thus in
some cases it gives results that are not representative of the input.  Here
are the details:

 * integers, floats, and strings will all be correctly encoded
 * variables without dots in their names will be correctly encoded; those
   with dots in their names conflict with the naming of symbols in the
   simple encoding, but will be encoded as their names
 * symbols will be correctly encoded with the exception that any URI will be
   dropped, and the same issue with dots applies to symbol and CD names
 * byte arrays and errors have no simple encoding, and will thus all be
   converted to a string containing the words "byte array" or "error,"
   respectively
 * all attributions are dropped

Example use:  `const sum = OM.simple( 'arith1.plus( 3, 4 )' )`
