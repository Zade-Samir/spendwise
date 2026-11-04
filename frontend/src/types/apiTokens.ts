export interface ApiToken {
  id: string;
  name: string;
  last4: string;
  scopes: string[];
  last_used_at: string | null;
  created_at: string;
}

export interface ApiTokenCreatedResponse extends ApiToken {
  token: string;
}

export interface ApiTokenCreateRequest {
  name: string;
  scopes?: string[];
}

