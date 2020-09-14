import { Meteor } from 'meteor/meteor';
// @ts-ignore
import { Minimongo } from 'meteor/minimongo';

import Link from 'meteor-streamed-joins';

import Threads, { ThreadDocument } from '../collections/Threads';

Meteor.publish('threads', function threadsPublication() {
  console.log('threads publication started');

  const selector = {};
  const matcher = new Minimongo.Matcher(selector)._docMatcher;
  const root = new Link<ThreadDocument>(this, Threads, selector, matcher);
  root.link<Meteor.User>(Meteor.users, (doc) => doc?.userIds);
  root.observe();

  this.onStop(() => {
    root.stop();
  });

  this.ready();
});
