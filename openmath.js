/*
 * decaffeinate suggestions:
 * DS104: Avoid inline assignments
 * DS201: Simplify complex destructure assignments
 * DS202: Simplify dynamic range loops
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 *
 * Other to-dos:
 * Get byte array tests working again (lines 832ff in openmath.test.js).
 * Verify that the index.js file still works
 */

// # OpenMath module
//
// This module implements an encoding of OpenMath objects as JSON.  It is *not*
// an official encoding endorsed by the OpenMath Society.  It is merely my own
// choice of how to do the encoding, in the absence of an official standard
// (that I could find).
//
// Objects are encoded as follows.  (If these phrases are unfamiliar to you,
// see [the OpenMath Standard,
// v2.0](http://www.openmath.org/standard/om20-2004-06-30/).)
//  * OMI - `{ t : 'i', v : 6 }` (where `t` stands for type and `v` for value),
//    and integers may also be stored as strings if desired (e.g., `-6`)
//  * OMF - `{ t : 'f', v : -0.521 }`
//  * OMSTR - `{ t : 'st', v : 'example' }`
//  * OMB - `{ t : 'ba', v : aUint8ArrayHere }`
//  * OMS - `{ t : 'sy', n : 'symbolName', cd : 'cd', uri : 'http://...' }`,
//    where the URI is optional
//  * OMV - `{ t : 'v', n : 'name' }`
//  * OMA - `{ t : 'a', c : [ child, objects, here ] }` (children are the
//    required operator, followed by zero or more operands)
//  * OMATTR - rather than wrap things in OMATTR nodes, simply add the
//    attributes object (a mapping from string keys to objects) to the existing
//    object, with 'a' as its key.  To create the string key for an OM symbol,
//    just use its JSON form (fully compact, as created by `JSON.stringify`
//    with one argument).
//  * OMBIND - `{ t : 'bi', s : object, v : [ bound, vars ], b : object }`,
//    where `s` stands for the head symbol and `b` for the body
//  * OMERR - `{ t : 'e', s : object, c : [ child, nodes, here ] }`, where `s`
//    stands for the head symbol, and `c` can be omitted if empty.
//  * No encoding for foreign objects is specified here.
//
// ## OpenMath Node class

// ### Simple encoding and decoding
//
// The above functions can be used to create OpenMath data structures of
// arbitrary complexity and type.  But most use cases can be handled with only
// a subset of that full complexity, and we provide the following tools for
// doing so.
//
// `OMNode.simpleDecode()` takes a string as input (like `OMNode.decode()`
// does), but this string is in a much simpler form.  Here are the formats it
// supports.
//  * `anyIdentifier` will be treated as a variable.  Examples:
//    * `x`
//    * `thing_7`
//  * `ident1.ident2` will be treated as a symbol (CD and name, respectively).
//    Examples:
//    * `arith1.plus`
//    * `transc1.arcsin`
//  * any integer will be treated as an integer.  Examples:
//    * -6
//    * 57328074078459027340 (value will be a string, due to size)
//  * any float will be treated as a float.  Examples:
//    * 582.53280
//    * -0.00001
//  * a string literal enclosed in quotation marks (`"`) will be treated as a
//    string, but with no support for escape codes, other than `\"`.  Examples:
//    * `"this is a string"`
//    * `""`
//  * a string literal enclosed in single quotes (`'`) behaves the same way,
//    escaping only `\'`
//    * `'this is also a string, ain\'t it?'`
//    * `'""'`
//  * `F(A1,...,An)`, where `F` is any valid form and each `Ai` is as well,
//    is interpreted as the application of `F` to the `Ai` in the order given.
//    Here `n` may be zero.  Examples:
//    * `f(x)`
//    * `transc1.arcsin(arith1.divide(1,2))`
//  * `F[A1,...,An]` behaves the same as the previous case, except that the
//    `Ai` entries before `An` must all be variables, and they will be bound;
//    i.e., this yields an OpenMath binding object, not an application object.
//    Examples:
//    * `logic.forall[x,P(x)]`
//    * `foo.lambda[x,f(x,7,"bar")]`
//
// This syntax does not allow for the expression of OpenMath error objects,
// attributions, symbol URIs, byte arrays, or very large integers.
//
// We declare the following structure for use in the routine below.
const tokenTypes = [ {
    name : 'symbol',
    pattern : /[:A-Za-z_][:A-Za-z_0-9-]*\.[:A-Za-z_][:A-Za-z_0-9-]*/
}, {
    name : 'variable',
    pattern : /[:A-Za-z_][:A-Za-z_0-9-]*/
}, {
    name : 'float',
    pattern : /[+-]?(?:[0-9]+\.[0-9]*|[0-9]*\.[0-9]+)/
}, {
    name : 'integer',
    pattern : /[+-]?[0-9]+/
}, {
    name : 'string',
    pattern : /"(?:[^"\\]|\\"|\\\\)*"|'(?:[^'\\]|\\'|\\\\)*'/
}, {
    name : 'comma',
    pattern : /,/
}, {
    name : 'openParen',
    pattern : /\(/
}, {
    name : 'closeParen',
    pattern : /\)/
}, {
    name : 'openBracket',
    pattern : /\[/
}, {
    name : 'closeBracket',
    pattern : /\]/
} ];

export class OMNode {

