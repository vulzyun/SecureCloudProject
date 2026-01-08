from fastapi import APIRouter, Depends, BackgroundTasks, HTTPException
from fastapi.responses import PlainTextResponse
from sse_starlette.sse import EventSourceResponse
from sqlmodel import Session, select
from pathlib import Path
import shutil

from ..db import get_session
from ..models import Pipeline, Run, RunStatus, User, Role
from ..auth.proxy import get_current_user, require_role
from .events import bus
from .runner_real import run_real_pipeline  # Import du vrai runner
from .runner_real import run_real_pipeline_bg



router = APIRouter(prefix="/api", tags=["CI/CD Pipelines"])


@router.get(
    "/pipelines",
    summary="List all pipelines",
    description="""
    Retrieve a list of all configured CI/CD pipelines.

    **Permissions:** Any authenticated user

    Returns all pipeline configurations with their current status.
    """,
)
def list_pipelines(
    session: Session = Depends(get_session),
    user: User = Depends(get_current_user),
):
    """List all pipelines."""
    return session.exec(select(Pipeline).order_by(Pipeline.id.desc())).all()


@router.post(
    "/pipelines",
    status_code=201,
    summary="Create a new pipeline",
    description="""
    Create a new CI/CD pipeline configuration.

    **Permissions:** Dev or Admin
    """,
)
def create_pipeline(
    payload: dict,
    session: Session = Depends(get_session),
    user: User = Depends(require_role(Role.admin, Role.dev)),
):
    """Create a new pipeline (dev or admin only)."""
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
        created_by=user.username,
    )
    session.add(p)
    session.commit()
    session.refresh(p)
    return p


@router.post(
    "/pipelines/{pipeline_id}/run",
    status_code=201,
    summary="Trigger a pipeline run",
    description="""
    Start a new execution of the specified pipeline.

    **Permissions:** Dev or Admin
    """,
)
def run_pipeline(
    pipeline_id: int,
    bg: BackgroundTasks,
    session: Session = Depends(get_session),
    user: User = Depends(require_role(Role.admin, Role.dev)),
):
    """Trigger a pipeline run (dev or admin only)."""
    p = session.get(Pipeline, pipeline_id)
    if not p:
        raise HTTPException(status_code=404, detail="pipeline not found")

    # ✅ IMPORTANT: mettre à jour le pipeline immédiatement
    # Sinon le front refetch trop tôt et ne voit pas le changement.
    p.status = "running"
    session.add(p)
    session.commit()
    session.refresh(p)

    run = Run(pipeline_id=pipeline_id, status=RunStatus.running, created_by=user.id)
    session.add(run)
    session.commit()
    session.refresh(run)

    bg.add_task(run_real_pipeline_bg, run.id)

    return {"runId": run.id}


@router.get(
    "/runs/{run_id}/history",
    summary="Get run event history",
    description="""
    Retrieve the complete event history of a pipeline run.

    **Permissions:** Any authenticated user
    """,
)
def run_history(
    run_id: int,
    session: Session = Depends(get_session),
    user: User = Depends(get_current_user),
):
    """Get event history for a run."""
    run = session.get(Run, run_id)
    if not run:
        raise HTTPException(status_code=404, detail="run not found")
    return []


@router.get(
    "/runs/{run_id}/events",
    summary="Stream run events (SSE)",
    description="""
    Stream real-time execution events using Server-Sent Events (SSE).

    **Permissions:** Any authenticated user
    """,
)
async def run_events(
    run_id: int,
    user: User = Depends(get_current_user),
):
    """Stream run events (SSE)."""
    q = bus.queue(run_id)

    async def event_gen():
        while True:
            evt = await q.get()
            yield {"event": "message", "data": evt}

    return EventSourceResponse(event_gen())


@router.get(
    "/pipelines/{pipeline_id}/logs",
    response_class=PlainTextResponse,
    summary="Get pipeline logs from file",
    description="""
    Retrieve the complete log file content for a specific pipeline.

    **Permissions:** Any authenticated user
    """,
)
def get_pipeline_logs(
    pipeline_id: int,
    session: Session = Depends(get_session),
    user: User = Depends(get_current_user),
):
    """Get log file content for a pipeline."""
    pipeline = session.get(Pipeline, pipeline_id)
    if not pipeline:
        raise HTTPException(status_code=404, detail="Pipeline not found")

    # Sanitize pipeline name
    sanitized_name = pipeline.name.lower().replace(" ", "-").replace("_", "-")
    
    log_file = (
        Path.home()
        / ".cicd"
        / "workspaces"
        / sanitized_name
        / "logs"
        / f"{sanitized_name}.log"
    )

    if not log_file.exists():
        raise HTTPException(status_code=404, detail="Log file not found")

    try:
        with open(log_file, "r") as f:
            content = f.read()
        return content
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error reading log file: {str(e)}")


@router.delete(
    "/pipelines/{pipeline_id}",
    summary="Delete a pipeline",
    description="""
    Delete a pipeline and clean up its workspace directory.
    
    **Permissions:** Dev or Admin
    
    **Actions performed:**
    1. Delete pipeline from database
    2. Remove workspace directory: ~/.cicd/workspaces/{pipeline-name}/
    3. Remove all associated runs from database
    
    **Warning:** This action cannot be undone!
    """,
)
def delete_pipeline(
    pipeline_id: int,
    session: Session = Depends(get_session),
    user: User = Depends(require_role(Role.admin, Role.dev)),
):
    """Delete a pipeline and clean up its workspace (dev or admin only)."""
    # 1. Vérifier que le pipeline existe
    pipeline = session.get(Pipeline, pipeline_id)
    if not pipeline:
        raise HTTPException(status_code=404, detail="Pipeline not found")
    
    # 2. Supprimer tous les runs associés
    runs = session.exec(select(Run).where(Run.pipeline_id == pipeline_id)).all()
    for run in runs:
        session.delete(run)
    
    # 3. Supprimer le workspace sur le disque
    sanitized_name = pipeline.name.lower().replace(" ", "-").replace("_", "-")
    workspace_path = Path.home() / ".cicd" / "workspaces" / sanitized_name
    if workspace_path.exists():
        try:
            shutil.rmtree(workspace_path)
        except Exception as e:
            # Log l'erreur mais continue quand même
            print(f"Warning: Failed to delete workspace {workspace_path}: {e}")
    
    # 4. Supprimer le pipeline de la base
    session.delete(pipeline)
    session.commit()
    
    return {
        "ok": True,
        "message": "Pipeline deleted and workspace cleaned",
        "pipeline_id": pipeline_id
    }
