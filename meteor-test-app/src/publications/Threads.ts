import { Meteor } from 'meteor/meteor';

import Link, { ChangeStreamRegistry } from 'meteor-streamed-joins';

import Threads, { ThreadDocument } from '../collections/Threads';

ChangeStreamRegistry.watch<ThreadDocument>(Threads.rawCollection());
ChangeStreamRegistry.watch<Meteor.User>(Meteor.users.rawCollection());

Meteor.publish('threads', function threadsPublication() {
  console.log('threads publication started');

  const selector = {};
  const root = new Link<ThreadDocument>(this, Threads, selector);
  root.link<Meteor.User>(Meteor.users, (doc) => doc?.userIds);
  root.observe();

  this.ready();
});
