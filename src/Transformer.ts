import * as ts from 'typescript';
import { PropTypesEmitter } from './PropTypesEmitter';

// TODO: See if ts has already normalized file paths.

export interface ITransformOptions {
    requireGeneratorComment?: boolean;
}

const generatorComment = 'ts-proptypes-transformer:generate';

const generatedImportAliasName = '_pt_';
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

export function createTransformer(
    program: ts.Program,
    options: ITransformOptions = {}
): ts.TransformerFactory<ts.SourceFile> {
    const typeChecker = program.getTypeChecker();

    // TODO: Make ignore patterns configurable.
    function createPropTypesForType(type: ts.Type, importAliasName: string) {
        const emitter = new PropTypesEmitter(typeChecker, importAliasName, [
            /lib\.dom\.d\.ts/,
            /csstype/,
            /@types\/react/,
        ]);
        const emitted = emitter.emitForType(type);
        if (emitted.kind !== ts.SyntaxKind.ObjectLiteralExpression) {
            return null;
        }

        return emitted;
    }

    function addPropTypesDeclarationToClass(componentInfo: IClassReactComponentInfo, context: IContext) {
        const props = createPropTypesForType(componentInfo.propTypes, context.importAliasName);
        if (!props) {
            return;
        }

        const propTypesDeclaration = ts.createProperty(
            undefined,
            ts.createModifiersFromModifierFlags(ts.ModifierFlags.Static),
            propTypesStaticPropertyName,
            undefined,
            undefined,
            props
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
        const props = createPropTypesForType(componentInfo.propTypes, context.importAliasName);
        if (!props) {
            return;
        }

        const needsExplicitExport =
            componentInfo.declaration.parent.parent.modifiers &&
            componentInfo.declaration.parent.parent.modifiers.some((m) => m.kind === ts.SyntaxKind.ExportKeyword) &&
            (program.getCompilerOptions().target < ts.ScriptTarget.ES2015 ||
                program.getCompilerOptions().module === ts.ModuleKind.CommonJS);

        const componentDeclarationExpression = needsExplicitExport
            ? ts.createPropertyAccess(ts.createIdentifier('exports'), componentInfo.name)
            : ts.createIdentifier(componentInfo.name);

        const propTypesAssignment = ts.createExpressionStatement(
            ts.createBinary(
                ts.createPropertyAccess(componentDeclarationExpression, propTypesStaticPropertyName),
                ts.SyntaxKind.EqualsToken,
                props
            )
        );

        const declarationIndex = context.statements.indexOf(componentInfo.declaration.parent.parent);
        context.statements.splice(declarationIndex + 1, 0, propTypesAssignment);
    }

    function addPropTypesImport(context: IContext) {
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
        if (!type || !type.getSymbol() || type.getSymbol().name !== 'StatelessComponent') {
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
        // TODO: Actually check for if this is a React.SFC, React.Component or React.PureComponent.
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

        if (options.requireGeneratorComment) {
            const declaration = symbol.declarations[0];
            const leadingText = declaration.getFullText().slice(0, declaration.getLeadingTriviaWidth());

            // TODO: Cleanup, generic contiguous comment line parsing.

            // We only want this directive when written at the beginning of the comment text on a given line within
            // a contiguous block of comment lines written directly above the declaration.
            const rawCommentLines = leadingText.split('\n');

            const commentLines = rawCommentLines
                .slice(0, rawCommentLines.length - 1)
                .map((line) => line.replace(/(\/\*\*?|\/\/)/g, ''))
                .map((line) => line.trim());

            let foundComment = false;
            let hasSeenNonBlank = false;
            for (const line of commentLines) {
                if (line === '') {
                    if (hasSeenNonBlank) {
                        return null;
                    }
                } else {
                    hasSeenNonBlank = true;
                }

                if (line.startsWith(generatorComment)) {
                    foundComment = true;
                }
            }

            if (!foundComment) {
                return null;
            }
        }

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

        // Currently assumes that everything is top-level within the source file.
        // Wouldn't be incredibly difficult to support class expressions, etc.
        // Need a special leading comment annotation to opt-in to it, though.

        const componentInfos = getInfoForComponentsInScope(sourceFile);
        if (componentInfos.length === 0) {
            return context.statements;
        }

        addPropTypesImport(context);

        for (const componentInfo of componentInfos) {
            if (componentInfo.kind === 'class') {
                addPropTypesDeclarationToClass(componentInfo, context);
            } else {
                addPropTypesDeclarationToStateless(componentInfo, context);
            }
        }

        return context.statements;
    }

    return (_context) => {
        return (sourceFile: ts.SourceFile) => {
            return ts.updateSourceFileNode(sourceFile, generateAndApplyPropTypes(sourceFile));
        };
    };
}
