# Public HTTP chat API

Enable the API by setting these environment variables before starting the
runner:

```dotenv
OMNIHARNESS_PUBLIC_API_KEY=generate-a-long-random-secret
OMNIHARNESS_PUBLIC_API_PROJECT_PATH=D:\\Codex\\Happyvidey
```

The API can access only the configured project path. Every request must send
the key in an `Authorization: Bearer` header.

## Start or continue a conversation

`POST /api/public/v1/chat`

```json
{
  "message": "Describe the current application architecture."
}
```

To continue a conversation, include its `conversationId`:

```json
{
  "conversationId": "existing-run-id",
  "message": "Now implement the login page."
}
```

The API returns `202 Accepted` with a conversation id and polling and SSE URLs.
The worker is fixed to Codex and can edit the configured project.

## Read an answer

`GET /api/public/v1/chat/:conversationId` returns the current run state and
the last worker transcript entries.

`GET /api/public/v1/chat/:conversationId/stream` emits `update` events until
the conversation is done, failed, or cancelled, then emits `done`.
