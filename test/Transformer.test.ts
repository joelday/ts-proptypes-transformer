import * as ts from 'typescript';

const testFileName = 'test/TestComponent.tsx';

import { emitSource, emitAndLoad } from './TestCompiler';

describe('Transformer', () => {
    it('transforms TypeScript interfaces to PropTypes declarations on emitted code', () => {
        emitSource(testFileName, (emittedSource) => {
            expect(emittedSource).toMatchSnapshot();
        });
    });

    it('transforms TypeScript interfaces to PropTypes declarations on ES5 emitted code', () => {
        emitSource(
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
        const testModule = await emitAndLoad(testFileName);
        console.log(testModule);
    });
});
