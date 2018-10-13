import * as ts from 'typescript';

// TODO: See if ts has already normalized file paths.

const generatedImportAliasName = '___PropTypes';
const propTypesPackageName = 'prop-types';
const reactPackageName = 'react';
const propTypesStaticPropertyName = 'propTypes';

type ReactComponentKind = 'class' | 'stateless';

interface IReactComponentInfo {
    readonly kind: ReactComponentKind;
    readonly name: string;
    readonly declaration: ts.VariableDeclaration | ts.ClassDeclaration;
    readonly symbol: ts.Symbol;
    readonly propTypes: ts.Type;
    readonly type: ts.Type;
}

interface IClassReactComponentInfo extends IReactComponentInfo {
    readonly kind: 'class';
    readonly declaration: ts.ClassDeclaration;
}

interface IStatelessReactComponentInfo extends IReactComponentInfo {
    readonly kind: 'stateless';
    readonly declaration: ts.VariableDeclaration;
}

type ReactComponentInfo = IStatelessReactComponentInfo | IClassReactComponentInfo;

interface IContext {
    readonly statements: ts.Statement[];
    importAliasName?: string;
}

export function createTransformer(program: ts.Program): ts.TransformerFactory<ts.SourceFile> {
    const typeChecker = program.getTypeChecker();

    function createPropTypesForType(type: ts.Type) {
        return ts.createObjectLiteral([], true);
    }

    function addPropTypesDeclarationToClass(componentInfo: IClassReactComponentInfo, context: IContext) {
        const propTypesDeclaration = ts.createProperty(
            undefined,
            ts.createModifiersFromModifierFlags(ts.ModifierFlags.Static),
            propTypesStaticPropertyName,
            undefined,
            undefined,
            createPropTypesForType(componentInfo.propTypes)
        );

        const updatedDeclaration = ts.updateClassDeclaration(
            componentInfo.declaration,
            componentInfo.declaration.decorators,
            componentInfo.declaration.modifiers,
            componentInfo.declaration.name,
            componentInfo.declaration.typeParameters,
            componentInfo.declaration.heritageClauses,
            [propTypesDeclaration, ...componentInfo.declaration.members]
        );

        const existingDeclarationIndex = context.statements.indexOf(componentInfo.declaration);
        context.statements.splice(existingDeclarationIndex, 1, updatedDeclaration);
    }

    function addPropTypesDeclarationToStateless(componentInfo: IStatelessReactComponentInfo, context: IContext) {
        const propTypesAssignment = ts.createExpressionStatement(
            ts.createBinary(
                ts.createPropertyAccess(ts.createIdentifier(componentInfo.name), propTypesStaticPropertyName),
                ts.SyntaxKind.EqualsToken,
                createPropTypesForType(componentInfo.propTypes)
            )
        );

        const declarationIndex = context.statements.indexOf(componentInfo.declaration.parent.parent);
        context.statements.splice(declarationIndex + 1, 0, propTypesAssignment);
    }

    function findExistingPropTypesImportAliasName(node: ts.Node) {
        const aliasSymbols = typeChecker.getSymbolsInScope(node, ts.SymbolFlags.Alias);
        const propTypesAlias = aliasSymbols.find((s) => {
            const aliased = typeChecker.getAliasedSymbol(s);
            if (!aliased.valueDeclaration) {
                return false;
            }

            return aliased.valueDeclaration.getSourceFile().fileName.endsWith(`${propTypesPackageName}/index.d.ts`);
        });

        if (propTypesAlias) {
            return propTypesAlias.getEscapedName().toString();
        }
    }

    function ensurePropTypesImport(sourceFile: ts.SourceFile, context: IContext) {
        context.importAliasName = findExistingPropTypesImportAliasName(sourceFile);
        if (context.importAliasName) {
            return;
        }

        context.statements.unshift(
            ts.createImportDeclaration(
                [],
                [],
                ts.createImportClause(
                    undefined,
                    ts.createNamespaceImport(ts.createIdentifier(generatedImportAliasName))
                ),
                ts.createStringLiteral(propTypesPackageName)
            )
        );

        context.importAliasName = generatedImportAliasName;
    }

    function filterToSymbolsDeclaredWithinNode(node: ts.Node, symbols: ts.Symbol[]) {
        return symbols.filter((symbol) =>
            symbol.getDeclarations().some((declaration) => declaration.getSourceFile() === node.getSourceFile())
        );
    }

    function getPossibleComponentSymbolsInScope(node: ts.Node) {
        const symbols = typeChecker.getSymbolsInScope(node, ts.SymbolFlags.Class | ts.SymbolFlags.Variable);

        return filterToSymbolsDeclaredWithinNode(node, symbols);
    }

    function getStatelessComponentInfo(symbol: ts.Symbol): IStatelessReactComponentInfo {
        // TODO: Check for existing propTypes assignment.
        const declaration = symbol.declarations[0] as ts.VariableDeclaration;
        const type = typeChecker.getTypeOfSymbolAtLocation(symbol, declaration) as ts.GenericType;

        // TODO: More robust check:
        if (!type || type.getSymbol().escapedName !== 'StatelessComponent') {
            return null;
        }

        return {
            name: symbol.getName(),
            kind: 'stateless',
            symbol,
            declaration,
            type,
            propTypes: type.typeArguments[0],
        };
    }

    function getAncestryOfType(type: ts.InterfaceType) {
        const types: ts.BaseType[] = [];

        for (const baseType of typeChecker.getBaseTypes(type)) {
            types.push(baseType);
            types.push(...getAncestryOfType(baseType as ts.InterfaceType));
        }

        return types;
    }

    function getTypeIsReactComponentType(type: ts.InterfaceTypeWithDeclaredMembers) {
        // TODO: Actually check for if this is React.SFC or React.Component
        const declaration = type.getSymbol().declarations[0];
        return declaration.getSourceFile().fileName.endsWith(`${reactPackageName}/index.d.ts`);
    }

    function getClassComponentInfo(symbol: ts.Symbol): IClassReactComponentInfo {
        const declaration = symbol.declarations[0] as ts.ClassDeclaration;
        const type = typeChecker.getTypeOfSymbolAtLocation(symbol, declaration) as ts.InterfaceType;

        if (
            typeChecker
                .getPropertiesOfType(type)
                .find((property) => property.escapedName === propTypesStaticPropertyName)
        ) {
            return;
        }

        const baseTypes = getAncestryOfType(type);

        // We find React.Component on a per component class basis because the type arguments are resolved contextually.
        const reactComponentClass = baseTypes.find(getTypeIsReactComponentType) as ts.GenericType;
        if (!reactComponentClass) {
            return null;
        }

        const propTypes = reactComponentClass.typeArguments[0];

        return {
            name: symbol.getName(),
            kind: 'class',
            symbol,
            declaration,
            type,
            propTypes,
        };
    }

    function getComponentInfoForSymbol(symbol: ts.Symbol): ReactComponentInfo {
        const componentSymbol =
            symbol.flags & ts.SymbolFlags.ExportValue ? typeChecker.getExportSymbolOfSymbol(symbol) : symbol;

        if (componentSymbol.flags & ts.SymbolFlags.Variable) {
            return getStatelessComponentInfo(componentSymbol);
        }

        if (componentSymbol.flags & ts.SymbolFlags.Class) {
            return getClassComponentInfo(componentSymbol);
        }

        return null;
    }

    function getInfoForComponentsInScope(node: ts.Node) {
        return getPossibleComponentSymbolsInScope(node)
            .map(getComponentInfoForSymbol)
            .filter((c) => !!c);
    }

    function generateAndApplyPropTypes(sourceFile: ts.SourceFile) {
        const context: IContext = {
            statements: [...sourceFile.statements],
        };

        ensurePropTypesImport(sourceFile, context);
        console.log('Import alias:', context.importAliasName);

        // Currently assumes that everything is top-level within the source file.
        // Wouldn't be incredibly difficult to support class expressions, etc.
        // Need a special leading comment annotation to opt-in to it, though.

        const componentInfos = getInfoForComponentsInScope(sourceFile);
        console.log('React components:\r\n', componentInfos.map((c) => c.name));

        for (const componentInfo of componentInfos) {
            if (componentInfo.kind === 'class') {
                addPropTypesDeclarationToClass(componentInfo, context);
            } else {
                addPropTypesDeclarationToStateless(componentInfo, context);
            }
        }

        return context.statements;
    }

    return (_) => {
        return (sourceFile: ts.SourceFile) => {
            const diagnostics = program.getSemanticDiagnostics();
            console.log('Diagnostics:\r\n', diagnostics.map((d) => d.messageText));

            return ts.updateSourceFileNode(sourceFile, generateAndApplyPropTypes(sourceFile));
        };
    };
}
