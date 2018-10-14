import * as React from 'react';
import { ITestComponentProps, IGenericPropsTestComponentProps, IFirstName, ILastName } from './TestInterfaces';

// TODO: Add test for this scenario where an import of prop-types already exists
// import * as ptypes from 'prop-types';
import { Validator } from 'prop-types';

export class TestComponent extends React.Component<ITestComponentProps> {}

export class AlreadyHasAStaticPropTypes extends React.Component<ITestComponentProps> {
    static propTypes = {};
}

export class NotAComponentClass {}

export class GenericPropsTestComponent<T> extends React.Component<IGenericPropsTestComponentProps<T>> {}

export class GenericPropsTestComponent2<T, U> extends React.Component<IGenericPropsTestComponentProps<T, U>> {}

export class GenericPropsTestComponent3 extends React.Component<IGenericPropsTestComponentProps<IFirstName>> {}

export class GenericPropsTestComponent4 extends React.Component<
    IGenericPropsTestComponentProps<IFirstName, ILastName>
> {}

export class GenericPropsTestComponent5<U> extends React.Component<IGenericPropsTestComponentProps<IFirstName, U>> {}

export class GenericPropsTestComponent6<U> extends GenericPropsTestComponent5<U> {}

// BUG: U is not being combined here:
export class GenericPropsTestComponent7 extends GenericPropsTestComponent6<{ foo: 'bar' }> {}

export class AnyPropsComponent extends React.Component {}

export const StatelessFunctionalTestComponent: React.SFC<ITestComponentProps> = (p) => {
    return <AnyPropsComponent {...p} />;
};

const NonExportedStatelessFunctionalTestComponent: React.SFC<ITestComponentProps> = (p) => {
    return <AnyPropsComponent {...p} />;
};

export const InferrableStatelessFunctionalTestComponent = (p: ITestComponentProps) => {
    return <StatelessFunctionalTestComponent {...p} />;
};

export function DeclaredFunctionTestComponent(p: ITestComponentProps) {
    return <StatelessFunctionalTestComponent {...p} />;
}
