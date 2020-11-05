import request from 'supertest';

import { server } from 'src/server';
import { User } from '@auth/models/User';
import { resetDatabase } from '@test/utils';

describe('/auth route definitions', () => {
  let user: User;

  beforeAll(async () => {
    await resetDatabase();
    user = await User.query().insertAndFetch({
      email: 'user@email.com',
      first_name: 'John',
    });
  });

  test('POST /signup', (done) => {
    request(server)
      .post('/api/v1/signup')
      .expect(422)
      .end(done);
  });

  test('PUT /signup/:id/confirm', (done) => {
    request(server)
      .put(`/api/v1/signup/${user.id}/confirm`)
      .expect(401)
      .end(done);
  });

  test('POST /signup/early_access', (done) => {
    request(server)
      .post(`/api/v1/signup/early_access`)
      .expect(422)
      .end(done);
  });

  test('PUT /signup/early_access/:id/confirm', (done) => {
    request(server)
      .put(`/api/v1/signup/early_access/${user.id}/confirm`)
      .expect(401)
      .end(done);
  });

  test('POST /signin', (done) => {
    request(server)
      .post('/api/v1/signin')
      .expect(401)
      .end(done);
  });

  test('POST /password/forgot', (done) => {
    request(server)
      .post(`/api/v1/password/forgot`)
      .expect(200)
      .end(done);
  });

  test('PUT /password/:id/reset', (done) => {
    request(server)
      .put(`/api/v1/password/${user.id}/reset`)
      .expect(401)
      .end(done);
  });
});