    // ### Class ("static") methods
    //
    // The following class method checks to see if an object is of any one of the
    // formats specified above; if so, it returns null, and if not, it returns an
    // error describing why not.  It is recursive, verifying that children are also
    // of the correct form.
    //
    // It either returns a string, meaning that the object is invalid, and the
    // string contains the reason why, or it returns null, meaning that the object
    // is valid.
    static checkJSON( object ) {
        let key, reason;
        let child;
        if (!(object instanceof Object)) {
            return `Expected an object, found ${typeof object}`;
        }

        // If the object has attributes, we must verify that their keys are the
        // stringified forms of JSON objects representing OpenMath symbols and their
        // values also pass this same validity test, recursively.
        if (object.hasOwnProperty('a')) {
            for (key of Object.keys(object.a || {})) {
                var symbol;
                const value = object.a[key];
                try {
                    symbol = JSON.parse(key);
                } catch (e) {
                    return `Key ${key} invalid JSON`;
                }
                if (symbol.t !== 'sy') {
                    return `Key ${key} is not a symbol`;
                }
                if (reason = this.checkJSON(symbol)) { return reason; }
                if (reason = this.checkJSON(value)) { return reason; }
            }
        }

        // This function verifies that the object doesn't have any keys beyond those on
        // the list, plus 't' for type and 'a' for attributes.
        const checkKeys = function( ...list ) {
            for (key of Object.keys(object)) {
                if (!list.includes(key) && (key !== 't') && (key !== 'a')) {
                    return `Key ${key} not valid in object of type ${object.t}`;
                }
            }
            return null;
        };

        // This is not nearly the full range of Unicode symbols permitted for
        // identifiers in the OpenMath specification, but is a useful subset for this
        // first implementation.  See page 14 of [the
        // standard](http://www.openmath.org/standard/om20-2004-06-30/omstd20.pdf) for
        // the exact regular expression.
        const identRE =
            /^[:A-Za-z_\u0374-\u03FF][:A-Za-z_\u0374-\u03FF.0-9-]*$/;

        // Now we consider each type of object separately.
        switch (object.t) {

            // Integers must have t and v keys, and the latter must look like an integer,
            // whether it's actually one or a string doesn't matter.
            case 'i':
                if (reason = checkKeys('v')) { return reason; }
                if (!/^[+-]?[0-9]+$/.test(`${object.v}`)) {
                    return `Not an integer: ${object.v}`;
                }
                break;

            // Floats must have t and v keys, and the latter must be a number.
            case 'f':
                if (reason = checkKeys('v')) { return reason; }
                if (typeof object.v !== 'number') {
                    return `Not a number: ${object.v} of type ${typeof object.v}`;
                }
                if (isNaN(object.v)) {
                    return 'OpenMath floats cannot be NaN';
                }
                if (!isFinite(object.v)) {
                    return 'OpenMath floats must be finite';
                }
                break;

            // Strings must have t and v keys, and the latter must be a string.
            case 'st':
                if (reason = checkKeys('v')) { return reason; }
                if (typeof object.v !== 'string') {
                    return `Value for st type was ${typeof object.v}, not string`;
                }
                break;

            // Byte Arrays must have t and v keys, the latter of which is a `Uint8Array`.
            case 'ba':
                if (reason = checkKeys('v')) { return reason; }
                if (!(object.v instanceof Uint8Array)) {
                    return `Value for ba type was not an instance of Uint8Array`;
                }
                break;

            // Symbols must have t, n, and cd keys, with an optional uri key, all of which
            // must be strings.  The n key (for "name") must be a valid identifier, in that
            // it must match the regular expression defined above.
            case 'sy':
                if (reason = checkKeys('n','cd','uri')) { return reason; }
                if (typeof object.n !== 'string') {
                    return `Name for sy type was ${typeof object.n}, not string`;
                }
                if (typeof object.cd !== 'string') {
                    return `CD for sy type was ${typeof object.cd}, not string`;
                }
                if ((object.uri != null) && (typeof object.uri !== 'string')) {
                    return `URI for sy type was ${typeof object.uri}, not string`;
                }
                if (!identRE.test(object.n)) {
                    return `Invalid identifier as symbol name: ${object.n}`;
                }
                if (!identRE.test(object.cd)) {
                    return `Invalid identifier as symbol CD: ${object.cd}`;
                }
                break;

            // Variables must have t and n keys, the latter of which must be a valid
            // identifier, matching the same regular expression as above.
            case 'v':
                if (reason = checkKeys('n')) { return reason; }
                if (typeof object.n !== 'string') {
                    return `Name for v type was ${typeof object.n}, not string`;
                }
                if (!identRE.test(object.n)) {
                    return `Invalid identifier as variable name: ${object.n}`;
                }
                break;

            // Applications must have t and c keys, the latter of which must be an array of
            // objects that pass this same validity test, applied recursively.  It may not
            // be empty.
            case 'a':
                if (reason = checkKeys('c')) { return reason; }
                if (!(object.c instanceof Array)) {
                    return `Children of application object was not an array`;
                }
                if (object.c.length === 0) {
                    return `Application object must have at least one child`;
                }
                for (child of object.c) {
                    if (reason = this.checkJSON(child)) { return reason; }
                }
                break;

            // Bindings must have t, s, v, and b keys, where s is a symbol, v an array of
            // variables, and b any OpenMath node.
            case 'bi':
                if (reason = checkKeys('s', 'v', 'b')) { return reason; }
                if (reason = this.checkJSON(object.s)) { return reason; }
                if (object.s.t !== 'sy') {
                    return "Head of a binding must be a symbol";
                }
                if (!(object.v instanceof Array)) {
                    return "In a binding, the v value must be an array";
                }
                for (let variable of object.v) {
                    if (reason = this.checkJSON(variable)) { return reason; }
                    if (variable.t !== 'v') {
                        return `In a binding, all values in the v array must have type v`;
                    }
                }
                if (reason = this.checkJSON(object.b)) { return reason; }
                break;

            // Errors must have t, s, and c keys, with s a symbol and c an array of child
            // nodes.
            case 'e':
                if (reason = checkKeys('s', 'c')) { return reason; }
                if (reason = this.checkJSON(object.s)) { return reason; }
                if (object.s.t !== 'sy') {
                    return "Head of an error must be a symbol";
                }
                if (!(object.c instanceof Array)) {
                    return "In an error, the c key must be an array";
                }
                for (child of object.c) {
                    if (reason = this.checkJSON(child)) { return reason; }
                }
                break;

            // If the object's type is not on that list, it's not valid.
            default:
                return `Invalid type: ${object.t}`;
        }

        // If all of the above checks pass then we return null, meaning the object is
        // valid (no errors).
        return null;
    }

    // The following function converts a string encoding of an OpenMath structure
    // and creates an instance of `OMNode` for the corresponding structure.
    //  * If the string contains invalid JSON, this routine will return an
    //    error message string rather than an OMNode object.
    //  * If it contains JSON for a structure that doesn't pass `checkJSON`, above,
    //    again, an error message string is returned.
    //  * Otherwise it adds appropriate parent pointers to the nodes in the
    //    resulting tree, then wraps it in an instance of OMNode and returns it.
    // The function can also take an object that has been parsed from such JSON
    // text.
    static decode( json ) {
        let reason;
        if (typeof json === 'string') {
            try { json = JSON.parse(json); } catch (e) { return e.message; }
        }
        if (reason = this.checkJSON(json)) { return reason; }
        var setParents = function( node ) {
            let v;
            for (let c of node.c != null ? node.c : [ ]) { // children, if any
                c.p = node;
                setParents(c);
            }
            if (node.t === 'bi') {
                for (v of node.v != null ? node.v : [ ]) { // bound variables, if any
                    v.p = node;
                    setParents(v);
                }
            }
            const object = node.a != null ? node.a : { };
            for (let k of Object.keys(object)) { // attribute values, if any
                v = object[k];
                v.p = node;
                setParents(v);
            }
            // head symbol and body object, if any
            if (node.s != null) { node.s.p = node;  setParents(node.s); }
            if (node.b != null) { node.b.p = node;  return setParents(node.b); }
        };
        setParents(json);
        json.p = null;
        return new OMNode(json);
    }

