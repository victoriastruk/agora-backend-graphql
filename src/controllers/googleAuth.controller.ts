import { Elysia, t } from 'elysia';
import { AuthUtils, type CookieStore } from '@/utils/auth';
import { AuthQueries } from '@/db/queries/auth';
import { ResponseUtils } from '@/utils/ResponseUtils';

export const googleAuthController = new Elysia({ prefix: '/api/auth/google' })
  .get('/', ({ redirect }) => {
    const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID!;
    const REDIRECT_URI = process.env.GOOGLE_REDIRECT_URI!;
    const SCOPE = ['openid', 'email', 'profile'].join(' ');
    const STATE = crypto.randomUUID();

    const authUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth');
    authUrl.searchParams.append('client_id', GOOGLE_CLIENT_ID);
    authUrl.searchParams.append('redirect_uri', REDIRECT_URI);
    authUrl.searchParams.append('response_type', 'code');
    authUrl.searchParams.append('scope', SCOPE);
    authUrl.searchParams.append('state', STATE);

    return redirect(authUrl.toString());
  }, {
    detail: {
      tags: ['Authentication'],
      summary: 'Initiate Google OAuth',
      responses: {
        302: {
          description: 'Redirect to Google OAuth',
        },
      },
    },
  })

  .get('/callback', async ({ query, cookie, set }) => {
    try {
      const { code, error } = query as { code?: string; error?: string };
      if (error) {
        set.status = 400;
        return ResponseUtils.error('Google auth failed', 400);
      }

      if (!code) {
        set.status = 400;
        return ResponseUtils.error('No authorization code', 400);
      }

      const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          code,
          client_id: process.env.GOOGLE_CLIENT_ID!,
          client_secret: process.env.GOOGLE_CLIENT_SECRET!,
          redirect_uri: process.env.GOOGLE_REDIRECT_URI!,
          grant_type: 'authorization_code',
        }),
      });

      const tokenData = await tokenRes.json();
      if (!tokenData.access_token) {
        set.status = 401;
        return ResponseUtils.error('Invalid Google token exchange', 401);
      }

      const userInfoRes = await fetch(
        'https://www.googleapis.com/oauth2/v2/userinfo',
        {
          headers: { Authorization: `Bearer ${tokenData.access_token}` },
        }
      );

      const googleUser = await userInfoRes.json();
      if (!googleUser.email) {
        set.status = 400;
        return ResponseUtils.error('Missing user info from Google', 400);
      }

      let user = await AuthQueries.findUserByEmail(googleUser.email);
      if (!user) {
        user = await AuthQueries.createUser({
          username: googleUser.name || googleUser.email.split('@')[0],
          email: googleUser.email,
          passwordHash: '',
        });
      }

      const session = await AuthUtils.createAuthSession(user);
      AuthUtils.applyAuthCookies(cookie as CookieStore, session.tokens);

      const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
      return Response.redirect(`${frontendUrl}?auth=success`);
    } catch (err) {
      console.error('Google Auth callback error:', err);
      set.status = 500;
      return ResponseUtils.error('Internal server error', 500);
    }
  }, {
    detail: {
      tags: ['Authentication'],
      summary: 'Google OAuth callback',
      responses: {
        302: {
          description: 'Redirect to frontend with auth success',
        },
        400: {
          description: 'Google auth failed or missing code',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  success: { type: 'boolean', example: false },
                  message: { type: 'string', example: 'Google auth failed' },
                },
              },
            },
          },
        },
        401: {
          description: 'Invalid Google token exchange',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  success: { type: 'boolean', example: false },
                  message: { type: 'string', example: 'Invalid Google token exchange' },
                },
              },
            },
          },
        },
        500: {
          description: 'Internal server error',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  success: { type: 'boolean', example: false },
                  message: { type: 'string', example: 'Internal server error' },
                },
              },
            },
          },
        },
      },
    },
  });
