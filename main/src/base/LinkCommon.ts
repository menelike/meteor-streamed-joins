// @ts-ignore
import EJSON from 'ejson';
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

  public readonly collectionName: string;

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
    this.collectionName = this.collection.rawCollection().collectionName;
  }

  private getPublishedDocument = (id: string): Partial<WithoutId<T>> | void => {
    /* istanbul ignore next */
    if (!this.context._session || !this.context._subscriptionId) {
      throw Error('Meteor subscription context invalid');
    }
    const view = this.context._session.collectionViews.get(this.collectionName);
    if (!view) return undefined;
    const sessionDocumentView = view.documents.get(id);
    if (!sessionDocumentView) return undefined;
    if (!sessionDocumentView.existsIn.has(this.context._subscriptionId)) {
      return undefined;
    }

    return sessionDocumentView.getFields();
  };

  public diffDocumentWithPublished = (
    id: string,
    fullDocument: T
  ): Partial<WithoutId<T>> => {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { _id: fullDocumentId, ...fullDocumentWithoutId } = fullDocument;
    const filteredFullDocument = this.filterFields(fullDocumentWithoutId);
    const publishedDocument = this.getPublishedDocument(id);
    if (!publishedDocument) return filteredFullDocument;

    const filteredPublishedDocument = this.filterFields(publishedDocument);
    const result: Partial<WithoutId<T>> = {};
    const publishedFields = new Set(Object.keys(filteredPublishedDocument));
    const newFields = new Set(Object.keys(filteredFullDocument));

    // only in currently published document
    publishedFields.forEach((field) => {
      if (!newFields.has(field)) {
        // @ts-ignore
        result[field] = undefined;
      }
    });

    // only in new fields
    newFields.forEach((field) => {
      if (!publishedFields.has(field)) {
        // @ts-ignore
        result[field] = filteredFullDocument[field];
      }
    });

    // in both documents
    [...newFields, ...publishedFields]
      .filter((field) => newFields.has(field) && publishedFields.has(field))
      .forEach((field) => {
        if (
          !EJSON.equals(
            { [field]: filteredPublishedDocument[field] },
            { [field]: filteredFullDocument[field] }
          )
        ) {
          // @ts-ignore
          result[field] = filteredFullDocument[field];
        }
      });

    return result;
  };

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
