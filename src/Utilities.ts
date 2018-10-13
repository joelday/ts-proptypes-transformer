import * as ts from 'typescript';

// export function nodeIsOfKind(node: ts.Node, ...kinds: ts.SyntaxKind[]) {
//     return node && kinds.includes(node.kind);
// }

// export function findChildrenOfKind(node: ts.Node, ...kinds: ts.SyntaxKind[]) {
//     const children: ts.Node[] = [];

//     node.getChildren().forEach(c => {
//         if (nodeIsOfKind(c, ...kinds)) {
//             children.push(c);
//         }

//         children.push(...findChildrenOfKind(c, ...kinds));
//     });

//     return children;
// }

export type NodeTypeTest<T extends ts.Node> = (n: ts.Node) => n is T;

export function nodeIs<TTests extends NodeTypeTest<T>[], T extends ts.Node>(n: T, ...tests: TTests): n is T {
    return tests.every(test => test(n));
}

export function createNodeIs<TTests extends NodeTypeTest<T>[], T extends ts.Node>(...tests: TTests) {
    return function createdNodeIs(n: T): n is T { return nodeIs(n, ...tests) };
}

// filter<S extends T>(callbackfn: (value: T, index: number, array: T[]) => value is S, thisArg?: any): S[];

export function *iterateTree(node: ts.Node): IterableIterator<ts.Node> {
    for (const child of node.getChildren()) {
        yield child;
        for (const subChild of iterateTree(child)) {
            yield subChild;
        }
    }
}

export function iterateTreeWhere<S extends ts.Node>(node: ts.Node, test: (n: ts.Node) => n is S): IterableIterator<S>;
export function *iterateTreeWhere(node: ts.Node, test: (n: ts.Node) => boolean): IterableIterator<ts.Node>
{
    for (const child of iterateTree(node)) {
        if (test(child)) {
            yield child;
        }
    }
}