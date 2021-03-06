import request from 'supertest';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';

import { server } from '../test/server';
import { PASSWORD_HASH } from '../test/constants';
import { countModel, resetDatabase, testService } from '../../libUtils/testUtils';

import { User } from '../models/User';
import { SignupConfirmationService } from '../services/SignupConfirmation.service';
import { PasswordService } from '../services/Password.service';

import AppConfig from '../../../app.config.json';

describe('/auth route', () => {
  describe('POST /signup', () => {
    beforeEach(async () => {
      await resetDatabase();
    });

    test('creates and return user without hash', async (done) => {
      expect.hasAssertions();
      const initialCount = await countModel(User);

      const sendEmail = jest.fn().mockReturnValue(Promise.resolve())
      testService({
        Email: { sendEmail },
      });

      request(server)
        .post('/auth/signup')
        .send({
          email: 'a@a.com',
          first_name: 'a',
          last_name: 'b',
          password: 'StR0NGP@SS!',
          password_confirmation: 'StR0NGP@SS!',
          metadata: { newsletter: true },
        })
        .expect(200)
        .end(async (err, res) => {
          const { body } = res;
          expect(body).toMatchObject({
            item: {
              id: expect.any(Number),
              email: 'a@a.com',
              first_name: 'a',
              last_name: 'b',
            },
          });
          expect(body.item.hash).not.toBeDefined();
          const finalCount = await countModel(User);

          expect(finalCount).toEqual(initialCount + 1);

          expect(sendEmail).toHaveBeenCalled();

          done(err);
        });
    });
  });

  describe('POST /login', () => {
    let user: User;

    beforeAll(async () => {
      await resetDatabase();
      user = await User.query().insert(
        { email: 'a@a.com', first_name: 'a', last_name: 'b', confirmed: true, hash: PASSWORD_HASH },
      )
    });

    test('sign ins with correct credentials', async (done) => {
      expect.hasAssertions();

      request(server)
        .post('/auth/login')
        .send({ email: 'a@a.com', password: '123456' })
        .expect(200)
        .end((err, res) => {
          const { body } = res;
          expect(body).toMatchObject({
            item: {
              id: expect.any(Number),
              email: 'a@a.com',
              first_name: 'a',
              last_name: 'b',
            },
            token: expect.any(String),
          });
          expect(body.item.hash).not.toBeDefined();

          const parsedToken: any = jwt.verify(body.token, process.env.JWT_SECRET);
          expect(parsedToken.id).toEqual(user.id);
          expect(parsedToken.email).toEqual('a@a.com');

          done(err);
        });
    });

    test('returns 401 if email does not exist', (done) => {
      request(server)
        .post('/auth/login')
        .send({ email: 'WRONG@email.com', password: '123456' })
        .expect(401)
        .end(done);
    });

    test('returns 401 if password is wrong', (done) => {
      request(server)
        .post('/auth/login')
        .send({ email: 'a@a.com', password: 'WRONG' })
        .expect(401)
        .end(done);
    });

    test('returns 403 if user is not confirmed', async (done) => {
      await user.$query().update({ confirmed: false });

      request(server)
        .post('/auth/login')
        .send({ email: 'a@a.com', password: '123456' })
        .expect(403)
        .end((err, res) => {
          expect(res.body).toEqual({ code: 401, message: 'Email not confirmed' });
          done(err);
        });
    });
  });

  describe('POST /password/forgot', () => {
    beforeAll(async () => {
      await resetDatabase();
      await User.query().insert(
        { email: 'a@a.com', first_name: 'a', last_name: 'b', hash: PASSWORD_HASH },
      )
    });

    test('responds with a message', async (done) => {
      const sendEmail = jest.fn().mockReturnValueOnce(Promise.resolve());
      testService({
        Email: { sendEmail },
      });

      expect.hasAssertions();

      request(server)
        .post('/auth/password/forgot')
        .send({ email: 'a@a.com' })
        .expect(200)
        .end((err, res) => {
          expect(res.body).toEqual({ message: 'An email with a password reset link was sent to your inbox' })

          done(err);
        });
    });
  });

  describe('GET /signup/:id/confirm', () => {
    let user: User, token: string;

    beforeAll(async () => {
      await resetDatabase();
      user = await User.query().insertAndFetch(
        { email: 'a@a.com', first_name: 'a', last_name: 'b', hash: PASSWORD_HASH, confirmed: false }
      );
      token = SignupConfirmationService.tokenGenerator(user);
    });

    test('redirects', async (done) => {
      const sendEmail = jest.fn().mockReturnValueOnce(Promise.resolve());
      testService({
        Email: { sendEmail },
      });

      expect.hasAssertions();

      request(server)
        .get(`/auth/signup/${user.id}/confirm?token=${token}`)
        .set('Accept', 'text/html')
        .expect('Content-Type', /html/)
        .expect('location', AppConfig.auth.signup.signupConfirmationRedirectUrl)
        .expect(302)
        .end(async (err) => {
          const confirmedUser = await User.query().findById(user.id);
          expect(confirmedUser.confirmed).toBeTruthy();

          done(err);
        });
    });
  });

  describe('PUT /signup/:id/confirm', () => {
    let user: User, token: string;

    beforeAll(async () => {
      await resetDatabase();
      user = await User.query().insertAndFetch(
        { email: 'a@a.com', first_name: 'a', last_name: 'b', hash: PASSWORD_HASH, confirmed: false }
      );
      token = SignupConfirmationService.tokenGenerator(user);
    });

    test('responds with a message', async (done) => {
      const sendEmail = jest.fn().mockReturnValueOnce(Promise.resolve());
      testService({
        Email: { sendEmail },
      });

      expect.hasAssertions();

      request(server)
        .put(`/auth/signup/${user.id}/confirm?token=${token}`)
        .expect(200)
        .expect('Content-Type', /json/)
        .end(async (err, res) => {
          const confirmedUser = await User.query().findById(user.id);
          expect(confirmedUser.confirmed).toBeTruthy();

          expect(res.body).toEqual({
            item: user.toJson(),
          });

          done(err);
        });
    });
  });

  describe('PUT /password/:id/reset', () => {
    let user: User, token: string;

    beforeAll(async () => {
      await resetDatabase();
      user = await User.query().insertAndFetch(
        { email: 'a@a.com', first_name: 'a', last_name: 'b', hash: PASSWORD_HASH, confirmed: true }
      );
      token = PasswordService.resetPasswordTokenGenerator(user);
    });

    test('responds with a message', async (done) => {
      const sendEmail = jest.fn().mockReturnValueOnce(Promise.resolve());
      testService({
        Email: { sendEmail },
      });

      expect.hasAssertions();

      request(server)
        .put(`/auth/password/${user.id}/reset`)
        .send({ token, password: 'STRONGPASS@', password_confirmation: 'STRONGPASS@' })
        .expect(200)
        .end(async (err, res) => {
          expect(res.body).toEqual({ item: user.toJson() });

          const updatedUser = await User.query().findById(user.id);
          expect(await bcrypt.compare('STRONGPASS@', updatedUser.hash)).toEqual(true);

          done(err);
        });
    });
  });

  describe('POST /signup/early_access', () => {
    beforeEach(async () => {
      await resetDatabase();
    });

    test('creates and return user without hash', async (done) => {
      expect.hasAssertions();
      const initialCount = await countModel(User);

      const sendEmail = jest.fn().mockReturnValue(Promise.resolve())
      testService({
        Email: { sendEmail },
      });

      request(server)
        .post('/auth/signup/early_access')
        .send({
          email: 'a@a.com',
          first_name: 'a',
          last_name: 'b',
          metadata: { newsletter: true },
        })
        .expect(200)
        .end(async (err, res) => {
          const { body } = res;
          expect(body).toMatchObject({
            item: {
              id: expect.any(Number),
              email: 'a@a.com',
              first_name: 'a',
              last_name: 'b',
            },
          });
          expect(body.item.hash).not.toBeDefined();
          const finalCount = await countModel(User);

          expect(finalCount).toEqual(initialCount + 1);

          expect(sendEmail).toHaveBeenCalled();

          done(err);
        });
    });
  });

  describe('PUT /signup/early_access/:id/confirm', () => {
    let user: User, token: string;

    beforeAll(async () => {
      await resetDatabase();
      user = await User.query().insertAndFetch(
        { email: 'a@a.com', first_name: 'a', last_name: 'b', confirmed: false }
      );
      token = SignupConfirmationService.tokenGenerator(user);
    });

    test('responds with a message', async (done) => {
      const sendEmail = jest.fn().mockReturnValueOnce(Promise.resolve());
      testService({
        Email: { sendEmail },
      });

      expect.hasAssertions();

      request(server)
        .put(`/auth/signup/early_access/${user.id}/confirm`)
        .send({ token, password: 'STRONGPASS@', password_confirmation: 'STRONGPASS@' })
        .expect(200)
        .end(async (err, res) => {
          expect(res.body).toMatchObject({
            item: user.toJson(),
            token: expect.any(String),
          });

          const confirmedUser = await User.query().findById(user.id);
          expect(confirmedUser.confirmed).toBeTruthy();

          done(err);
        });
    });
  });

  describe('POST /signup/pre_launch', () => {
    beforeEach(async () => {
      await resetDatabase();
    });

    test('creates and return user without hash', async (done) => {
      expect.hasAssertions();
      const initialCount = await countModel(User);

      const sendEmail = jest.fn().mockReturnValue(Promise.resolve())
      testService({
        Email: { sendEmail },
      });

      request(server)
        .post('/auth/signup/pre_launch')
        .send({
          email: 'a@a.com',
          first_name: 'a',
          last_name: 'b',
          metadata: { newsletter: true },
        })
        .expect(200)
        .end(async (err, res) => {
          const { body } = res;
          expect(body).toMatchObject({
            item: {
              id: expect.any(Number),
              email: 'a@a.com',
              first_name: 'a',
              last_name: 'b',
            },
          });
          expect(body.item.hash).not.toBeDefined();
          const finalCount = await countModel(User);

          expect(finalCount).toEqual(initialCount + 1);

          expect(sendEmail).toHaveBeenCalled();

          done(err);
        });
    });
  });
});