    // ### Constructor
    //
    // The above factory function uses the following constructor.  The constructor
    // also defines several properties for the object, by installing getters for
    // the common attributes type, value, name, cd, uri, symbol, body, children,
    // and variables.  These all return undefined if they do not apply to the
    // current structure, except children and variables, which return empty arrays
    // in that case.
    constructor( tree ) {
        this.encode = this.encode.bind(this);
        this.equals = this.equals.bind(this);
        this.sameObjectAs = this.sameObjectAs.bind(this);
        this.copy = this.copy.bind(this);
        this.simpleEncode = this.simpleEncode.bind(this);
        this.findInParent = this.findInParent.bind(this);
        this.findChild = this.findChild.bind(this);
        this.address = this.address.bind(this);
        this.index = this.index.bind(this);
        this.remove = this.remove.bind(this);
        this.replaceWith = this.replaceWith.bind(this);
        this.getAttribute = this.getAttribute.bind(this);
        this.removeAttribute = this.removeAttribute.bind(this);
        this.setAttribute = this.setAttribute.bind(this);
        this.freeVariables = this.freeVariables.bind(this);
        this.isFree = this.isFree.bind(this);
        this.occursFree = this.occursFree.bind(this);
        this.isFreeToReplace = this.isFreeToReplace.bind(this);
        this.replaceFree = this.replaceFree.bind(this);
        this.childrenSatisfying = this.childrenSatisfying.bind(this);
        this.descendantsSatisfying = this.descendantsSatisfying.bind(this);
        this.hasDescendantSatisfying = this.hasDescendantSatisfying.bind(this);
        this.tree = tree;
        Object.defineProperty(this, 'parent',
            {get() { if (this.tree.p) { return new OMNode(this.tree.p); } else { return undefined; } }});
        Object.defineProperty(this, 'type', {get() { return this.tree.t; }});
        Object.defineProperty(this, 'value',
            {get() { if (this.tree.t !== 'bi') { return this.tree.v; } else { return undefined; } }});
        Object.defineProperty(this, 'name', {get() { return this.tree.n; }});
        Object.defineProperty(this, 'cd', {get() { return this.tree.cd; }});
        Object.defineProperty(this, 'uri', {get() { return this.tree.uri; }});
        Object.defineProperty(this, 'symbol',
            {get() { if (this.tree.s) { return new OMNode(this.tree.s); } else { return undefined; } }});
        Object.defineProperty(this, 'body',
            {get() { if (this.tree.b) { return new OMNode(this.tree.b); } else { return undefined; } }});
        Object.defineProperty(this, 'children',
            {get() { return (this.tree.c != null ? this.tree.c : [ ]).map(child => new OMNode(child)); }});
        Object.defineProperty(this, 'variables', {
            get() { if (this.tree.t === 'bi') {
                return this.tree.v.map(variable => new OMNode(variable));
            } else {
                return [ ];
            } }
        });
    }

    // ### Serialization
    //
    // Unserializing an `OMNode` object from a string is done by the `decode`
    // method, above.  Serializing is done by its inverse, here, which simply uses
    // `JSON.stringify`, but filters out parent pointers.
    encode() {
        return JSON.stringify(this.tree, function( k, v ) {
            if (k === 'p') { return undefined; } else { return v; }
        });
    }

    // ### Copies and equality
    //
    // Two instances will often want to be compared for equality, structurally.
    // This is essentially the same activity as comparing equality of two JSON
    // structures, except parent pointers should be ignored so that the recursion
    // remains acyclic.
    //
    // You can pass a second parameter indicating whether to pay attention to
    // attributes in the comparison.  By default it is true, meaning consider all
    // attributes.  If it is false, no attributes will be considered.  Other values
    // may be supported in the future.
    equals( other, attributes ) {
        if (attributes == null) { attributes = true; }
        var recur = function( a, b ) {

            // If they are atomically equal, we're done.
            let key, value;
            if (a === b) { return true; }

            // If they're arrays, ensure they have the same length, type, and contents.
            if (a instanceof Array || a instanceof Uint8Array) {
                if (( a instanceof Array ) && (!( b instanceof Array ))) {
                    return false;
                }
                if (( a instanceof Uint8Array ) &&
                   (!( b instanceof Uint8Array ))) {
                    return false;
                }
                if (a.length !== b.length) { return false; }
                for (let index = 0; index < a.length; index++) {
                    const element = a[index];
                    if (!recur(element, b[index])) { return false; }
                }
                return true;
            }

            // Otherwise, they must be objects, with all the same key-value pairs.
            // The one exception to this is that for OpenMath attributes (which are stored
            // under key "a"), it is the same if the "a" key is simply absent (meaning no
            // attributes) or if its value is the empty object `{ }` (also meaning no
            // attributes).
            if (!(a instanceof Object)) { return false; }
            if (!(b instanceof Object)) { return false; }
            for (key of Object.keys(a)) {
                value = a[key];
                if ((key === 'p') || (!attributes && (key === 'a'))) {
                    continue;
                }
                if (!b.hasOwnProperty(key)) {
                    if (key === 'a') { return recur(value, { }); }
                    return false;
                }
                if (!recur(value, b[key])) { return false; }
            }
            for (key of Object.keys(b)) {
                value = b[key];
                if ((key === 'p') || (!attributes && (key === 'a'))) {
                    continue;
                }
                if (!a.hasOwnProperty(key)) {
                    if (key === 'a') { return recur(value, { }); }
                    return false;
                }
            }
            return true;
        };
        return recur(this.tree, other.tree);
    }

    // There is also a much stricter notion of equality:  Do the two OMNode objects
    // actually wrap the same object underneath?  That is, are they pointing to the
    // same tree in memory?  This function can detect that.
    sameObjectAs( other ) { return this.tree === (other != null ? other.tree : undefined); }

    // On a similar note, you may want to create a distinct copy of any given
    // OMNode instance.  Here is a method for doing so.
    copy() {
        var recur = function( tree ) {
            let result;
            switch (tree.t) {

                // Integers, floats, and strings are easy to copy; just duplicate type and
                // value.  Variables and symbols are easy for the same reason, but different
                // atomic members.
                case 'i': case 'f': case 'st':
                    result = { t : tree.t, v : tree.v };
                    break
                case 'v':
                    result = { t : 'v', n : tree.n };
                    break
                case 'sy':
                    result = { t : 'sy', n : tree.n, cd : tree.cd };
                    if (tree.hasOwnProperty('uri')) {
                        result.uri = tree.uri;
                    }
                    break

                // Byte arrays require making a copy of the byte array object, which can be
                // accomplished with the constructor.
                case 'ba':
                    result = { t : 'ba', v : new Uint8Array(tree.v) };
                    break

                // For errors and applications, we copy the children array; for errors we also
                // include the symbol.
                case 'e': case 'a':
                    result = {
                        t : tree.t,
                        c : tree.c.map(child => recur(child))
                    };
                    if (tree.t === 'e') { result.s = recur(tree.s); }
                    break

                // Lastly, for bindings, we copy each sub-part: symbol, body, variable list.
                case 'bi':
                    result = {
                        t : 'bi',
                        s : recur(tree.s),
                        v : tree.v.map(variable => recur(variable)),
                        b : recur(tree.b)
                    };
                    break
            }

            // Then no matter what we created, we copy the attributes over as well.
            const object = tree.a != null ? tree.a : { };
            for (let key of Object.keys(object)) {
                const value = object[key];
                ( result.a != null ? result.a : (result.a = { }) )[key] = recur(value);
            }
            return result;
        };

        // Apply the recursive function.
        return OMNode.decode(recur(this.tree));
    }

    // ### Factory functions
    //
    // We provide here functions for creating each type of OMNode, from integer to
    // error.  Each is a "static" (class) method, documented separately.  It
    // returns an error message as a string if there was an error, instead of the
    // desired OMNode instance.
    //
    // The integer factory function creates an OpenMath integer node, and must be
    // passed a single parameter containing either an integer or a string
    // representation of an integer, e.g., `OM.integer 100`.
    static integer( value ) {
        return OMNode.decode({ t : 'i', v : value });
    }

