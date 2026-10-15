declare global {
  namespace Express {
    interface Request {
      /** Set by requireAuth after verifying the access token. */
      user?: { id: string; email: string; username: string };
      /** Set by the `validate` middleware with parsed { body, query, params }. */
      validated?: { body: any; query: any; params: any };
    }
  }
}

export {};
