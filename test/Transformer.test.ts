import * as ts from 'typescript';
import { createTransformer } from '../src/Transformer';

const testFileName = 'test/TestComponent.tsx';

describe('Transformer', () => {
    it('transforms TypeScript interfaces to PropTypes declarations on emitted code', () => {
        const program = ts.createProgram([testFileName], {
            jsx: ts.JsxEmit.Preserve,
            target: ts.ScriptTarget.ESNext,
            moduleResolution: ts.ModuleResolutionKind.NodeJs,
        });

        const sourceFile = program.getSourceFile(testFileName);

        const emitResult = program.emit(
            sourceFile,
            (_fileName, data) => {
                expect(data).toMatchSnapshot();
            },
            null,
            null,
            {
                before: [createTransformer(program)],
            }
        );

        expect(emitResult.diagnostics).toHaveLength(0);
    });
});