    // The float factory function creates an OpenMath float node, and must be
    // passed a single parameter containing a number, e.g., `OM.integer 1.234`,
    // and that number cannot be infinite or NaN.
    static float( value ) {
        return OMNode.decode({ t : 'f', v : value });
    }

    // The string factory function creates an OpenMath string node, and must be
    // passed a single parameter containing a string, e.g., `OM.integer 'hi'`.
    static string( value ) {
        return OMNode.decode({ t : 'st', v : value });
    }

    // The byte array factory function creates an OpenMath byte array node, and
    // must be passed a single parameter that is an instance of `Uint8Array`.
    static bytearray( value ) {
        return OMNode.decode({ t : 'ba', v : value });
    }

    // The symbol factory function creates an OpenMath symbol node, and must be
    // passed two or three parameters, in this order: symbol name (a string),
    // content dictionary name (a string), and optionally the CD's base URI (a
    // string).
    static symbol( name, cd, uri ) {
        return OMNode.decode((uri != null) ?
            { t : 'sy', n : name, cd, uri }
        :
            { t : 'sy', n : name, cd });
    }

    // The variable factory function creates an OpenMath variable node, and must be
    // passed one parameter, the variable name (a string).
    static variable( name ) {
        return OMNode.decode({ t : 'v', n : name });
    }

    // The application factory creates an OpenMath application node, and accepts a
    // variable number of arguments, each of which must be either an `OMNode`
    // instance or the JSON object that could function as the tree within such an
    // instance.  `OMNode` instances are copied, objects are used as-is.
    static application( ...args ) {
        const result = { t : 'a', c : [ ] };
        for (let arg of args) {
            result.c.push(arg instanceof OMNode ?
                JSON.parse(arg.encode()) // copy without parent pointers
            :
                arg
            );
        }
        return OMNode.decode(result);
    }

    // The attribution factory creates an OpenMath node from its first argument,
    // and attaches to it the attributes specified by the remaining arguments.
    // Those remaining arguments must come in pairs k1, v1, through kn, vn, and
    // each ki,vi pair must be an OpenMath symbol node followed by any OpenMath
    // node.  As in the case of applications, such nodes may be JSON objects or
    // `OMNode` instances; the former are used as-is and the latter copied.  The
    // first parameter can also be either a JSON object or an `OMNode` instance,
    // and in the latter case it, too, is copied.
    static attribution( node, ...attrs ) {
        if (!(node instanceof Object)) {
            return 'Invalid first parameter to attribution';
        }
        if ((attrs.length % 2) !== 0) {
            return 'Incomplete key-value pair in attribution';
        }
        if (node instanceof OMNode) { node = JSON.parse(node.encode()); }
        while (attrs.length > 0) {
            if (node.a == null) { node.a = { }; }
            let key = attrs.shift();
            key = key instanceof OMNode ?
                key.encode()
            :
                JSON.stringify(key);
            const value = attrs.shift();
            node.a[key] = value instanceof OMNode ?
                JSON.parse(value.encode()) // copy without parent pointers
            :
                value;
        }
        return OMNode.decode(node);
    }

    // The binding factory functions exactly like the application factory, except
    // that it has restrictions on the types of its arguments.  The first must be a
    // symbol (used as the head of the binding), the last can be any OpenMath node,
    // and all those in between must be variables.  Furthermore, there must be at
    // least two arguments, so that there is a head and a body.  Just as in the
    // case of applications, `OMNode` instances are copied, but straight JSON
    // objects are used as-is.
    static binding( head, ...rest ) {
        const adjustedLength = Math.max(rest.length, 1), vars = rest.slice(0, adjustedLength - 1), body = rest[adjustedLength - 1];
        if (!(head instanceof Object)) {
            return 'Invalid first parameter to binding';
        }
        if (!(body instanceof Object)) {
            return 'Invalid last parameter to binding';
        }
        const result = {
            t : 'bi',
            s : head instanceof OMNode ?
                JSON.parse(head.encode())
            :
                head,
            v : [ ],
            b : body instanceof OMNode ?
                JSON.parse(body.encode())
            :
                body
        };
        for (let variable of vars) {
            result.v.push(variable instanceof OMNode ?
                JSON.parse(variable.encode()) // copy w/o parent pointers
            :
                variable
            );
        }
        return OMNode.decode(result);
    }

    // The error factory functions exactly like the application factory, except
    // that it has one restriction on the types of its arguments:  The first must
    // be a symbol.  Just as in the case of applications, `OMNode` instances are
    // copied, but straight JSON objects are used as-is.
    static error( head, ...others ) {
        if (!(head instanceof Object)) {
            return 'Invalid first parameter to binding';
        }
        const result = {
            t : 'e',
            s : head instanceof OMNode ?
                JSON.parse(head.encode())
            :
                head,
            c : [ ]
        };
        for (let other of others) {
            result.c.push(other instanceof OMNode ?
                JSON.parse(other.encode()) // copy without parent pointers
            :
                other
            );
        }
        return OMNode.decode(result);
    }

    // Now the routine itself.
    static simpleDecode( input ) {

        // Ensure the input is a string.
        if (typeof input !== 'string') {
            return 'Input was not a string';
        }

        // Tokenize it using the above token data.
        const tokens = [ ];
        while (input.length > 0) {
            const originally = input.length;
            for (let tokenType of tokenTypes) {
                const match = tokenType.pattern.exec(input);
                if ((match != null) && (match.index === 0)) {
                    tokens.push({
                        type : tokenType.name,
                        text : match[0]});
                    input = input.slice(match[0].length);
                }
            }
            if (input.length === originally) {
                return `Could not understand from here: ${input.slice(0, 11)}`;
            }
        }

        // Parse tokens using two states: one for when an expression is about to start,
        // and one for when an expression just ended.  Maintain a stack of expressions
        // already parsed, for forming application and binding expressions.
        let state = 'expression about to start';
        const stack = [ ];
        while (tokens.length > 0) {
            var type;
            var expr, i, index;
            var asc, end;
            var asc1, end1;
            let next = tokens.shift();
            switch (state) {
                case 'expression about to start':
                    switch (next.type) {
                        case 'symbol':
                            var halves = next.text.split('.');
                            stack.unshift({
                                node :
                                    OMNode.symbol(halves[1], halves[0])});
                            break;
                        case 'variable':
                            stack.unshift({
                                node : OMNode.variable(next.text)});
                            break;
                        case 'integer':
                            var int = parseInt(next.text);
                            if (/\./.test(int)) { int = next.text; }
                            stack.unshift({node : OMNode.integer(int)});
                            break;
                        case 'float':
                            stack.unshift({
                                node : OMNode.float(parseFloat(next.text))});
                            break;
                        case 'string':
                            type = next.text[0];
                            next = next.text.slice(1, -1).replace(
                                RegExp( `\\\\${type}`, 'g' ), type);
                            stack.unshift({node : OMNode.string(next)});
                            break;
                        default: return `Unexpected ${next.text}`;
                    }
                    state = 'expression ended';
                    break;
                case 'expression ended':
                    switch (next.type) {
                        case 'comma':
                            state = 'expression about to start';
                            break;
                        case 'openParen':
                            stack[0].head = 'application';
                            if ( tokens && tokens[0] && tokens[0].type === 'closeParen' ) {
                                tokens.shift();
                                stack.unshift({
                                    node : OMNode.application(
                                        stack.shift().node)
                                });
                                state = 'expression ended';
                            } else {
                                state = 'expression about to start';
                            }
                            break;
                        case 'openBracket':
                            stack[0].head = 'binding';
                            state = 'expression about to start';
                            break;
                        case 'closeParen':
                            for (index = 0; index < stack.length; index++) {
                                expr = stack[index];
                                if (expr.head === 'application') { break; }
                                if (expr.head === 'binding') {
                                    return "Mismatch: [ closed by )";
                                }
                            }
                            if (index === stack.length) {
                                return "Unexpected )";
                            }
                            var children = [ ];
                            for (i = 0, end = index, asc = 0 <= end; asc ? i <= end : i >= end; asc ? i++ : i--) {
                                children.unshift(stack.shift().node);
                            }
                            stack.unshift({
                                node : OMNode.application.apply(
                                    null, children)
                            });
                            break;
                        case 'closeBracket':
                            for (index = 0; index < stack.length; index++) {
                                expr = stack[index];
                                if (expr.head === 'binding') { break; }
                                if (expr.head === 'application') {
                                    return "Mismatch: ( closed by ]";
                                }
                            }
                            if (index === stack.length) {
                                return "Unexpected ]";
                            }
                            children = [ ];
                            for (i = 0, end1 = index, asc1 = 0 <= end1; asc1 ? i <= end1 : i >= end1; asc1 ? i++ : i--) {
                                children.unshift(stack.shift().node);
                            }
                            stack.unshift({
                                node : OMNode.binding.apply(
                                    null, children)
                            });
                            break;
                        default: return `Unexpected ${next.text}`;
                    }
                    break;
            }
            if (typeof (stack != null ? stack[0].node : undefined) === 'string') {
                return stack[0].node; // error in building OMNode
            }
        }

        // Parsing complete so there should be just one node on the stack, the result.
        // If there is more than one, we have an error.
        if (stack.length > 1) {
            return "Unexpected end of input";
        } else {
            return stack[0].node;
        }
    }

