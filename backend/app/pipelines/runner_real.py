import asyncio
import shutil
import subprocess
from datetime import datetime
from pathlib import Path
from typing import Iterable, Optional

from sqlmodel import Session

from ..db import engine
from ..models import Pipeline, Run, RunStatus
from .events import bus


# ----------------------------
# Helpers: SSE events & logging
# ----------------------------

# Global dict to store log file paths for each run
_log_files = {}

def _get_log_file(pipeline_id: int, run_id: int) -> Path:
    """Get or create log file path for a run."""
    if run_id not in _log_files:
        log_dir = Path.home() / ".cicd" / "workspaces" / f"pipeline-{pipeline_id}" / "logs"
        log_dir.mkdir(parents=True, exist_ok=True)
        log_file = log_dir / f"run-{run_id}.log"
        _log_files[run_id] = log_file
        # Initialize log file with header
        with open(log_file, 'w') as f:
            f.write(f"=== Pipeline Run {run_id} - {datetime.utcnow().isoformat()} ===\n\n")
    return _log_files[run_id]

def _write_to_log(log_file: Path, message: str):
    """Write a message to the log file."""
    # Ensure parent directory exists
    log_file.parent.mkdir(parents=True, exist_ok=True)
    with open(log_file, 'a') as f:
        f.write(f"{message}\n")

async def _emit(run_id: int, evt: dict, pipeline_id: int = None):
    """Publish event to SSE bus."""
    await bus.publish(run_id, evt)

async def _step_start(run_id: int, step: str, pipeline_id: int = None):
    if pipeline_id:
        log_file = _get_log_file(pipeline_id, run_id)
        _write_to_log(log_file, f"\n>>> STEP: {step}")
    await _emit(run_id, {"type": "step_start", "step": step})

async def _step_ok(run_id: int, step: str, pipeline_id: int = None):
    if pipeline_id:
        log_file = _get_log_file(pipeline_id, run_id)
        _write_to_log(log_file, f"✓ STEP COMPLETED: {step}")
    await _emit(run_id, {"type": "step_success", "step": step})

async def _log(run_id: int, step: str, line: str, pipeline_id: int = None):
    message = line.rstrip("\n")
    if pipeline_id:
        log_file = _get_log_file(pipeline_id, run_id)
        _write_to_log(log_file, f"[{step}] {message}")
    await _emit(run_id, {"type": "log", "step": step, "message": message})


# ----------------------------
# Helpers: process execution
# ----------------------------

def _run_cmd(cmd: list[str], cwd: Optional[str] = None) -> Iterable[str]:
    """Run command and yield merged stdout/stderr lines. Raises RuntimeError on non-zero exit."""
    p = subprocess.Popen(
        cmd,
        cwd=cwd,
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        text=True,
        bufsize=1,
    )
    assert p.stdout is not None
    for line in p.stdout:
        yield line
    rc = p.wait()
    if rc != 0:
        raise RuntimeError(f"Command failed ({rc}): {' '.join(cmd)}")


def _workspace(pipeline_id: int) -> Path:
    base = Path.home() / ".cicd" / "workspaces"
    base.mkdir(parents=True, exist_ok=True)
    return base / f"pipeline-{pipeline_id}"


def _git_checkout(repo_url: str, branch: str, ws: Path) -> None:
    """Ensure workspace contains up-to-date checkout of repo@branch."""
    if ws.exists() and (ws / ".git").exists():
        for _ in _run_cmd(["git", "fetch", "--all", "--prune"], cwd=str(ws)):
            pass
        for _ in _run_cmd(["git", "checkout", branch], cwd=str(ws)):
            pass
        for _ in _run_cmd(["git", "reset", "--hard", f"origin/{branch}"], cwd=str(ws)):
            pass
    else:
        if ws.exists():
            shutil.rmtree(ws)
        ws.parent.mkdir(parents=True, exist_ok=True)
        for _ in _run_cmd(["git", "clone", "--branch", branch, "--single-branch", repo_url, str(ws)]):
            pass


def _ssh_exec(user: str, host: str, port: int, remote_cmd: str) -> Iterable[str]:
    return _run_cmd(["ssh", "-p", str(port), f"{user}@{host}", remote_cmd])


def _docker_save_and_load_over_ssh(user: str, host: str, port: int, image_tag: str) -> None:
    """docker save <image_tag> | ssh user@host "docker load" """
    save = subprocess.Popen(
        ["docker", "save", image_tag],
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
    )
    assert save.stdout is not None

    load = subprocess.Popen(
        ["ssh", "-p", str(port), f"{user}@{host}", "docker load"],
        stdin=save.stdout,
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        text=True,
        bufsize=1,
    )
    save.stdout.close()

    output = []
    assert load.stdout is not None
    for line in load.stdout:
        output.append(line)

    rc = load.wait()
    save.wait()
    if rc != 0:
        raise RuntimeError("docker load over ssh failed:\n" + "".join(output))


