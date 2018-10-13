import * as React from 'react';

// import * as ptypes from 'prop-types';
import { Validator } from 'prop-types';

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

export interface IBaseInterface {
    id: number;
}

export interface ITestComponentProps extends IBaseInterface {
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
    interfaceValue: IFirstName;
    intersecton: IFirstName & ILastName;
    intersectonAlias: FullName;
    partialIntersectionAlias: Partial<FullName>;
    enum: TestEnum;
}

export class TestComponent extends React.Component<ITestComponentProps> {}

export class AlreadyHasAStaticPropTypes extends React.Component<ITestComponentProps> {
    static propTypes = {};
}

export interface IGenericPropsTestComponent<T, U = T> {
    propOfT: T;
    propOfU: U;
    propOfArrayOfT: T[];
    propOfTAndU: T & U;
    propOfArrayOfTAndU: (T & U)[];
}

export class NotAComponentClass {}

export class GenericPropsTestComponent<T> extends React.Component<IGenericPropsTestComponent<T>> {}

export class GenericPropsTestComponent2<T, U> extends React.Component<IGenericPropsTestComponent<T, U>> {}

export class GenericPropsTestComponent3 extends React.Component<IGenericPropsTestComponent<IFirstName>> {}

export class GenericPropsTestComponent4 extends React.Component<IGenericPropsTestComponent<IFirstName, ILastName>> {}

export class GenericPropsTestComponent5<U> extends React.Component<IGenericPropsTestComponent<IFirstName, U>> {}

export class GenericPropsTestComponent6<U> extends GenericPropsTestComponent5<U> {}

export class AnyPropsComponent extends React.Component {}

export const StatelessFunctionalTestComponent: React.SFC<ITestComponentProps> = (p) => {
    return <AnyPropsComponent {...p} />;
};

export const InferrableStatelessFunctionalTestComponent = (p: ITestComponentProps) => {
    return <StatelessFunctionalTestComponent {...p} />;
};

export function DeclaredFunctionTestComponent(p: ITestComponentProps) {
    return <StatelessFunctionalTestComponent {...p} />;
}
