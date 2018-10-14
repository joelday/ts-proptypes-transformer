import { createTransformer } from '../src/Transformer';
import * as ts from 'typescript';
import * as requireFromString from 'require-from-string';

export interface ITestProgramOptions {
    expectErrorFree?: boolean;
    compilerOptions?: ts.CompilerOptions;
    additionalFileNames?: string[];
}

export function emitSource(
    fileName: string,
    resultCallback: (emittedSource: string) => void,
    options?: ITestProgramOptions
) {
    const { expectErrorFree, compilerOptions, additionalFileNames } = {
        expectErrorFree: true,
        ...(options || {}),
    } as ITestProgramOptions;

    const program = ts.createProgram([fileName, ...(additionalFileNames || [])], {
        jsx: ts.JsxEmit.Preserve,
        target: ts.ScriptTarget.ESNext,
        moduleResolution: ts.ModuleResolutionKind.NodeJs,
        ...(compilerOptions || {}),
    });

    const sourceFile = program.getSourceFile(fileName);

    const emitResult = program.emit(sourceFile, (_fileName, data) => resultCallback(data), null, null, {
        before: [createTransformer(program)],
    });

    if (expectErrorFree) {
        expect(emitResult.diagnostics).toHaveLength(0);
    }

    return emitResult;
}

export function emitAndLoad(fileName: string, additionalFileNames = []) {
    return new Promise<any>((resolve, reject) => {
        try {
            emitSource(
                fileName,
                (emittedSource) => {
                    resolve(requireFromString(emittedSource));
                },
                {
                    additionalFileNames,
                    compilerOptions: {
                        jsx: ts.JsxEmit.React,
                        target: ts.ScriptTarget.ES5,
                    },
                }
            );
        } catch (e) {
            reject(e);
        }
    });
}
