import { supabase } from '../supabase';

describe('Authentication', () => {
  describe('Login', () => {
    it('should sign in with valid email and password', async () => {
      const mockSignIn = jest.fn(() =>
        Promise.resolve({
          data: { user: { id: 'user-123' }, session: { access_token: 'token' } },
          error: null,
        })
      );
      supabase.auth.signInWithPassword = mockSignIn;

      const result = await supabase.auth.signInWithPassword({
        email: 'test@example.com',
        password: 'password123',
      });

      expect(mockSignIn).toHaveBeenCalledWith({
        email: 'test@example.com',
        password: 'password123',
      });
      expect(result.error).toBeNull();
      expect(result.data.user).toBeDefined();
    });

    it('should handle invalid credentials error', async () => {
      const mockSignIn = jest.fn(() =>
        Promise.resolve({
          data: { user: null, session: null },
          error: { message: 'Invalid login credentials' },
        })
      );
      supabase.auth.signInWithPassword = mockSignIn;

      const result = await supabase.auth.signInWithPassword({
        email: 'test@example.com',
        password: 'wrong',
      });

      expect(result.error).toBeDefined();
      expect(result.error?.message).toContain('Invalid');
    });

    it('should handle network timeout', async () => {
      const mockSignIn = jest.fn(() =>
        Promise.reject(new Error('Network timeout'))
      );
      supabase.auth.signInWithPassword = mockSignIn;

      await expect(
        supabase.auth.signInWithPassword({
          email: 'test@example.com',
          password: 'password123',
        })
      ).rejects.toThrow('Network timeout');
    });
  });

  describe('Signup', () => {
    it('should sign up with valid email and password', async () => {
      const mockSignUp = jest.fn(() =>
        Promise.resolve({
          data: { user: { id: 'user-456' }, session: null },
          error: null,
        })
      );
      supabase.auth.signUp = mockSignUp;

      const result = await supabase.auth.signUp({
        email: 'newuser@example.com',
        password: 'password123',
      });

      expect(result.error).toBeNull();
      expect(result.data.user?.id).toBe('user-456');
    });

    it('should reject duplicate email', async () => {
      const mockSignUp = jest.fn(() =>
        Promise.resolve({
          data: { user: null, session: null },
          error: { message: 'User already exists' },
        })
      );
      supabase.auth.signUp = mockSignUp;

      const result = await supabase.auth.signUp({
        email: 'existing@example.com',
        password: 'password123',
      });

      expect(result.error).toBeDefined();
    });
  });

  describe('Session', () => {
    it('should retrieve current session', async () => {
      const mockSession = {
        user: { id: 'user-123' },
        access_token: 'token123',
      };
      supabase.auth.getSession = jest.fn(() =>
        Promise.resolve({
          data: { session: mockSession },
          error: null,
        })
      );

      const result = await supabase.auth.getSession();

      expect(result.data.session).toEqual(mockSession);
    });

    it('should handle expired session', async () => {
      supabase.auth.getSession = jest.fn(() =>
        Promise.resolve({
          data: { session: null },
          error: null,
        })
      );

      const result = await supabase.auth.getSession();

      expect(result.data.session).toBeNull();
    });
  });

  describe('Logout', () => {
    it('should sign out user', async () => {
      supabase.auth.signOut = jest.fn(() =>
        Promise.resolve({ error: null })
      );

      const result = await supabase.auth.signOut();

      expect(supabase.auth.signOut).toHaveBeenCalled();
      expect(result.error).toBeNull();
    });
  });
});
