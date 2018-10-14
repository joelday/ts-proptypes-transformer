import * as ts from 'typescript';
import { ITestComponentProps, TestEnum } from './TestInterfaces';

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

    it('produces PropTypes declarations that properly validate correctly formed props', async () => {
        const testModule = (await compileAndLoadModule(testFileName)) as typeof import('./TestComponent');

        expectComponentPropTypesError<ITestComponentProps>(testModule.TestComponent, {
            // TODO:
            arrayProp: [],
            numberProp: 1,
            boolProp: true,
            boolLiteralProp: false,
            commentedProp: '',
            enum: TestEnum.one,
            // TODO:
            genericArrayProp: [],
            id: 1,
            interfaceValue: { firstName: 'firstName' },
            intersecton: { firstName: 'firstName', lastName: 'lastName' },
            // TODO:
            intersectonAlias: { firstName: 'firstName', lastName: 'lastName' },
            // TODO:
            partialIntersectionAlias: { lastName: 'lastName' },
            // TODO:
            union: 'a',
            numberLiteralProp: 1,
            stringLiteralProp: 'hi',
            complexUnion: 'a',
        }).toHaveLength(0);
    });

    it('produces PropTypes declarations that properly validate incorrectly formed props', async () => {
        const testModule = (await compileAndLoadModule(testFileName)) as typeof import('./TestComponent');

        expectComponentPropTypesError<ITestComponentProps>(testModule.TestComponent, {
            arrayProp: 1 as any,
            numberProp: 'a' as any,
            boolProp: 'a' as any,
            boolLiteralProp: true as any,
            commentedProp: undefined,
            enum: 'a' as any,
            genericArrayProp: 'a' as any,
            id: 'a' as any,
            interfaceValue: { firstName: 0 as any },
            intersecton: {} as any,
            intersectonAlias: { firstName: 'firstName' } as any,
            partialIntersectionAlias: { whoKnows: 'lastName' } as any,
            union: 'd' as any,
            numberLiteralProp: 'hi' as any,
            stringLiteralProp: 1 as any,
            complexUnion: 'jibberish' as any,
        }).not.toHaveLength(0); // toHaveLength(15);
    });
});