    // The inverse to the above function is a simple encoding function.  It can
    // operate on only a subset of the full complexity of OMNode trees, and thus in
    // some cases it gives results that are not representative of the input.  Here
    // are the details:
    //  * integers, floats, and strings will all be correctly encoded
    //  * variables without dots in their names will be correctly encoded; those
    //    with dots in their names conflict with the naming of symbols in the
    //    simple encoding, but will be encoded as their names
    //  * symbols will be correctly encoded with the exception that any URI will be
    //    dropped, and the same issue with dots applies to symbol and CD names
    //  * byte arrays and errors have no simple encoding, and will thus all be
    //    converted to a string containing the words "byte array" or "error,"
    //    respectively
    //  * all attributions are dropped
    simpleEncode() {
        var recur = function( tree ) {
            switch ((tree != null ? tree.t : undefined)) {
                case 'i': case 'f': return `${tree.v}`;
                case 'v': return tree.n;
                case 'st': return `'${tree.v.replace(/'/g, '\\\'')}'`;
                case 'sy': return `${tree.cd}.${tree.n}`;
                case 'ba': return "'byte array'";
                case 'e': return "'error'";
                case 'a':
                    var children = ( tree.c.map(c => recur(c)) );
                    var head = children.shift();
                    return `${head}(${children.join(',')})`;
                case 'bi':
                    var variables = ( tree.v.map(v => recur(v)) );
                    head = recur(tree.s);
                    var body = recur(tree.b);
                    return `${head}[${variables.join(',')},${body}]`;
                default: return `Error: Invalid OpenMath type ${(tree != null ? tree.t : undefined)}`;
            }
        };
        return recur(this.tree);
    }

    // ### Parent-child relationships
    //
    // The functions in this category make, break, or report the relationship of an
    // OMNode instance to its parents or children.
    //
    // This first function reports where the node is in its parent.  The return
    // value will be one of five types:
    //  * a string containing "c" followed by a number, as in 'c7' - this means
    //    that the node is in it's parent's `children` array, and is at index 7
    //  * a string containing "v" followed by a number, as in 'v0' - this is the
    //    same as the previous, but for the parent's `variables` array
    //  * the string "b" - this means that the node is the body and its parent is
    //    a binding
    //  * the string "s" - this means that the node is a symbol for its parent,
    //    which is either an error or a binding
    //  * a lengthier string beginning with "{" - this is the JSON encoded version
    //    of the attribute key for which the node is the corresponding value
    //  * undefined if none of the above apply (e.g., no parent, or invalid tree
    //    structure)
    findInParent() {
        let index;
        if (!this.parent) { return undefined; }
        for (index = 0; index < this.parent.children.length; index++) {
            const child = this.parent.children[index];
            if (this.sameObjectAs(child)) { return `c${index}`; }
        }
        if (this.type === 'v') {
            for (index = 0; index < this.parent.variables.length; index++) {
                const variable = this.parent.variables[index];
                if (this.sameObjectAs(variable)) { return `v${index}`; }
            }
        }
        if (this.sameObjectAs(this.parent.symbol)) { return 's'; }
        if (this.sameObjectAs(this.parent.body)) { return 'b'; }
        const object = this.parent.tree.a != null ? this.parent.tree.a : { };
        for (let key of Object.keys(object)) {
            const value = object[key];
            if (this.tree === value) { return key; }
        }
        return undefined; // should not happen
    }

    // The inverse of the previous function takes a string output by that function
    // and returns the corresponding child/variables/symbol/body immediately inside
    // this node.  That is, `x.parent.findChild x.findInParent()` will give us back
    // the same tree as `x` itself.  An invalid input will return undefined.
    findChild( indexInParent ) {
        switch (indexInParent[0]) {
            case 'c': return this.children[parseInt(indexInParent.slice(1))];
            case 'v': return this.variables[parseInt(indexInParent.slice(1))];
            case 's': return this.symbol;
            case 'b': return this.body;
            case '{': return this.getAttribute(OMNode.decode(indexInParent));
        }
    }

    // The `findInParent()` function can be generalized to find a node in any of
    // its ancestors, the result being an array of `findInParent()` results as you
    // walk downward from the ancestor to the descendant.  For instance, the first
    // bound variable within the second child of an application would have the
    // address `[ 'c1', 'v0' ]` (since indices are zero-based).  The following
    // function computes the array in question, the node's "address" within the
    // given ancestor.
    //
    // If no ancestor is specified, the highest-level one is used.  If a value is
    // passed that is not an ancestor of this node, then it is treated as if no
    // value had been passed.  If this node has no parent, or if this node itself
    // is passed as the parameter, then the empty array is returned.
    address( inThis ) {
        if (!this.parent || this.sameObjectAs(inThis)) { return [ ]; }
        return this.parent.address( inThis ).concat([ this.findInParent() ]);
    }

    // The `address` function has the following inverse, which looks up in an
    // ancestor node a descendant that has the given address within that ancestor.
    // So, in particular, `x.index y.address( x )` should equal `y`.  Furthermore,
    // `x.index [ ]` will always yield `x`.  An invalid input will return
    // undefined.
    index( address ) {
        if (!(address instanceof Array)) { return undefined; }
        if (address.length === 0) { return this; }
        const child = this.findChild( address[0] )
        return typeof child === 'undefined' || child === null ? undefined :
            child.index(address.slice(1));
    }

