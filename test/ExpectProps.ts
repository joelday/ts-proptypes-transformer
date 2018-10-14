import * as PropTypes from 'prop-types';
import * as React from 'react';
import * as obnoxiousGarbage from 'prop-types/lib/ReactPropTypesSecret';

declare module 'prop-types' {
    export interface Validator<T> {
        (
            props: T,
            propName: string,
            componentName: string,
            location: string,
            propFullName: string,
            obnoxiousGarbage: string
        ): Error | null;
    }
}

export function expectPropsError<P>(propTypes: { [prop: string]: PropTypes.Validator<any> }, props: P) {
    const errors = Object.keys(propTypes)
        .map((k) => propTypes[k](props, k, null, null, null, obnoxiousGarbage))
        .filter((error) => error !== null);
    return expect(errors);
}

export function expectComponentPropTypesError<P>(componentType: React.ComponentClass<P>, props: P) {
    return expectPropsError(componentType.propTypes, props);
}
