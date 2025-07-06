// src/types/express.d.ts
// This file extends the Express Request type to include custom properties
// added by middleware, such as user information from authentication.

declare namespace Express {
  export interface Request {
    user?: {
      sub: string;
      email: string;
      [key: string]: any;
    };
  }
}
