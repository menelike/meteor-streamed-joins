import { Meteor } from 'meteor/meteor';

import {
  MongoObserver,
  ChangeStream,
  MeteorObserveCallbacks,
} from 'meteor-streamed-joins';
import type { WatchObserveCallBacks } from 'meteor-streamed-joins';

import Threads, { ThreadDocument } from '../collections/Threads';

Meteor.publish('threads', function threadsPublication() {
  // eslint-disable-next-line @typescript-eslint/no-this-alias
  const publication = this;
  console.log('threads publication started');

  const watchObserveCallback: WatchObserveCallBacks<ThreadDocument> = {
    added(ids) {
      console.log('users added', ids);
      const users = Meteor.users.find({ _id: { $in: ids } }).fetch();
      users.forEach((user) => {
        publication.added('users', user._id, user);
      });
    },
    changed(id, fields) {
      console.log('user changed', id, fields);
      publication.changed('users', id, fields);
    },
    removed(ids) {
      console.log('users removed', ids);
      ids.forEach((id) => {
        publication.removed('users', id);
      });
    },
  };

  const observeCallBacks: MeteorObserveCallbacks<ThreadDocument> = {
    added(doc): Array<string> {
      console.log('thread added', doc);
      publication.added('threads', doc._id, doc);
      return doc.userIds;
    },
    changed(doc): Array<string> | void {
      console.log('thread changed', doc);
      publication.changed('threads', doc._id, doc);
      return doc.userIds;
    },
    removed(doc): void {
      console.log('thread removed', doc._id);
      publication.removed('threads', doc._id);
    },
  };

  const observer = new MongoObserver<ThreadDocument>();
  observer.observe(Threads.find({}), observeCallBacks, watchObserveCallback);

  const changeStream = new ChangeStream<Meteor.User>(observer);
  changeStream.observe(Meteor.users.rawCollection(), watchObserveCallback);

  this.onStop(() => {
    observer.stop();
    changeStream.stop();
  });

  this.ready();
});
