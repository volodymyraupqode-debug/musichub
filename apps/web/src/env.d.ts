// Environment variables read by the web app (see .env.example).
declare namespace NodeJS {
  interface ProcessEnv {
    readonly NEXT_PUBLIC_API_URL?: string;
    readonly API_INTERNAL_URL?: string;
  }
}
