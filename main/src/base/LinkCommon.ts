import { Mongo } from 'meteor/mongo';

import ChangeStreamRegistry from '../changeStream/ChangeStreamRegistry';
import ChildDeMultiplexer from '../ChildDeMultiplexer';
import type { MeteorPublicationContext } from '../PublicationContext';
import type { ChangeStreamCallBacks, MongoDoc, WithoutId } from '../types';
import type { FieldProjection } from '../utils/filterFields';
import filterFields from '../utils/filterFields';

export type LinkCommonOptions = {
  fields: FieldProjection | undefined;
};

export class LinkCommon<T extends MongoDoc = MongoDoc> {
  public readonly fields: FieldProjection | undefined;

  public readonly children: ChildDeMultiplexer<T>;

  public readonly context: MeteorPublicationContext<T>;

  public readonly collection: Mongo.Collection<T>;

  public stopListener:
    | ReturnType<typeof ChangeStreamRegistry.addListener>
    | undefined;

  constructor(
    context: MeteorPublicationContext<T>,
    collection: Mongo.Collection<T>,
    options: LinkCommonOptions | undefined
  ) {
    this.context = context;
    this.collection = collection;
    this.children = new ChildDeMultiplexer<T>();
    this.fields = options?.fields;
  }

  public filterFields = (
    doc: Partial<T> | Partial<WithoutId<T>>
  ): Partial<WithoutId<T>> => {
    let nextDoc = doc;
    if (this.fields) nextDoc = filterFields(this.fields, doc);

    return filterFields({ _id: -1 }, nextDoc);
  };

  /** @internal */
  public addListener(callbacks: ChangeStreamCallBacks<T>): void {
    this.stopListener = ChangeStreamRegistry.addListener<T>(
      this.collection.rawCollection(),
      callbacks
    );
    this.children.observe();
  }

  /** @internal */
  public stop = async (): Promise<void> => {
    const { stopListener } = this;
    this.stopListener = undefined;

    if (stopListener) await stopListener();

    await this.children.stop();
  };
}