    // The following function breaks the relationship of the object with its
    // parent.  In some cases, this can invalidate the parent (e.g., by giving a
    // binding or error object no head symbol, or a binding no body, or no bound
    // variables).  If the object has no parent or its position in that parent is
    // undefined (as determined by `@findInParent()`) then this does nothing.
    remove() {
        let index;
        if (!(index = this.findInParent())) { return; }
        switch (index[0]) {
            case 'c':
                this.parent.tree.c.splice(parseInt( index.slice(1) ), 1);
                break;
            case 'v':
                this.parent.tree.v.splice(parseInt( index.slice(1) ), 1);
                break;
            case 'b': delete this.parent.tree.b; break;
            case 's': delete this.parent.tree.s; break;
            case '{': delete this.parent.tree.a[index]; break;
        }
        delete this.tree.p;
    }

    // It will also be useful in later functions in this class to be able to
    // replace a subtree in-place with a new one.  The following method
    // accomplishes this, replacing this object in its context with the parameter.
    // This works whether this tree is a child, variable, head symbol, body, or
    // attribute value of its parent.  If this object has no parent, then we make
    // no modifications to that parent, since it does not exist.
    //
    // In all other cases, the parameter is `remove()`d from its context, and this
    // node, if it has a parent, is `remove()`d from it as well.  Furthermore, this
    // OMNode instance becomes a wrapper to the given node instead of its current
    // contents.  The removed node is returned.
    replaceWith( other ) {
        if (this.sameObjectAs(other)) { return; }
        const index = this.findInParent();

        // If you attempt to replace a binding's or error's head symbol with a
        // non-symbol, this routine does nothing.  If you attempt to replace one of a
        // binding's variables with a non-variable, this routine does nothing.  When
        // this routine does nothing, it returns undefined.
        if ((index === 's') && (other.type !== 'sy')) { return; }
        if (((index != null ? index[0] : undefined) === 'v') && (other.type !== 'v')) { return; }
        other.remove();
        const original = new OMNode(this.tree);
        this.tree = other.tree;
        switch ((index != null ? index[0] : undefined)) {
            case 'c':
                original.parent.tree.c[parseInt(index.slice(1))] = this.tree;
                break;
            case 'v':
                original.parent.tree.v[parseInt(index.slice(1))] = this.tree;
                break;
            case 'b': original.parent.tree.b = this.tree; break;
            case 's': original.parent.tree.s = this.tree; break;
            case '{': original.parent.tree.a[index] = this.tree; break;
            default: return; // didn't have a parent
        }
        this.tree.p = original.tree.p;
        delete original.tree.p;
        return original;
    }

    // ### Attributes
    //
    // Here we have three functions that let us manipulate attributes without
    // worrying about the unpredictable ordering of keys in a JSON stringification
    // of an object.
    //
    // The first takes an OMNode instance as input and looks up the corresponding
    // key-value pair in this object's attributes, if there is one.  If so, it
    // returns the corresponding value as an OMNode instance.  Otherwise, it
    // returns undefined.
    //
    // For efficiency, this considers only the names and CDs of the key when
    // searching.  If that becomes a problem later, it could be changed here in
    // this function, as well as in the two that follow.
    getAttribute( keySymbol ) {
        if (!(keySymbol instanceof OMNode)) { return undefined; }
        if (keySymbol.type !== 'sy') { return undefined; }
        const nameRE = RegExp(`\"n\":\"${keySymbol.name}\"`);
        const cdRE = RegExp(`\"cd\":\"${keySymbol.cd}\"`);
        const object = this.tree.a != null ? this.tree.a : { };
        for (let key of Object.keys(object)) {
            const value = object[key];
            if (nameRE.test( key ) && cdRE.test( key )) {
                return new OMNode(value);
            }
        }
    }

    // The second takes an OMNode instance as input and looks up the corresponding
    // key-value pair in this object's attributes, if there is one.  If so, it
    // deletes that key-value pair, which includes calling `remove()` on the value.
    // Otherwise, it does nothing.
    //
    // The same efficiency comments apply to this function as to the previous.
    removeAttribute( keySymbol ) {
        if (!(keySymbol instanceof OMNode)) { return; }
        if (keySymbol.type !== 'sy') { return; }
        const nameRE = RegExp(`\"n\":\"${keySymbol.name}\"`);
        const cdRE = RegExp(`\"cd\":\"${keySymbol.cd}\"`);
        const object = this.tree.a != null ? this.tree.a : { };
        for (let key of Object.keys(object)) {
            const value = object[key];
            if (nameRE.test( key ) && cdRE.test( key )) {
                ( new OMNode(value) ).remove();
                delete this.tree.a[key];
                return;
            }
        }
    }

    // The third and final function of the set takes two OMNode instances as input,
    // a key and a new value.  It looks up the corresponding key-value pair in this
    // object's attributes, if there is one.  If so, it replaces the original value
    // with the new value, including calling `remove()` on the old value.
    // Otherwise, it inserts a new key-value pair corresponding to the two
    // parameters.  In either case, `remove()` is called on the new value before it
    // is inserted into this tree, in case it is already in another tree.
    //
    // The same efficiency comments apply to this function as to the previous.
    setAttribute( keySymbol, newValue ) {
        if (!(keySymbol instanceof OMNode) ||
           !(newValue instanceof OMNode)) { return; }
        if (keySymbol.type !== 'sy') { return; }
        this.removeAttribute(keySymbol);
        newValue.remove();
        ( this.tree.a != null ? this.tree.a : (this.tree.a = { }) )[keySymbol.encode()] = newValue.tree;
        return newValue.tree.p = this.tree;
    }

    // ### Free and bound variables and expressions
    //
    // The methods in this section are about variable binding and which expressions
    // are free to replace others.  There are also methods that do such
    // replacements.
    //
    // This method lists the free variables in an expression.  It returns an array
    // of strings, just containing the variables' names.  Variables appearing in
    // attributes do not count; only variables appearing as children of
    // applications or error nodes, or in the body of a binding expression can
    // appear on this list.
    freeVariables() {
        switch (this.type) {
            case 'v': return [ this.name ];
            case 'a': case 'c':
                var result = [ ];
                for (let child of this.children) {
                    for (let free of child.freeVariables()) {
                        if (!result.includes(free)) { result.push(free); }
                    }
                }
                return result;
            case 'bi':
                var boundByThis = this.variables.map(v => v.name);
                return this.body.freeVariables().filter(varname => !boundByThis.includes(varname));
            default: return [ ];
        }
    }

    // This method computes whether an expression is free by walking up its
    // ancestor chain and determining whether any of the variables free in the
    // expression are bound further up the ancestor chain.  If you pass an
    // ancestor as the parameter, then the computation will not look upward beyond
    // that ancestor; the default is to leave the parameter unspecified, meaning
    // that the algorithm should look all the way up the parent chain.
    isFree( inThis ) {
        const freeVariables = this.freeVariables();
        let walk = this;
        while (walk) {
            if (walk.type === 'bi') {
                const boundHere = walk.variables.map(v => v.name);
                for (let variable of freeVariables) {
                    if (boundHere.includes(variable)) { return false; }
                }
            }
            if (walk.sameObjectAs(inThis)) { break; }
            walk = walk.parent;
        }
        return true;
    }

