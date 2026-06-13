from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.openapi.utils import get_openapi
from fastapi.responses import HTMLResponse

from app.api import auth, observations, schools, users

app = FastAPI(
    title="ObsApp API",
    version="0.1.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router, prefix="/api")
app.include_router(observations.router, prefix="/api")
app.include_router(schools.router, prefix="/api")
app.include_router(users.router, prefix="/api")


@app.get("/auth/login")
async def login_docs_redirect():
    return {"message": "Gebruik /api/auth/login om in te loggen."}


def custom_openapi():
    if app.openapi_schema:
        return app.openapi_schema
    openapi_schema = get_openapi(
        title=app.title,
        version=app.version,
        routes=app.routes,
    )
    openapi_schema["components"]["securitySchemes"] = {
        "BearerAuth": {
            "type": "http",
            "scheme": "bearer",
            "bearerFormat": "JWT",
        }
    }
    for path in openapi_schema["paths"].values():
        for operation in path.values():
            operation.setdefault("security", []).append({"BearerAuth": []})
    app.openapi_schema = openapi_schema
    return app.openapi_schema


app.openapi = custom_openapi


@app.get("/", response_class=HTMLResponse)
async def root():
    return """
<!doctype html>
<html lang="nl">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>ObsApp API</title>
    <style>
        body {
            font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
            margin: 0;
            min-height: 100vh;
            display: grid;
            place-items: center;
            background: #f4f6fb;
            color: #1f2937;
        }
        main {
            width: min(480px, calc(100% - 32px));
            padding: 2rem;
            border-radius: 1rem;
            background: #ffffff;
            box-shadow: 0 18px 50px rgba(15, 23, 42, 0.12);
        }
        h1 {
            margin-top: 0;
        }
        a {
            display: block;
            margin-top: 1rem;
            padding: 0.85rem 1rem;
            border-radius: 0.75rem;
            background: #eef2ff;
            color: #1d4ed8;
            text-decoration: none;
            font-weight: 600;
        }
        a:hover {
            background: #dbeafe;
        }
        .muted {
            color: #6b7280;
        }
    </style>
</head>
<body>
    <main>
        <h1>ObsApp API</h1>
        <p class="muted">Kies een endpoint om de API te bekijken of de status te controleren.</p>
        <a href="/health">Gezondheidscheck (/health)</a>
        <a href="/docs">Swagger API (/docs)</a>
        <a href="/openapi.json">OpenAPI JSON (/openapi.json)</a>
    </main>
</body>
</html>
"""


@app.get("/health")
async def health():
    return {"status": "ok"}
