const testFileName = 'test/TestComponent.tsx';

import { createTestProgramAndEmit } from './ProgramRunner';

describe('Transformer', () => {
    it('transforms TypeScript interfaces to PropTypes declarations on emitted code', () => {
        createTestProgramAndEmit(testFileName, (emittedSource) => {
            expect(emittedSource).toMatchSnapshot();
        });
    });
});
