import { CSSProperties } from 'react';

export enum TestEnum {
    one,
    two,
    three,
}

export interface IFirstName {
    firstName: string;
}

export interface ILastName {
    lastName: string;
}

export type FullName = IFirstName & ILastName;

export type FirstOrLastName = IFirstName | ILastName;

export interface IBaseInterface {
    id: number;
}

export interface ICallable {
    (): boolean;
}

export interface INewable {
    new (): IFirstName;
}

export interface ITestComponentProps extends IBaseInterface {
    numberProp: number;
    stringLiteralProp: 'hi';
    numberLiteralProp: 1;
    boolLiteralProp: false;
    boolProp: boolean;
    arrayProp: number[];
    genericArrayProp: Array<number>;
    optionalProp?: boolean;
    /**
     * @prop commented prop
     */
    commentedProp: string;
    union: 'a' | 'b' | 'c';
    unionAlias: FirstOrLastName;
    arrayOfUnion: ITestComponentProps['complexUnion'][];
    complexUnion: 5 | '6' | true | ITestComponentProps['union'] | IFirstName | Partial<FullName>;
    interfaceValue: IFirstName;
    intersecton: IFirstName & ILastName;
    intersectonAlias: FullName;
    partialIntersectionAlias: Partial<FullName>;
    enum: TestEnum;
    optionalSelfReferencing?: ITestComponentProps;
    css?: CSSProperties;
    dom?: CSSStyleDeclaration;
    callable: ICallable;
    newable: INewable;
    typeOf: typeof String;
}

export interface IGenericPropsTestComponentProps<T, U = T> {
    propOfT: T;
    propOfU: U;
    propOfArrayOfT: T[];
    propOfTAndU: T & U;
    propOfArrayOfTAndU: (T & U)[];
}
