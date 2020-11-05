import request from 'supertest';

import { server } from '@auth/test/server';
import { jwtHeader } from '@auth/test/constants';
import { resetDatabase } from '@test/utils';

import { User } from '@auth/models/User';

describe('/profile route', () => {
  let testServer, user: User, jwt;

  beforeEach(async () => {
    await resetDatabase();
    user = await User.query().insertAndFetch(
      { email: 'user@email.com', first_name: 'User', last_name: 'One', hash: '123' },
    );
    jwt = jwtHeader(user);
  });

  beforeEach(() => {
    testServer = server;
  });

  afterEach(() => {
    testServer.close();
  });

  describe('GET /', () => {
    test('returns user', (done) => {
      request(testServer)
        .get('/profile')
        .set('Authorization', jwt)
        .expect((res) => {
          const { body } = res;
          expect(body).toMatchObject({
            item: {
              id: user.id,
              email: 'user@email.com',
              first_name: 'User',
              last_name: 'One',
            },
          });
          expect(body.item.hash).not.toBeDefined();
        })
        .expect(200)
        .end(done);
    });

    test('authenticates with JWT', (done) => {
      request(testServer)
        .get('/profile')
        .expect(401)
        .end(done)
    });
  });

  describe('PUT /', () => {
    test('updates user', (done) => {
      request(testServer)
        .put('/profile')
        .send({ user: { first_name: 'New', last_name: 'User', email: 'A@email.com' } })
        .set('Authorization', jwt)
        .expect((res) => {
          const { body } = res;
          expect(body).toMatchObject({
            item: {
              email: 'user@email.com',
              first_name: 'New',
              last_name: 'User',
            },
          });
          expect(body.item.hash).not.toBeDefined();
        })
        .expect(200)
        .end(done);
    });

    test('authenticates with JWT', (done) => {
      request(testServer)
        .put('/profile')
        .expect(401)
        .end(done)
    });
  });
});