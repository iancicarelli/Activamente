from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.routers import auth
from app.routers import users
from app.routers import patients
from app.routers import specialists
from app.routers import admins
from app.routers import exercises_library
from app.routers import routines
from app.routers import sessions
from app.routers import surveys
from app.routers import appointments

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(users.router)
app.include_router(patients.router)
app.include_router(specialists.router)
app.include_router(admins.router)
app.include_router(exercises_library.router)
app.include_router(routines.router)
app.include_router(sessions.router)
app.include_router(surveys.router)
app.include_router(appointments.router)

@app.get("/")
async def root():
    return {"message": "Hello World"}