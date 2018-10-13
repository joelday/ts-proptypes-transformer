import { createTransformer } from '../src/Transformer';
import * as ts from 'typescript';

export interface ITestProgramOptions {
    expectErrorFree?: boolean;
    compilerOptions?: ts.CompilerOptions;
    additionalFileNames?: string[];
}

export function createTestProgramAndEmit(
    testFileName: string,
    resultCallback: (emittedSource: string) => void,
    options?: ITestProgramOptions
) {
    const { expectErrorFree, compilerOptions, additionalFileNames } = {
        expectErrorFree: true,
        ...(options || {}),
    } as ITestProgramOptions;

    const program = ts.createProgram([testFileName, ...(additionalFileNames || [])], {
        jsx: ts.JsxEmit.Preserve,
        target: ts.ScriptTarget.ESNext,
        moduleResolution: ts.ModuleResolutionKind.NodeJs,
        ...(compilerOptions || {}),
    });

    const sourceFile = program.getSourceFile(testFileName);

    const emitResult = program.emit(sourceFile, (_fileName, data) => resultCallback(data), null, null, {
        before: [createTransformer(program)],
    });

    if (expectErrorFree) {
        expect(emitResult.diagnostics).toHaveLength(0);
    }

    return emitResult;
}
