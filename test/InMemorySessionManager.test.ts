import InMemorySessionManager from '../src/InMemorySessionManager';

describe('InMemorySessionManager test', () => {

    test('InMemorySessionManager is instantiable', () => {
        expect(new InMemorySessionManager()).toBeInstanceOf(InMemorySessionManager);
    });

    // TODO: test
});
