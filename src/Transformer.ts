import * as ts from 'typescript';

export function createTransformer(): ts.TransformerFactory<ts.SourceFile> {
    return (_context) => {
        return (sourceFile: ts.SourceFile) => sourceFile;
    };
}