    // This method returns true if there is a descendant of this structure that is
    // structurally equivalent to the parameter and, at that point in the tree,
    // passes the `isFree` test defined immediately above.  This algorithm only
    // looks downward through children, head symbols, and bodies of binding nodes,
    // not attribute keys or values.
    //
    // Later it would be easy to add an optional second parameter, `inThis`, which
    // would function like the parameter of the same name to `isFree()`, and would
    // be passed directly along to `isFree()`.  This change would require testing.
    occursFree( findThis ) {
        if (this.equals( findThis ) && this.isFree()) { return true; }
        if (this.symbol != null ? this.symbol.equals(findThis) : undefined) { return true; }
        if (this.body != null ? this.body.occursFree(findThis) : undefined) { return true; }
        for (let child of this.children) {
            if (child.occursFree(findThis)) { return true; }
        }
        return false;
    }

    // One subtree A is free to replace another B if no variable free in A becomes
    // bound when B is replaced by A.  Because we will be asking whether variables
    // are free/bound, we will need to know the ancestor context in which to make
    // those queries.  The default is the highest ancestor, but that default can be
    // changed with the optional final parameter.
    //
    // Note that this routine also returns false in those cases where it does not
    // make sense to replace the given subtree with this tree based simply on their
    // types, and not even taking free variables into account.  For example, a
    // binding or error node must have a head symbol, which cannot be replaced with
    // a non-symbol, and a binding node's variables must not be replaced with
    // non-variables.
    isFreeToReplace( subtreeToReplace, inThis ) {
        if (this.sameObjectAs(subtreeToReplace)) { return true; }
        if ((subtreeToReplace.parent == null)) { return true; }
        let context = subtreeToReplace;
        while (context.parent) { context = context.parent; }
        const saved = new OMNode(subtreeToReplace.tree);
        if (!subtreeToReplace.replaceWith(this.copy())) { return false; }
        const result = subtreeToReplace.isFree(inThis);
        subtreeToReplace.replaceWith(saved);
        return result;
    }

    // This method replaces every free occurrence of one expression (original) with
    // a copy of the another expression (replacement).  The search-and-replace
    // recursion only proceeds through children, head symbols, and bodies of
    // binding nodes, not attribute keys or values.
    //
    // The optional third parameter, `inThis`, functions like the parameter of the
    // same name to `isFree()`, is passed directly along to `isFree()`.
    replaceFree( original, replacement, inThis ) {
        if (inThis == null) { inThis = this; }
        if (this.isFree( inThis ) && this.equals(original)) {

            // Although the implementation here is very similar to the implementation of
            // `isFreeToReplace()`, we do not call that function, because it would require
            // making two copies and doing two replacements; this is more efficient.
            const save = new OMNode(this.tree);
            this.replaceWith(replacement.copy());
            if (!this.isFree(inThis)) { this.replaceWith(save); }
            return;
        }
        if (this.symbol != null) {
            this.symbol.replaceFree(original, replacement, inThis);
        }
        if (this.body != null) {
            this.body.replaceFree(original, replacement, inThis);
        }
        for (let variable of this.variables) {
            variable.replaceFree(original, replacement, inThis);
        }
        this.children.map(child =>
            child.replaceFree(original, replacement, inThis));
    }

    // ### Filtering children and descendants
    //
    // The following function returns an array of all children (immediate
    // subexpressions, actually, including head symbols, bound variables, etc.)
    // that pass the given criterion.  If no criterion is given, then all immediate
    // subexpressions are returned.  Order is preserved.
    //
    // Note that the actual subtrees are returned, not copies thereof.  Any
    // manipulation done to the elements of the result array will therefore impact
    // the original expression.
    childrenSatisfying( filter ) {
        if (filter == null) { filter = () => true; }
        let { children } = this;
        if (this.symbol != null) { children.push(this.symbol); }
        children = children.concat(this.variables);
        if (this.body != null) { children.push(this.body); }
        return children.filter( filter )
    }

    // The following function returns an array of all subexpressions (not just
    // immediate ones) that pass the given criterion, in tree order.  If no
    // criterion is given, then all subexpressions are returned.
    //
    // As with the previous function, the actual subtrees are returned, not copies
    // thereof.  Any manipulation done to the elements of the result array will
    // therefore impact the original expression.
    descendantsSatisfying( filter ) {
        if (filter == null) { filter = () => true; }
        let results = [ ];
        if (filter(this)) { results.push(this); }
        for (let child of this.childrenSatisfying()) {
            results = results.concat(child.descendantsSatisfying(filter));
        }
        return results;
    }

    // A simpler function performs the same task as the previous, but does not
    // return a list of all descendants; it merely returns whether there are any,
    // as a boolean.  It is thus more efficient to use this than to run the
    // previous and compare its length to zero.
    hasDescendantSatisfying( filter ) {
        if (filter == null) { filter = () => true; }
        if (filter(this)) { return true; }
        for (let child of this.childrenSatisfying()) {
            if (child.hasDescendantSatisfying(filter)) { return true; }
        }
        return false;
    }
}
export const OM = OMNode;

// ## Nicknames
//
// Here we copy each of the factory functions to a short version if its own
// name, so that they can be combined in more compact form when creating
// expressions.  Each short version is simply the first 3 letters of its long
// version, to make them easy to remember.
OM.int = OM.integer;
OM.flo = OM.float;
OM.str = OM.string;
OM.byt = OM.bytearray;
OM.sym = OM.symbol;
OM.var = OM.variable;
OM.app = OM.application;
OM.att = OM.attribution;
OM.bin = OM.binding;
OM.err = OM.error;
OM.simple = OM.simpleDecode;

// ## Creating valid identifiers
//
// Because OpenMath symbols and variables are restricted to have names that are
// valid OpenMath identifiers, not all strings can be used as variable or
// symbol names.  Sometimes, however, one wants to encode an arbitrary string
// as a symbol or variable.  Thus we create the following injection from the
// set of all strings into the set of valid OpenMath identifiers (together with
// its inverse, which goes in the other direction).
OM.encodeAsIdentifier = function( string ) {
    const charTo4Digits = index => ( '000' + string.charCodeAt( index ).toString( 16 ) ).slice(-4);
    let result = 'id_';
    for (let i = 0, end = string.length, asc = 0 <= end; asc ? i < end : i > end; asc ? i++ : i--) { result += charTo4Digits(i); }
    return result;
};
OM.decodeIdentifier = function( ident ) {
    let result = '';
    if (ident.slice(0, 3) !== 'id_') { return result; }
    ident = ident.slice(3);
    while (ident.length > 0) {
        result += String.fromCharCode(parseInt(ident.slice(0, 4), 16));
        ident = ident.slice(4);
    }
    return result;
};

