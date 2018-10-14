import { Node, NodeFlags, Symbol, SymbolFlags } from 'typescript';

export function flagsToString(flagsEnumType: { [key: number]: string }, flags: number) {
    const flagNames: string[] = [];

    for (let i = 1; flagsEnumType[Math.pow(2, i)] !== undefined; i++) {
        if (Math.pow(2, i) & flags) {
            flagNames.push(flagsEnumType[Math.pow(2, i)]);
        }
    }

    if (flagNames.length === 0) {
        return 'None';
    }

    return flagNames.join(' | ');
}

export function enumToString(flagsEnumType: { [key: number]: string }, value: number) {
    return flagsEnumType[value];
}

export function getNodeFlagsAsString(node: Node) {
    return flagsToString(NodeFlags, node.flags);
}

export function getSymbolFlagsAsString(symbol: Symbol) {
    return flagsToString(SymbolFlags, symbol.flags);
}
