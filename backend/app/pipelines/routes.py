from fastapi import APIRouter, Depends, BackgroundTasks, HTTPException
from sse_starlette.sse import EventSourceResponse
from sqlmodel import Session, select
from ..db import get_session
from ..models import Pipeline, Run, RunStatus, User, Role
from ..auth.proxy import get_current_user, require_role
from .events import bus
from .runner_fake import run_fake
from .runner_real import run_real_pipeline  # Import du vrai runner

router = APIRouter(prefix="/api", tags=["CI/CD Pipelines"])

@router.get(
    "/pipelines",
    summary="List all pipelines",
    description="""
    Retrieve a list of all configured CI/CD pipelines.
    
    **Permissions:** Any authenticated user
    
    Returns all pipeline configurations with their current status.
    """,
    responses={
        200: {
            "description": "List of all pipelines",
            "content": {
                "application/json": {
                    "example": [
                        {
                            "id": 1,
                            "name": "My App",
                            "repo_url": "https://github.com/user/repo.git",
                            "github_url": "https://github.com/user/repo.git",
                            "branch": "main",
                            "status": "success",
                            "created_by": "john_doe",
                            "created_at": "2026-01-06T10:30:00Z"
                        }
                    ]
                }
            }
        }
    }
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
    
    A pipeline defines how to build, test and deploy a project from a Git repository.
    
    **Workflow:**
    1. Clone repository
    2. Run Maven tests (./mvnw clean compile && ./mvnw test)
    3. Build Docker image
    4. Ship image to remote server via SSH (cloudprojet@100.68.111.86)
    5. Deploy container
    6. Run healthcheck
    
    **Request body:**
    ```json
    {
      "name": "My App",
      "repo_url": "https://github.com/user/repo.git",
      "branch": "main"  // optional, defaults to "main"
    }
    ```
    """,
    responses={
        201: {
            "description": "Pipeline created successfully",
            "content": {
                "application/json": {
                    "example": {
                        "id": 1,
                        "name": "My App",
                        "repo_url": "https://github.com/user/repo.git",
                        "github_url": "https://github.com/user/repo.git",
                        "branch": "main",
                        "status": "pending",
                        "created_by": "john_doe"
                    }
                }
            }
        },
        400: {"description": "Missing required fields (name or repo_url)"},
        403: {"description": "Forbidden - Dev or Admin access required"}
    }
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
        created_by=user.username
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
    
    **Execution steps:**
    1. **Checkout**: Clone the Git repository to `~/.cicd/workspaces/pipeline-{id}/`
    2. **Maven Tests**: Build and run tests with Maven in demo/ directory
       - `./mvnw -B clean compile`
       - `./mvnw -B test` (pipeline fails if tests fail)
    3. **Docker Build**: Create Docker image from demo/ directory
    4. **Ship Image**: Transfer image to cloudprojet@100.68.111.86 via SSH
    5. **Deploy**: Start container on remote server (port 8080)
    6. **Healthcheck**: Verify deployment success
    
    **Real-time monitoring:**
    Use the `/api/runs/{run_id}/events` endpoint to follow execution in real-time via SSE.
    
    **Deployment target:**
    - Host: cloudprojet@100.68.111.86:22
    - Container port: 8080
    """,
    responses={
        201: {
            "description": "Pipeline run started successfully",
            "content": {
                "application/json": {
                    "example": {"runId": 1}
                }
            }
        },
        403: {"description": "Forbidden - Dev or Admin access required"},
        404: {"description": "Pipeline not found"}
    }
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

    run = Run(pipeline_id=pipeline_id, status=RunStatus.running, created_by=user.id)
    session.add(run)
    session.commit()
    session.refresh(run)

    # Choisir le runner : fake pour demo, real pour production
    use_real_runner = True  # Mettre à True pour utiliser le vrai runner
    
    if use_real_runner:
        bg.add_task(run_real_pipeline, run.id)
    else:
        bg.add_task(run_fake, run.id)
    
    return {"runId": run.id}

@router.get(
    "/runs/{run_id}/history",
    summary="Get run event history",
    description="""
    Retrieve the complete event history of a pipeline run.
    
    **Permissions:** Any authenticated user
    
    Useful for viewing logs after a run has completed.
    Returns all events that were streamed during execution.
    """,
    responses={
        200: {
            "description": "List of run events",
            "content": {
                "application/json": {
                    "example": [
                        {"type": "run_start"},
                        {"type": "step_start", "step": "checkout"},
                        {"type": "log", "step": "checkout", "message": "Cloning repository..."},
                        {"type": "step_success", "step": "checkout"},
                        {"type": "run_success"}
                    ]
                }
            }
        },
        404: {"description": "Run not found"}
    }
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
    
    # Retourner les événements stockés (si implémenté) ou un tableau vide
    return []

@router.get(
    "/runs/{run_id}/events",
    summary="Stream run events (SSE)",
    description="""
    Stream real-time execution events using Server-Sent Events (SSE).
    
    **Permissions:** Any authenticated user
    
    **Event types:**
    - `run_start`: Pipeline execution started
    - `step_start`: New step started (checkout, maven_tests, docker_build, ship_image_ssh, deploy_run, healthcheck)
    - `log`: Log message from current step
    - `step_success`: Step completed successfully
    - `run_success`: Pipeline completed successfully
    - `run_failed`: Pipeline failed with error message
    
    **Example usage (JavaScript):**
    ```javascript
    const eventSource = new EventSource('/api/runs/1/events');
    eventSource.addEventListener('message', (event) => {
      const data = JSON.parse(event.data);
      console.log(data);
    });
    ```
    
    **Connection:** This endpoint keeps the connection open until the run completes or fails.
    """,
    responses={
        200: {
            "description": "SSE stream of run events",
            "content": {
                "text/event-stream": {
                    "example": '''event: message\ndata: {"type":"run_start"}\n\nevent: message\ndata: {"type":"step_start","step":"checkout"}\n\nevent: message\ndata: {"type":"log","step":"checkout","message":"Cloning repository..."}\n\n'''
                }
            }
        }
    }
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
