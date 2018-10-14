import * as ts from 'typescript';
import { oneOf, bool } from 'prop-types';

// See: https://reactjs.org/docs/typechecking-with-proptypes.html

// at first, whatever we know is an any, followed by anything we fail to resolve at the end
// export const any: Requireable<any>;

// we can probably just skip this. The general logic should result in emitting a
// `___PropTypes.arrayOf(___PropTypes.any)`
// export const array: Requireable<any[]>;

// export const bool: Requireable<boolean>;

// should be anything 'callable', but only after we've resolved any classes, otherwise this would
// match against a class constructor (probably)
// export const func: Requireable<(...args: any[]) => any>;

// export const number: Requireable<number>;

// will only need this so long as we aren't able to emit instanceOf
// export const object: Requireable<object>;

// export const string: Requireable<string>;

// matching these only against their explicit types:

// unsure of the precedence for this, but odds are we'll have to evaluate this explicitly,
// but only against types that are assignable to ReactElementLike and ReactNodeArray
// export const node: Requireable<ReactNodeLike>;
// export const element: Requireable<ReactElementLike>;

// anything we resolve to ESSymbol. unsure if we should include ESSymbolLike.
// export const symbol: Requireable<symbol>;

// instanceOf is going to require a synthetic import of a given class:
// export function instanceOf<T>(expectedClass: new (...args: any[]) => T): Requireable<T>;

// literal primitives, including type unions of literal primitives
// export function oneOf<T>(types: T[]): Requireable<T>;

// type unions
// export function oneOfType<T extends Validator<any>>(types: T[]): Requireable<NonNullable<InferType<T>>>;

// we'll be emitting this by default for any array
// export function arrayOf<T>(type: Validator<T>): Requireable<T[]>;

// this is shorthand for an object where every prop is of a given type
// can do this for any non numeric indexer with no other props
// export function objectOf<T>(type: Validator<T>): Requireable<{ [K in keyof any]: T; }>;

// interfaces, including all inherited properties and merged intersections of interfaces
// export function shape<P extends ValidationMap<any>>(type: P): Requireable<InferProps<P>>;

// this isn't documented as far as I can find and I have no idea what it does.
// I *think* it's basically just shorthand for adding .isRequired to everything.
// going to skip this
// export function exact<P extends ValidationMap<any>>(type: P): Requireable<Required<InferProps<P>>>;

// TODO: most (if not all) of the remaining cases should be able to be handled by synthesizing custom validators.

export enum PropTypePrimitiveType {
    any,
    array,
    bool,
    func,
    number,
    object,
    string,
    node,
    element,
    symbol,
}

export class PropTypesEmitter {
    private readonly _typeChecker: ts.TypeChecker;
    private readonly _importAliasName: string;

    constructor(typeChecker: ts.TypeChecker, importAliasName: string) {
        this._typeChecker = typeChecker;
        this._importAliasName = importAliasName;
    }

    get importAliasName() {
        return this._importAliasName;
    }

    emitForType(type: ts.Type, asShape = false) {
        if (this.getTypeIsLiteral(type)) {
            return this.emitAsOneOf([type]);
        }

        const primitiveType = this.getPrimitiveTypeOfType(type);
        if (primitiveType) {
            return this.emitPrimitiveType(primitiveType);
        }

        // We check for unions after primitives because bool is also treated as a union of true and false.
        if (type.isUnion()) {
            return this.emitAsOneOfType(type);
        }

        if (type.isClassOrInterface() && !type.isClass()) {
            const interfaceType = this.emitInterface(type);
            if (asShape) {
                return this.emitAsShape(interfaceType);
            }

            return interfaceType;
        }

        // TODO: Check for unions
        // TODO: Check for intersections
        // TODO: Check for literals
        // TODO: Check for interfaces
        // TODO: Check for classes

        const numericIndexInfo = this._typeChecker.getIndexInfoOfType(type, ts.IndexKind.Number);
        if (numericIndexInfo) {
            return this.emitAsArrayOf(this.emitForType(numericIndexInfo.type, true));
        }

        return this.emitPrimitiveType(PropTypePrimitiveType.any);
    }