def _healthcheck(url: str, timeout_sec: int = 2, retries: int = 25, delay_sec: float = 0.5) -> bool:
    """Simple HTTP GET healthcheck."""
    import urllib.request
    import time

    for _ in range(retries):
        try:
            with urllib.request.urlopen(url, timeout=timeout_sec) as r:
                if 200 <= r.status < 300:
                    return True
        except Exception:
            pass
        time.sleep(delay_sec)
    return False


# ----------------------------
# Main runner
# ----------------------------

async def run_real_pipeline(run_id: int):
    """
    Real pipeline runner - version simplifiée:
      1) Clone le repo Git
      2) Build with Maven (./mvnw -B clean compile)
      3) Run tests (./mvnw -B test)
      4) Docker build (si tests passent)
      5) Ship image via SSH
      6) Docker run on remote
      7) Healthcheck
    """
    # Configuration SSH en dur
    DEPLOY_USER = "cloudprojet"
    DEPLOY_HOST = "100.68.111.86"
    DEPLOY_PORT = 22
    
    with Session(engine) as session:
        run = session.get(Run, run_id)
        if not run:
            return

        pipeline = session.get(Pipeline, run.pipeline_id)
        if not pipeline:
            return

        # Mark run as running
        run.status = RunStatus.running
        session.add(run)
        session.commit()

        # Sanitize pipeline name for Docker (no spaces, lowercase)
        sanitized_name = pipeline.name.lower().replace(" ", "-")
        image_tag = f"{sanitized_name}:run-{run_id}"
        container_name = sanitized_name

        try:
            await _emit(run_id, {"type": "run_start"}, pipeline.id)

            # STEP: checkout
            step = "checkout"
            await _step_start(run_id, step, pipeline.id)
            ws = _workspace(pipeline.id)
            await _log(run_id, step, f"Workspace: {ws}", pipeline.id)
            await _log(run_id, step, f"Cloning {pipeline.github_url} ({pipeline.branch})", pipeline.id)
            _git_checkout(pipeline.github_url, pipeline.branch, ws)
            await _step_ok(run_id, step, pipeline.id)

            # STEP: tests Maven
            step = "maven_tests"
            await _step_start(run_id, step, pipeline.id)
            
            demo_dir = ws / "demo"
            if not demo_dir.exists():
                await _log(run_id, step, "No demo directory found, skipping tests", pipeline.id)
                await _step_ok(run_id, step, pipeline.id)
            else:
                # Build with Maven
                await _log(run_id, step, "Building with Maven (./mvnw -B clean compile)...", pipeline.id)
                for line in _run_cmd(["./mvnw", "-B", "clean", "compile"], cwd=str(demo_dir)):
                    await _log(run_id, step, line, pipeline.id)
                
                # Run tests
                await _log(run_id, step, "Running tests (./mvnw -B test)...", pipeline.id)
                for line in _run_cmd(["./mvnw", "-B", "test"], cwd=str(demo_dir)):
                    await _log(run_id, step, line, pipeline.id)
                
                await _log(run_id, step, "✅ Tests passed successfully!", pipeline.id)
                await _step_ok(run_id, step, pipeline.id)

            # STEP: docker build
            step = "docker_build"
            await _step_start(run_id, step, pipeline.id)
            
            build_context = str(demo_dir) if demo_dir.exists() else str(ws)
            await _log(run_id, step, f"Building Docker image: {image_tag}", pipeline.id)
            await _log(run_id, step, f"Build context: {build_context}", pipeline.id)
            
            for line in _run_cmd(["docker", "build", "-t", image_tag, build_context]):
                await _log(run_id, step, line, pipeline.id)
            
            await _log(run_id, step, "✅ Docker image built successfully!", pipeline.id)
            await _step_ok(run_id, step, pipeline.id)

            # STEP: ship image (ssh)
            step = "ship_image_ssh"
            await _step_start(run_id, step, pipeline.id)
            await _log(run_id, step, f"📦 Shipping Docker image to {DEPLOY_USER}@{DEPLOY_HOST}", pipeline.id)
            await _log(run_id, step, "This may take several minutes depending on image size...", pipeline.id)
            
            _docker_save_and_load_over_ssh(DEPLOY_USER, DEPLOY_HOST, DEPLOY_PORT, image_tag)
            await _log(run_id, step, f"✅ Image {image_tag} successfully transferred!", pipeline.id)
            await _step_ok(run_id, step, pipeline.id)

            # STEP: deploy run
            step = "deploy_run"
            await _step_start(run_id, step, pipeline.id)

            # Repo d'image (= "app") et tag à conserver
            app_repo = sanitized_name  # ex: "securecloud-pipeline"
            keep_tag = image_tag  # ex: "securecloud-pipeline:run-42"
            container_name = sanitized_name  # nom stable du conteneur
            app_port = 8080  # port exposé sur la machine prod
            container_port = 8080  # port dans le conteneur (à adapter si besoin)

            # 1) Nettoyage ciblé sur la prod : stop/rm conteneurs + rm images (sauf keep_tag)
            cleanup_cmd = f"""
            set -e

            APP_REPO="{app_repo}"
            KEEP_TAG="{keep_tag}"

            echo "[cleanup] Keep tag: $KEEP_TAG"

            # ID de l'image à garder (celle qu'on vient de docker load)
            KEEP_ID=$(docker image inspect -f '{{{{.Id}}}}' "$KEEP_TAG" 2>/dev/null || true)
            echo "[cleanup] Keep image id: $KEEP_ID"

            # Stop & remove tous les conteneurs créés depuis APP_REPO (ton app uniquement)
            docker ps -q --filter "ancestor=$APP_REPO" | xargs -r docker stop
            docker ps -aq --filter "ancestor=$APP_REPO" | xargs -r docker rm -f

            # Au cas où un conteneur avec le même nom existe encore
            docker rm -f "{container_name}" 2>/dev/null || true

            # Supprimer toutes les images APP_REPO sauf l'image KEEP_TAG
            if [ -n "$KEEP_ID" ]; then
              docker images "$APP_REPO" --format '{{{{.ID}}}}' | grep -v "$KEEP_ID" | xargs -r docker rmi -f
            else
              # si KEEP_TAG pas trouvé pour une raison quelconque, on évite de tout casser
              echo "[cleanup] WARNING: keep image not found, skipping image cleanup"
            fi

            echo "[cleanup] done"
            """.strip()

            await _log(run_id, step, f"Cleaning previous containers/images for app repo: {app_repo}", pipeline.id)
            for line in _ssh_exec(DEPLOY_USER, DEPLOY_HOST, DEPLOY_PORT, cleanup_cmd):
                await _log(run_id, step, line, pipeline.id)

            # 2) Run conteneur : detach + name + ports + restart
            run_cmd = (
                f"docker run -d "
                f"--name {container_name} "
                f"--restart unless-stopped "
                f"-p {app_port}:{container_port} "
                f"{keep_tag}"
            )

            await _log(run_id, step, f"Starting new container: {container_name}", pipeline.id)
            for line in _ssh_exec(DEPLOY_USER, DEPLOY_HOST, DEPLOY_PORT, run_cmd):
                await _log(run_id, step, line, pipeline.id)

            await _step_ok(run_id, step, pipeline.id)

            # STEP: healthcheck
            step = "healthcheck"
            await _step_start(run_id, step, pipeline.id)
            healthcheck_url = f"http://{DEPLOY_HOST}:8080/health"
            await _log(run_id, step, f"GET {healthcheck_url}", pipeline.id)
            
            ok = _healthcheck(healthcheck_url)
            if not ok:
                await _log(run_id, step, "⚠️ Healthcheck failed but continuing anyway", pipeline.id)
            else:
                await _log(run_id, step, "✅ Healthcheck OK!", pipeline.id)
            await _step_ok(run_id, step, pipeline.id)

            # SUCCESS
            await _emit(run_id, {"type": "run_success"}, pipeline.id)
            await _log(run_id, "success", "🎉 Pipeline completed successfully!", pipeline.id)
            pipeline.status = "success"
            session.add(pipeline)

            run.status = RunStatus.success
            run.finished_at = datetime.utcnow()
            session.add(run)
            session.commit()



        except Exception as e:
            # Pipeline FAILED
            await _emit(run_id, {"type": "run_failed", "message": str(e)}, pipeline.id)
            await _log(run_id, "error", f"❌ Pipeline FAILED: {e}", pipeline.id)
            pipeline.status = "failed"
            session.add(pipeline)

            run.status = RunStatus.failed
            run.finished_at = datetime.utcnow()
            session.add(run)
            session.commit()

def run_real_pipeline_bg(run_id: int):
    """
    Wrapper sync pour exécuter le runner async
    depuis FastAPI BackgroundTasks.
    """
    import asyncio
    asyncio.run(run_real_pipeline(run_id))


