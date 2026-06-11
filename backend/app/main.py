import os
import mimetypes
mimetypes.init()
mimetypes.add_type("application/javascript", ".js")
mimetypes.add_type("text/css", ".css")
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from starlette.exceptions import HTTPException as StarletteHTTPException

from .db import engine, Base
from .models import VersionOut
from .api import registers, batches

# Create all tables on startup
Base.metadata.create_all(bind=engine)

app = FastAPI(title="FPGA Register Analyzer API", version="0.42.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173",
                   "http://localhost:8000", "http://127.0.0.1:8000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(registers.router)
app.include_router(batches.router)


@app.get("/api/version", response_model=VersionOut)
def get_version():
    return VersionOut(version="v0.42.0", build_date="2026-06-11", author="Aaron Hsueh")


@app.get("/api/health")
def health():
    return {"status": "ok"}


# Serve built frontend — falls back to index.html for SPA routing
import sys as _sys
if getattr(_sys, 'frozen', False):
    _DIST = os.path.join(os.path.dirname(_sys.executable), '_internal', 'frontend', 'dist')
else:
    _DIST = os.path.normpath(
        os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', 'frontend', 'dist')
    )

if os.path.isdir(_DIST):
    class _SPAFiles(StaticFiles):
        async def get_response(self, path: str, scope):
            try:
                return await super().get_response(path, scope)
            except StarletteHTTPException as exc:
                if exc.status_code == 404:
                    return await super().get_response('index.html', scope)
                raise

    app.mount('/', _SPAFiles(directory=_DIST, html=True), name='frontend')


if __name__ == '__main__':
    import uvicorn
    uvicorn.run(app, host='127.0.0.1', port=8000)
