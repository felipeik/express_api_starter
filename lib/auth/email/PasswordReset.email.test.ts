import { User } from '../models/User';
import { resetDatabase, testService } from '../../libUtils/testUtils';
import { sendPasswordResetEmail } from '../email/PasswordReset.email';
import { EMAIL_CONFIG } from '../../email/services/validateEmailConfig';

describe('PasswordReset Email', () => {
  let user: User;
  const token = 'MY_TOKEN';

  beforeAll(async () => {
    await resetDatabase();
    user = await User.query().insertAndFetch(
      { email: 'user@email.com', first_name: 'a', last_name: 'b' },
    )
  });

  describe('success', () => {
    test('sends email with password reset request link', async() => {
      const sendEmail = jest.fn().mockReturnValueOnce(Promise.resolve());
      testService({
        Email: { sendEmail },
      });

      await sendPasswordResetEmail({ user, token });

      expect(sendEmail).toHaveBeenCalledWith(expect.objectContaining({
        html: expect.stringMatching(EMAIL_CONFIG.passwordReset.action_url
            .replace(/{USER_ID}/g, String(user.id))
            .replace(/{DOMAIN}/g, process.env.EMAIL_DOMAIN)
            .replace(/{TOKEN}/g, 'MY_TOKEN')
            .replace('?', '\\?')),
        subject: EMAIL_CONFIG.passwordReset.subject,
        to: 'user@email.com',
        from: process.env.RESET_PASSWORD_EMAIL_SENDER,
      }));
    });
  });
  describe('on error', () => {
    test('return error message', async () => {
      const sendEmail = jest.fn().mockImplementationOnce(() => Promise.reject({ code: 100, message: 'some_error' }));
      testService({
        Email: { sendEmail },
      });

      await expect(sendPasswordResetEmail({ user, token })).rejects.toEqual({
        code: 100,
        message: 'some_error',
      });
    });
  });
});
