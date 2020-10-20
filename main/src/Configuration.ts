export type IdGeneration = 'STRING' | 'MONGO';

type Config = {
  [key: string]: {
    idGeneration: IdGeneration;
  };
};

class Configuration {
  private config: Config = {};

  public setConfig(config: Config): void {
    this.config = config;
  }

  public idGeneration = (collectionName: string): IdGeneration => {
    return this.config[collectionName]?.idGeneration || 'STRING';
  };
}

const configuration = new Configuration();

export default configuration;
