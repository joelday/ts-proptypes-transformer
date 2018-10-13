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
}

interface IClassReactComponentInfo extends IReactComponentInfo {
    readonly kind: 'class';
    readonly type: ts.Type;
    readonly declaration: ts.ClassDeclaration;
}

interface IStatelessReactComponentInfo extends IReactComponentInfo {
    readonly kind: 'stateless';
    readonly declaration: ts.VariableDeclaration;
}

type ReactComponentInfo = IStatelessReactComponentInfo | IClassReactComponentInfo;

interface IContext {
    readonly statements: ts.Statement[];
    readonly components: ReactComponentInfo[];
    importAliasName?: string;
}

export function createTransformer(program: ts.Program): ts.TransformerFactory<ts.SourceFile> {
    const typeChecker = program.getTypeChecker();

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
        return null;
    }

    function getAncestryOfType(type: ts.InterfaceType) {
        const types: ts.BaseType[] = [];

        for (const baseType of typeChecker.getBaseTypes(type)) {
            types.push(baseType);
            types.push(...getAncestryOfType(baseType as ts.InterfaceType));
        }

        return types;
    }

    function getTypeIsReactComponentBaseClass(type: ts.InterfaceTypeWithDeclaredMembers) {
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
        const reactComponentClass = baseTypes.find(getTypeIsReactComponentBaseClass) as ts.GenericType;
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
            components: [],
        };

        ensurePropTypesImport(sourceFile, context);
        console.log('Import alias:', context.importAliasName);

        const componentInfos = getInfoForComponentsInScope(sourceFile);
        console.log('React components:', componentInfos.map((c) => c.name));

        return context.statements;
    }

    return (_) => {
        return (sourceFile: ts.SourceFile) => {
            const diagnostics = program.getSemanticDiagnostics();
            console.log(diagnostics);

            return ts.updateSourceFileNode(sourceFile, generateAndApplyPropTypes(sourceFile));
        };
    };
}
