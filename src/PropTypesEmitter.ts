import * as ts from 'typescript';

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

// TODO: Refactor to pre-process and hoist prop types declarations for efficiency with circular references.
const maxDepth = 6;

export class PropTypesEmitter {
    private readonly _typeChecker: ts.TypeChecker;
    private readonly _importAliasName: string;
    private readonly _fileIgnorePatterns: RegExp[];

    private _depth = 0;

    constructor(typeChecker: ts.TypeChecker, importAliasName: string, fileIgnorePatterns: RegExp[]) {
        this._typeChecker = typeChecker;
        this._importAliasName = importAliasName;
        this._fileIgnorePatterns = fileIgnorePatterns;
    }

    get importAliasName() {
        return this._importAliasName;
    }

    emitForType(type: ts.Type, asShape = false): ts.Expression {
        try {
            this._depth++;

            if (this._depth > maxDepth) {
                return this.emitPrimitiveType(PropTypePrimitiveType.any);
            }

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

            const numericIndexInfo = this._typeChecker.getIndexInfoOfType(type, ts.IndexKind.Number);
            if (numericIndexInfo) {
                return this.emitAsArrayOf(this.emitForType(numericIndexInfo.type, true));
            }

            if (this.treatAsInterface(type)) {
                const interfaceType = this.emitInterface(type);
                if (asShape) {
                    return this.emitAsShape(interfaceType);
                }

                return interfaceType;
            }

            return this.emitPrimitiveType(PropTypePrimitiveType.any);
        } finally {
            this._depth--;
        }
    }

    private typeIsObjectType(type: ts.Type): type is ts.ObjectType {
        return (type.flags & ts.TypeFlags.Object) !== 0;
    }

    private treatAsInterface(
        type: ts.Type
    ): type is ts.ObjectType | ts.InterfaceTypeWithDeclaredMembers | ts.IntersectionType {
        return (type.isClassOrInterface() || type.isIntersection() || this.typeIsObjectType(type)) && !type.isClass();
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

    private emitInterface(type: ts.InterfaceTypeWithDeclaredMembers | ts.IntersectionType | ts.ObjectType) {
        const symbol = type.getSymbol();

        if (
            symbol &&
            symbol.declarations &&
            symbol.declarations.some((d) => this._fileIgnorePatterns.some((p) => p.test(d.getSourceFile().fileName)))
        ) {
            return ts.createObjectLiteral([]);
        }

        const properties = type.getApparentProperties();
        return ts.createObjectLiteral(
            properties.map((p) => {
                const member = this.emitInterfaceMember(p);

                return ts.createPropertyAssignment(
                    `'${p.escapedName.toString()}'`,
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