// ## Ancillary utilities
//
// The functions defined in this section are experimental and incomplete.  They
// are untested, and are just simple implementations present here primarly for
// their value to our demo apps.  Complete and tested implementations may come
// later, if these functions become more important.
//
// ### Converting mathematical expressions to XML
//
// This is an incomplete implementation of the XML encoding for OpenMath trees.
// It is piecemeal, spotty, and only partially tested, and even those tests
// were done manually and/or within a demo application, not automated.
OM.prototype.toXML = function() {
    const indent = text => `  ${text.replace(RegExp( '\n', 'g' ), '\n  ')}`;
    switch (this.type) {
        case 'i': return `<OMI>${this.value}</OMI>`;
        case 'sy': return `<OMS cd=\"${this.cd}\" name=\"${this.name}\"/>`;
        case 'v': return `<OMV name=\"${this.name}\"/>`;
        case 'f': return `<OMF dec=\"${this.value}\"/>`;
        case 'st':
            var text = this.value.replace(/\&/g, '&amp;')
            .replace(/</g, '&lt;');
            return `<OMSTR>${text}</OMSTR>`;
        case 'a':
            var inside = ( this.children.map(c => indent(c.toXML())) ).join('\n');
            return `<OMA>\n${inside}\n</OMA>`;
        case 'bi':
            var head = indent(this.symbol.toXML());
            var vars = ( this.variables.map(v => v.toXML()) ).join('');
            vars = indent(`<OMBVAR>${vars}</OMBVAR>`);
            var body = indent(this.body.toXML());
            return `<OMBIND>\n${head}\n${vars}\n${body}\n</OMBIND>`;
        default:
            throw `Cannot convert this to XML: ${this.simpleEncode()}`;
    }
};

// ### Evaluating mathematical expressions numerically
//
// The following is a very limited routine that evaluates mathematical
// expressions numerically when possible, and returns an explanation of why it
// could not evaluate them in cases where it could not.  The result is an
// object with `value` and `message` attributes.
//
// The `value` attribute is intended to be the result, but may be undefined if
// an error takes place during evaluation (such as division by zero, or many
// other possible mathematical mistakes).  In such cases, the `message`
// attribute will explain what went wrong.  It may be a newline-separated list
// of problems.  Even when the `value` exists, the `message` attribute may be
// nonempty, containing warnings such as when using decimal approximations to
// real numbers.
OM.prototype.evaluate = function() {
    let arg, result;
    const call = ( func, ...indices ) => {
        let value;
        let message = undefined;
        const args = [ ];
        for (let index of indices) {
            arg = this.children[index].evaluate();
            if ((arg.value == null)) { return arg; }
            if (arg.message != null) {
                if ((message == null)) { message = ''; } else { message += '\n'; }
                message += arg.message;
            }
            args.push(arg.value);
        }
        try {
            value = func(...(args || []));
        } catch (e) {
            if ((message == null)) { message = ''; } else { message += '\n'; }
            message += e.message;
        }
        return {
            value,
            message
        };
    };
    switch (this.type) {
        case 'i': case 'f':
            result = {value : new Number(this.value)};
            break
        case 'st': case 'ba':
            result = {value : this.value};
            break
        case 'v':
            switch (this.name) {
                case '\u03c0': // pi
                    result =  {
                        value : Math.PI,
                        message : 'The actual value of \u03c0 has been rounded.'
                    };
                    break
                case 'e':
                    result =  {
                        value : Math.exp(1),
                        message : 'The actual value of e has been rounded.'
                    };
            }
            break
        case 'sy':
            switch (this.simpleEncode()) {
                case 'units.degrees':
                    result = {
                        value : Math.PI/180,
                        message : `Converting to degrees used an approximation of \u03c0.` // that is, pi
                    };
                    break
                case 'units.percent':
                    result = {value : 0.01};
                    break
                case 'units.dollars':
                    result = {
                        value : 1,
                        message : 'Dollar units were dropped'
                    };
            }
            break
        case 'a':
            switch (this.children[0].simpleEncode()) {
                case 'arith1.plus': result = call(( (a, b) => a + b), 1, 2); break
                case 'arith1.minus': result = call(( (a, b) => a - b), 1, 2); break
                case 'arith1.times': result = call(( (a, b) => a * b), 1, 2); break
                case 'arith1.divide': result = call(( (a, b) => a / b), 1, 2); break
                case 'arith1.power': result = call(Math.pow, 1, 2); break
                case 'arith1.root':
                    result = call(( (a, b) => Math.pow(b, 1/a)), 1, 2); break
                case 'arith1.abs': result = call(Math.abs, 1); break
                case 'arith1.unary_minus': result = call(( a => -a), 1); break
                case 'relation1.eq': result = call(( (a, b) => a === b), 1, 2); break
                case 'relation1.approx':
                    var tmp = call(( (a, b) => Math.abs( a - b ) < 0.01),
                        1, 2);
                    if (( tmp.message != null ? tmp.message : (tmp.message = '') ).length) { tmp.message += '\n'; }
                    tmp.message += `Values were rounded to two decimal places for approximate comparison.`;
                    result = tmp;
                    break
                case 'relation1.neq':
                    result = call(( (a, b) => a !== b), 1, 2); break
                case 'relation1.lt': result = call(( (a, b) => a < b), 1, 2); break
                case 'relation1.gt': result = call(( (a, b) => a > b), 1, 2); break
                case 'relation1.le': result = call(( (a, b) => a <= b), 1, 2); break
                case 'relation1.ge': result = call(( (a, b) => a >= b), 1, 2); break
                case 'logic1.not': result = call(( a => !a), 1); break
                case 'transc1.sin': result = call(Math.sin, 1); break
                case 'transc1.cos': result = call(Math.cos, 1); break
                case 'transc1.tan': result = call(Math.tan, 1); break
                case 'transc1.cot': result = call(( a => 1/Math.tan(a)), 1); break
                case 'transc1.sec': result = call(( a => 1/Math.cos(a)), 1); break
                case 'transc1.csc': result = call(( a => 1/Math.sin(a)), 1); break
                case 'transc1.arcsin': result = call(Math.asin, 1); break
                case 'transc1.arccos': result = call(Math.acos, 1); break
                case 'transc1.arctan': result = call(Math.atan, 1); break
                case 'transc1.arccot':
                    result = call(( a => Math.atan(1/a)), 1); break
                case 'transc1.arcsec':
                    result = call(( a => Math.acos(1/a)), 1); break
                case 'transc1.arccsc':
                    result = call(( a => Math.asin(1/a)), 1); break
                case 'transc1.ln': result = call(Math.log, 1); break
                case 'transc1.log':
                    result = call((base, arg) => Math.log( arg ) / Math.log( base ), 1, 2);
                    break
                case 'integer1.factorial':
                    result = call(function( a ) {
                        if (a <= 1) { return 1; }
                        if (a >= 20) { return Infinity; }
                        result = 1;
                        for (let i = 1, end = a|0, asc = 1 <= end; asc ? i <= end : i >= end; asc ? i++ : i--) { result *= i; }
                        return result;
                    }, 1);
                // Maybe later I will come back and implement these, but this
                // is just a demo app, so there is no need to get fancy.
                // when 'arith1.sum'
                // when 'calculus1.int'
                // when 'calculus1.defint'
                // when 'limit1.limit'
            }
    }
    if (result == null) { result = {value : undefined}; }
    if (typeof result.value === 'undefined') {
        result.message = `Could not evaluate ${this.simpleEncode()}`;
    }
    // console.log "#{node.simpleEncode()} --> #{JSON.stringify result}"
    return result;
};
