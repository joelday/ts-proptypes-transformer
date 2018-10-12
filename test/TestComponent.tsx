import * as React from 'react';

export enum TestEnum {
    one,
    two,
    three
}

export interface IFirstName {
    firstName: string;
}

export interface ILastName {
    lastName: string;
}

export type FullName = IFirstName & ILastName;

export interface ITestComponentProps {
    numberProp: number;
    boolProp: boolean;
    arrayProp: number[];
    genericArrayProp: Array<number>;
    optionalProp?: boolean;
    /**
     * @prop commented prop
     */
    commentedProp: string;
    union: 'a' | 'b' | 'c';
    intersecton: IFirstName & ILastName,
    intersectonAlias: FullName,
    partialIntersectionAlias: Partial<FullName>,
    enum: TestEnum
}

export class TestComponent extends React.Component<ITestComponentProps> {

}

export interface IGenericPropsTestComponent<T, U = T> {
    propOfT: T;
    propOfU: U;
    propOfArrayOfT: T[];
    propOfTAndU: T & U;
    propOfArrayOfTAndU: (T & U)[];
}

export class GenericPropsTestComponent<T> extends React.Component<IGenericPropsTestComponent<T>> {

}

export class GenericPropsTestComponent2<T, U> extends React.Component<IGenericPropsTestComponent<T, U>> {

}

export class GenericPropsTestComponent3 extends React.Component<IGenericPropsTestComponent<IFirstName>> {

}

export class GenericPropsTestComponent4 extends React.Component<IGenericPropsTestComponent<IFirstName, ILastName>> {

}

export class GenericPropsTestComponent5<U> extends React.Component<IGenericPropsTestComponent<IFirstName, U>> {

}