import faker from 'faker';
import { Accounts } from 'meteor/accounts-base';
import { Meteor } from 'meteor/meteor';

import Threads from './collections/Threads';
import './publications/Threads';

Threads.remove({});
Meteor.users.remove({});

const userIds: string[] = [];

for (let i = 1; i < 20; i++) {
  const firstName = faker.name.firstName();
  const lastName = faker.name.lastName();

  const userId: string = Accounts.createUser({
    email: faker.internet.email(),
    profile: {
      firstName,
      lastName,
    },
  });

  userIds.push(userId);
}

const threadIds: string[] = [];

for (let i = 1; i < 5; i++) {
  const title = faker.company.companyName();
  const ids = [];
  for (let j = 1; j < 5; j++) {
    ids.push(faker.random.arrayElement(userIds));
  }

  const threadId = Threads.insert({ title, userIds: [...new Set(ids)] });
  threadIds.push(threadId);
}

Meteor.setInterval(() => {
  const threadId = faker.random.arrayElement(threadIds);

  const uIds = Threads.findOne(threadId)?.userIds;

  for (let i = 1; i < 5; i++) {
    if (faker.random.boolean() && uIds && uIds.length) {
      Threads.update(
        { _id: threadId },
        { $pull: { userIds: faker.random.arrayElement(uIds) } }
      );
    } else {
      Threads.update(
        { _id: threadId },
        { $addToSet: { userIds: faker.random.arrayElement(userIds) } }
      );
    }
  }
}, 5000);

// Meteor.setInterval(() => {
//   const uId = faker.random.arrayElement(userIds);
//
//   Meteor.users.update(
//     { _id: uId },
//     {
//       $set: {
//         profile: {
//           firstName: faker.name.firstName(),
//           lastName: faker.name.lastName(),
//         },
//       },
//     }
//   );
// }, 3000);
