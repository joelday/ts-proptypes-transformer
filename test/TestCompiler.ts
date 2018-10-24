import { createTransformer, ITransformOptions } from '../src/Transformer';
import * as ts from 'typescript';
import * as requireFromString from 'require-from-string';

export interface ITestProgramOptions {
    expectErrorFree?: boolean;
    compilerOptions?: ts.CompilerOptions;
    additionalFileNames?: string[];
}

export function compile(
    fileName: string,
    resultCallback: (emittedSource: string) => void,
    programOptions?: ITestProgramOptions,
    options?: ITransformOptions
) {
    const { expectErrorFree, compilerOptions, additionalFileNames } = {
        expectErrorFree: true,
        ...(programOptions || {}),
    } as ITestProgramOptions;

    const program = ts.createProgram([fileName, ...(additionalFileNames || [])], {
        jsx: ts.JsxEmit.Preserve,
        target: ts.ScriptTarget.ESNext,
        moduleResolution: ts.ModuleResolutionKind.NodeJs,
        ...(compilerOptions || {}),
    });

    const sourceFile = program.getSourceFile(fileName);

    const emitResult = program.emit(sourceFile, (_fileName, data) => resultCallback(data), null, null, {
        before: [createTransformer(program, options)],
    });

    if (expectErrorFree) {
        expect(emitResult.diagnostics).toHaveLength(0);
    }

    return emitResult;
}

export function compileAndLoadModule(fileName: string, additionalFileNames = [], options?: ITransformOptions) {
    return new Promise((resolve, reject) => {
        try {
            compile(
                fileName,
                (emittedSource) => {
                    setTimeout(() => {
                        resolve(requireFromString(emittedSource));
                    }, 1);
                },
                {
                    additionalFileNames,
                    compilerOptions: {
                        jsx: ts.JsxEmit.React,
                        target: ts.ScriptTarget.ES5,
                    },
                },
                options
            );
        } catch (e) {
            reject(e);
        }
    });
}
