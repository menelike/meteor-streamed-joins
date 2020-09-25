describe('index', () => {
  it('throws if minimongo is not available', async () => {
    expect.assertions(1);

    // @ts-ignore
    const Minimongo = global.Package.minimongo;
    // @ts-ignore
    global.Package.minimongo = undefined;

    await expect(import('./index')).rejects.toEqual(
      Error('meteor/minimongo is missing')
    );

    // @ts-ignore
    global.Package.minimongo = Minimongo;
  });
});

export {};
