// src/types/express.d.ts
// This file extends the Express Request type to include custom properties
// added by middleware, such as user information from authentication.

declare namespace Express {
  interface Request {
    user?: {
      teamMemberId: string;
      // Add other user properties if they will be available on req.user
      // e.g., email: string;
      //       roles: string[];
    };
  }
}