    private getPrimitiveTypeOfType(type: ts.Type) {
        if (type.getCallSignatures().length > 0) {
            return PropTypePrimitiveType.func;
        }

        if (type.flags & ts.TypeFlags.Any) {
            return PropTypePrimitiveType.any;
        }

        if (type.flags & ts.TypeFlags.Boolean) {
            return PropTypePrimitiveType.bool;
        }

        if (type.flags & ts.TypeFlags.Number) {
            return PropTypePrimitiveType.number;
        }

        if (type.flags & ts.TypeFlags.String) {
            return PropTypePrimitiveType.string;
        }

        if (type.flags & ts.TypeFlags.ESSymbol) {
            return PropTypePrimitiveType.symbol;
        }

        return null;
    }

    private emitInterface(type: ts.InterfaceTypeWithDeclaredMembers) {
        const properties = type.getApparentProperties();
        return ts.createObjectLiteral(
            properties.map((p) => {
                const member = this.emitInterfaceMember(p);

                return ts.createPropertyAssignment(
                    p.escapedName.toString(),
                    p.flags & ts.SymbolFlags.Optional ? member : this.emitAsRequired(member)
                );
            }),
            true
        );
    }

    private emitInterfaceMember(member: ts.Symbol) {
        const memberType = this._typeChecker.getTypeOfSymbolAtLocation(member, member.declarations[0]);
        return this.emitForType(memberType, true);
    }

    private getTypeIsLiteral(type: ts.Type): type is ts.LiteralType {
        return type.isLiteral() || (type.flags & ts.TypeFlags.BooleanLiteral) > 0;
    }

    private getValueOfLiteral(literal: ts.LiteralType) {
        if (literal.flags & ts.TypeFlags.BooleanLiteral) {
            return this._typeChecker.typeToString(literal) === 'true';
        }

        return literal.value;
    }

    private emitAsOneOf(literals: ts.LiteralType[]) {
        const functionReference = ts.createPropertyAccess(ts.createIdentifier(this._importAliasName), 'oneOf');
        const literalValues = literals.map((literal) => ts.createLiteral(this.getValueOfLiteral(literal)));

        return ts.createCall(functionReference, [], [ts.createArrayLiteral(literalValues, true)]);
    }

    private emitAsOneOfType(unionType: ts.UnionType) {
        if (unionType.types.every((t) => t.isLiteral())) {
            return this.emitAsOneOf(unionType.types as ts.LiteralType[]);
        }

        const functionReference = ts.createPropertyAccess(ts.createIdentifier(this._importAliasName), 'oneOfType');
        const emittedTypes = unionType.types.map((type) => this.emitForType(type, true));

        return ts.createCall(functionReference, [], [ts.createArrayLiteral(emittedTypes, true)]);
    }

    private emitAsShape(shapeLiteral: ts.ObjectLiteralExpression) {
        const functionReference = ts.createPropertyAccess(ts.createIdentifier(this._importAliasName), 'shape');
        return ts.createCall(functionReference, [], [shapeLiteral]);
    }

    private emitAsArrayOf(expression: ts.Expression) {
        const functionReference = ts.createPropertyAccess(ts.createIdentifier(this._importAliasName), 'arrayOf');
        return ts.createCall(functionReference, [], [expression]);
    }

    private emitAsRequired(expression: ts.Expression) {
        return ts.createPropertyAccess(expression, 'isRequired');
    }

    private emitPrimitiveType(primitiveType: PropTypePrimitiveType) {
        return ts.createPropertyAccess(
            ts.createIdentifier(this._importAliasName),
            PropTypePrimitiveType[primitiveType]
        );
    }
}
