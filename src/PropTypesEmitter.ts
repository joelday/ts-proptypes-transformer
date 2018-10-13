import * as ts from 'typescript';

// export const any: Requireable<any>;
// export const array: Requireable<any[]>;
// export const bool: Requireable<boolean>;
// export const func: Requireable<(...args: any[]) => any>;
// export const number: Requireable<number>;
// export const object: Requireable<object>;
// export const string: Requireable<string>;
// export const node: Requireable<ReactNodeLike>;
// export const element: Requireable<ReactElementLike>;
// export const symbol: Requireable<symbol>;

// export function instanceOf<T>(expectedClass: new (...args: any[]) => T): Requireable<T>;
// export function oneOf<T>(types: T[]): Requireable<T>;
// export function oneOfType<T extends Validator<any>>(types: T[]): Requireable<NonNullable<InferType<T>>>;
// export function arrayOf<T>(type: Validator<T>): Requireable<T[]>;
// export function objectOf<T>(type: Validator<T>): Requireable<{ [K in keyof any]: T; }>;
// export function shape<P extends ValidationMap<any>>(type: P): Requireable<InferProps<P>>;
// export function exact<P extends ValidationMap<any>>(type: P): Requireable<Required<InferProps<P>>>;

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
        if (type.isClassOrInterface() && !type.isClass()) {
            const interfaceType = this.emitInterface(type);
            if (asShape) {
                return this.asShape(interfaceType);
            }

            return interfaceType;
        }

        // TODO: Check for unions/intersections
        // TODO: Check for literals
        // TODO: Check for interfaces
        // TODO: Check for classes

        const primitiveType = this.getPrimitiveTypeOfType(type);
        return this.emitPrimitiveType(primitiveType);
    }

    private getPrimitiveTypeOfType(type: ts.Type) {
        if (type.flags & ts.TypeFlags.Literal) {
            return PropTypePrimitiveType.any;
        }

        const numericIndexType = this._typeChecker.getIndexTypeOfType(type, ts.IndexKind.Number);
        if (numericIndexType) {
            return PropTypePrimitiveType.array;
        }

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

        return PropTypePrimitiveType.any;
    }

    private emitInterface(type: ts.InterfaceTypeWithDeclaredMembers) {
        const properties = type.getApparentProperties();
        return ts.createObjectLiteral(
            properties.map((p) => ts.createPropertyAssignment(p.escapedName.toString(), this.emitInterfaceMember(p))),
            true
        );
    }

    private emitInterfaceMember(member: ts.Symbol) {
        const memberType = this._typeChecker.getTypeOfSymbolAtLocation(member, member.declarations[0]);
        return this.emitForType(memberType, true);
        // const isRequired = !this._typeChecker.isProperty(member.declarations[0] as ts.P)
    }

    private asShape(shapeLiteral: ts.ObjectLiteralExpression) {
        const functionReference = ts.createPropertyAccess(ts.createIdentifier(this._importAliasName), 'shape');
        return ts.createCall(functionReference, [], [shapeLiteral]);
    }

    private asRequired(expression: ts.Expression) {
        return ts.createPropertyAccess(expression, 'isRequired');
    }

    private emitPrimitiveType(primitiveType: PropTypePrimitiveType) {
        return ts.createPropertyAccess(
            ts.createIdentifier(this._importAliasName),
            PropTypePrimitiveType[primitiveType]
        );
    }
}
