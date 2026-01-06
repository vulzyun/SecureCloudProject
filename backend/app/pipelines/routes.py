from fastapi import APIRouter, Depends, BackgroundTasks, HTTPException
from sse_starlette.sse import EventSourceResponse
from sqlmodel import Session, select
from ..db import get_session
from ..models import Pipeline, Run, RunStatus, User, Role
from ..auth.proxy import get_current_user, require_role
from .events import bus
from .runner_fake import run_fake

router = APIRouter(prefix="/api")

@router.get("/pipelines")
def list_pipelines(
    session: Session = Depends(get_session),
    user: User = Depends(get_current_user),
):
    return session.exec(select(Pipeline).order_by(Pipeline.id.desc())).all()

@router.post("/pipelines")
def create_pipeline(
    payload: dict,
    session: Session = Depends(get_session),
    user: User = Depends(require_role(Role.admin, Role.dev)),
):
    name = payload.get("name")
    repo_url = payload.get("repo_url") or payload.get("github_url")
    branch = payload.get("branch") or "main"
    if not name or not repo_url:
        raise HTTPException(status_code=400, detail="name and repo_url/github_url are required")

    p = Pipeline(
        name=name, 
        repo_url=repo_url, 
        github_url=repo_url,
        branch=branch,
        status="pending",
        created_by=user.username
    )
    session.add(p)
    session.commit()
    session.refresh(p)
    return p

@router.post("/pipelines/{pipeline_id}/run")
def run_pipeline(
    pipeline_id: int,
    bg: BackgroundTasks,
    session: Session = Depends(get_session),
    user: User = Depends(require_role(Role.admin, Role.dev)),
):
    p = session.get(Pipeline, pipeline_id)
    if not p:
        raise HTTPException(status_code=404, detail="pipeline not found")

    run = Run(pipeline_id=pipeline_id, status=RunStatus.running, created_by=user.id)
    session.add(run)
    session.commit()
    session.refresh(run)

    bg.add_task(run_fake, run.id)
    return {"runId": run.id}

@router.get("/runs/{run_id}/history")
def run_history(
    run_id: int,
    session: Session = Depends(get_session),
    user: User = Depends(get_current_user),
):
    """Récupère l'historique des événements d'un run"""
    run = session.get(Run, run_id)
    if not run:
        raise HTTPException(status_code=404, detail="run not found")
    
    # Retourner les événements stockés (si implémenté) ou un tableau vide
    return []

@router.get("/runs/{run_id}/events")
async def run_events(
    run_id: int,
    user: User = Depends(get_current_user),
):
    q = bus.queue(run_id)

    async def event_gen():
        while True:
            evt = await q.get()
            yield {"event": "message", "data": evt}

    return EventSourceResponse(event_gen())
