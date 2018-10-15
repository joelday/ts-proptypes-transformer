import * as ts from 'typescript';
import { ITestComponentProps, TestEnum, IFirstName } from './TestInterfaces';

const testFileName = 'test/TestComponent.tsx';

import { compile, compileAndLoadModule } from './TestCompiler';
import { expectComponentPropTypesError } from './ExpectProps';

describe('Transformer', () => {
    it('transforms TypeScript interfaces to PropTypes declarations on emitted code', () => {
        compile(testFileName, (emittedSource) => {
            expect(emittedSource).toMatchSnapshot();
        });
    });

    it('transforms TypeScript interfaces to PropTypes declarations on ES5 emitted code', () => {
        compile(
            testFileName,
            (emittedSource) => {
                expect(emittedSource).toMatchSnapshot();
            },
            {
                compilerOptions: {
                    target: ts.ScriptTarget.ES5,
                    jsx: ts.JsxEmit.React,
                },
            }
        );
    });

    it('transforms TypeScript interfaces to PropTypes declarations on CommonJS emitted code', () => {
        compile(
            testFileName,
            (emittedSource) => {
                expect(emittedSource).toMatchSnapshot();
            },
            {
                compilerOptions: {
                    module: ts.ModuleKind.CommonJS,
                    jsx: ts.JsxEmit.React,
                },
            }
        );
    });

    it('produces PropTypes declarations that properly validate correctly formed props', async () => {
        const testModule = (await compileAndLoadModule(testFileName)) as typeof import('./TestComponent');

        expectComponentPropTypesError<ITestComponentProps>(testModule.TestComponent, {
            arrayOfUnion: ['a', true],
            arrayProp: [],
            boolLiteralProp: false,
            boolProp: true,
            commentedProp: '',
            complexUnion: 'a',
            enum: TestEnum.one,
            genericArrayProp: [],
            id: 1,
            interfaceValue: { firstName: 'firstName' },
            intersecton: { firstName: 'firstName', lastName: 'lastName' },
            intersectonAlias: { firstName: 'firstName', lastName: 'lastName' },
            numberLiteralProp: 1,
            numberProp: 1,
            partialIntersectionAlias: {},
            stringLiteralProp: 'hi',
            union: 'a',
            unionAlias: { firstName: 'firstName' },
            callable: () => true,
            newable: class Blah implements IFirstName {
                firstName: string;
            },
            typeOf: String,
        }).toHaveLength(0);
    });

    it('produces PropTypes declarations that properly validate incorrectly formed props', async () => {
        const testModule = (await compileAndLoadModule(testFileName)) as typeof import('./TestComponent');

        expectComponentPropTypesError<ITestComponentProps>(testModule.TestComponent, {
            arrayOfUnion: ['a', false] as any,
            arrayProp: 1 as any,
            boolLiteralProp: true as any,
            boolProp: 'a' as any,
            commentedProp: undefined,
            complexUnion: 'jibberish' as any,
            enum: 'a' as any,
            genericArrayProp: 'a' as any,
            id: 'a' as any,
            interfaceValue: { firstName: 0 as any },
            intersecton: {} as any,
            intersectonAlias: { firstName: 'firstName' } as any,
            numberLiteralProp: 'hi' as any,
            numberProp: 'a' as any,
            partialIntersectionAlias: 2 as any,
            stringLiteralProp: 1 as any,
            union: 'd' as any,
            unionAlias: { whoKnows: 'lastName' } as any,
            callable: {} as any,
            newable: 'wooh' as any,
            typeOf: 2 as any,
        }).toHaveLength(21);
    });
});
