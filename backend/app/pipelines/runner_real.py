import asyncio
import os
import shutil
import subprocess
from datetime import datetime
from pathlib import Path
from typing import Iterable, Optional

from sqlmodel import Session

from ..config import settings
from ..db import engine
from ..models import Pipeline, Run, RunStatus
from .events import bus


# ----------------------------
# Helpers: SSE events & logging
# ----------------------------

# Global dict to store log file paths for each run
_log_files = {}

def _sanitize_name(name: str) -> str:
    """Sanitize pipeline name for use in file paths and Docker."""
    return name.lower().replace(" ", "-").replace("_", "-")

def _get_log_file(pipeline_name: str, run_id: int) -> Path:
    """Get or create log file path for a run."""
    if run_id not in _log_files:
        sanitized_name = _sanitize_name(pipeline_name)
        log_dir = Path.home() / ".cicd" / "workspaces" / sanitized_name / "logs"
        log_dir.mkdir(parents=True, exist_ok=True)
        # Utiliser le nom du pipeline comme nom de fichier
        log_file = log_dir / f"{sanitized_name}.log"
        _log_files[run_id] = log_file
        # Initialize log file with header (écrase le fichier précédent)
        with open(log_file, 'w') as f:
            f.write(f"=== Pipeline: {pipeline_name} | Run {run_id} | {datetime.utcnow().isoformat()} ===\n\n")
    return _log_files[run_id]

def _write_to_log(log_file: Path, message: str):
    """Write a message to the log file."""
    # Ensure parent directory exists
    log_file.parent.mkdir(parents=True, exist_ok=True)
    with open(log_file, 'a') as f:
        f.write(f"{message}\n")

async def _emit(run_id: int, evt: dict, pipeline_name: Optional[str] = None):
    """Publish event to SSE bus."""
    await bus.publish(run_id, evt)

async def _step_start(run_id: int, step: str, pipeline_name: Optional[str] = None):
    if pipeline_name:
        log_file = _get_log_file(pipeline_name, run_id)
        _write_to_log(log_file, f"\n>>> STEP: {step}")
    await _emit(run_id, {"type": "step_start", "step": step})

async def _step_ok(run_id: int, step: str, pipeline_name: Optional[str] = None):
    if pipeline_name:
        log_file = _get_log_file(pipeline_name, run_id)
        _write_to_log(log_file, f"STEP COMPLETED: {step}")
    await _emit(run_id, {"type": "step_success", "step": step})

async def _log(run_id: int, step: str, line: str, pipeline_name: Optional[str] = None):
    message = line.rstrip("\n")
    if pipeline_name:
        log_file = _get_log_file(pipeline_name, run_id)
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


def _workspace(pipeline_name: str) -> Path:
    """Get workspace path for a pipeline. Workspace is recreated on each run."""
    base = Path.home() / ".cicd" / "workspaces"
    base.mkdir(parents=True, exist_ok=True)
    sanitized_name = _sanitize_name(pipeline_name)
    return base / sanitized_name


def _git_checkout(repo_url: str, branch: str, ws: Path) -> None:
    """Ensure workspace contains up-to-date checkout of repo@branch."""
    # Supprimer complètement le workspace s'il existe (pour repartir propre à chaque run)
    if ws.exists():
        shutil.rmtree(ws)
    
    # Créer le dossier parent
    ws.parent.mkdir(parents=True, exist_ok=True)
    
    # Clone frais
    for _ in _run_cmd(["git", "clone", "--branch", branch, "--single-branch", repo_url, str(ws)]):
        pass


def _ssh_exec(user: str, host: str, port: int, remote_cmd: str) -> Iterable[str]:
    return _run_cmd(["ssh", "-p", str(port), f"{user}@{host}", remote_cmd])


def _docker_save_and_load_over_ssh(user: str, host: str, port: int, image_tag: str) -> Iterable[str]:
    """
    sudo docker save <image_tag> | ssh user@host "docker load"
    Returns output lines for real-time logging.
    Uses sudo locally for docker save, but not on remote (docker has permissions there).
    """
    # 1. Save Docker image to stdout (needs sudo locally)
    save = subprocess.Popen(
        ["sudo", "docker", "save", image_tag],
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
    )
    assert save.stdout is not None

    # 2. Load via SSH with compression and keep-alive (no sudo needed on remote)
    load = subprocess.Popen(
        [
            "ssh",
            "-p", str(port),
            "-o", "ServerAliveInterval=30",   # Keep-alive every 30s
            "-o", "ServerAliveCountMax=10",    # Max 10 retries
            "-o", "Compression=yes",           # Compress transfer
            "-o", "TCPKeepAlive=yes",          # TCP keep-alive
            f"{user}@{host}",
            "docker load"  
        ],
        stdin=save.stdout,
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        text=True,
        bufsize=1,
    )
    save.stdout.close()

    output = []
    assert load.stdout is not None
    
    # Yield lines for real-time logging
    for line in load.stdout:
        output.append(line)
        yield line.rstrip("\n")

    # Wait for both processes
    load_rc = load.wait()
    save_rc = save.wait()
    
    # Check for docker save errors
    if save_rc != 0:
        save_stderr = save.stderr.read().decode() if save.stderr else ""
        raise RuntimeError(f"docker save failed (exit code {save_rc}): {save_stderr}")
    
    # Check for docker load errors
    if load_rc != 0:
        raise RuntimeError(f"docker load over ssh failed (exit code {load_rc}):\n" + "".join(output))


def _healthcheck(url: str, timeout_sec: int = 10, retries: int = 30, delay_sec: float = 2.0) -> tuple[bool, str]:
    """
    Simple HTTP GET healthcheck.
    Returns (success, message) tuple.
    """
    import urllib.request
    import time

    last_error = ""
    for attempt in range(1, retries + 1):
        try:
            with urllib.request.urlopen(url, timeout=timeout_sec) as r:
                if 200 <= r.status < 300:
                    return True, f"Success on attempt {attempt}/{retries} (status {r.status})"
                else:
                    last_error = f"HTTP {r.status}"
        except Exception as e:
            last_error = str(e)
        
        if attempt < retries:
            time.sleep(delay_sec)
    
    return False, f"Failed after {retries} attempts. Last error: {last_error}"


# ----------------------------
# Helpers: Rollback & State Management
# ----------------------------

def _get_previous_commit_from_history(ws: Path) -> Optional[str]:
    """Get the commit hash of HEAD~1 (previous commit in git history)."""
    try:
        result = subprocess.run(
            ["git", "rev-parse", "HEAD~1"],
            cwd=str(ws),
            capture_output=True,
            text=True,
            check=True
        )
        return result.stdout.strip()
    except Exception:
        return None


async def _rollback_to_previous(
    run_id: int,
    user: str,
    host: str,
    port: int,
    container_name: str,
    ws: Path,
    previous_commit: str,
    pipeline_name: Optional[str] = None,
):
    """Rollback: checkout previous commit and REDO the entire pipeline."""
    step = "rollback_checkout"
    await _step_start(run_id, step, pipeline_name)
    
    if not previous_commit:
        await _log(run_id, step, "No previous commit available, cannot rollback", pipeline_name)
        await _step_ok(run_id, step, pipeline_name)
        return
    
    try:
        # Stop and remove the failed container
        await _log(run_id, step, f"Stopping failed container: {container_name}", pipeline_name)
        stop_cmd = f"docker ps -q --filter 'name=^{container_name}$' | xargs -r docker stop 2>/dev/null || true"
        for line in _ssh_exec(user, host, port, stop_cmd):
            pass
        
        remove_cmd = f"docker ps -aq --filter 'name=^{container_name}$' | xargs -r docker rm -f 2>/dev/null || true"
        for line in _ssh_exec(user, host, port, remove_cmd):
            pass
        
        # Checkout previous commit
        await _log(run_id, step, f"Checking out previous commit: {previous_commit}", pipeline_name)
        for line in _run_cmd(["git", "checkout", previous_commit], cwd=str(ws)):
            if line.strip() and "HEAD is now at" in line:
                await _log(run_id, step, line.strip(), pipeline_name)
        
        await _log(run_id, step, "Rollback checkout completed - now rerunning pipeline...", pipeline_name)
        await _step_ok(run_id, step, pipeline_name)
        
        # REFAIRE TOUT LE PIPELINE avec le commit précédent
        sanitized_name = _sanitize_name(pipeline_name)
        rollback_image_tag = f"{sanitized_name}:rollback-{run_id}"
        demo_dir = ws / "demo"
        
        # STEP: Maven tests (rollback)
        step = "rollback_maven_tests"
        await _step_start(run_id, step, pipeline_name)
        
        if not demo_dir.exists():
            await _log(run_id, step, "No demo directory found, skipping tests", pipeline_name)
            await _step_ok(run_id, step, pipeline_name)
        else:
            # Build
            await _log(run_id, step, "Building with Maven (./mvnw -B clean compile)...", pipeline_name)
            for line in _run_cmd(["./mvnw", "-B", "clean", "compile"], cwd=str(demo_dir)):
                await _log(run_id, step, line, pipeline_name)
            
            # Tests
            await _log(run_id, step, "Running tests (./mvnw -B test)...", pipeline_name)
            for line in _run_cmd(["./mvnw", "-B", "test"], cwd=str(demo_dir)):
                await _log(run_id, step, line, pipeline_name)
            
            await _log(run_id, step, "Tests passed!", pipeline_name)
            await _step_ok(run_id, step, pipeline_name)
        
        # STEP: SonarCloud (rollback)
        step = "rollback_sonarcloud"
        await _step_start(run_id, step, pipeline_name)
        
        if not demo_dir.exists():
            await _log(run_id, step, "No demo directory, skipping SonarCloud", pipeline_name)
            await _step_ok(run_id, step, pipeline_name)
        else:
            await _log(run_id, step, "Running SonarCloud analysis...", pipeline_name)
            
            sonar_token = settings.sonar_token
            if not sonar_token:
                await _log(run_id, step, "SONAR_TOKEN not found, skipping", pipeline_name)
                await _step_ok(run_id, step, pipeline_name)
            else:
                import os
                env = os.environ.copy()
                env['SONAR_TOKEN'] = sonar_token
                
                sonar_cmd = [
                    "./mvnw", "verify",
                    "org.sonarsource.scanner.maven:sonar-maven-plugin:sonar",
                    "-Dsonar.projectKey=vulzyun_bfbarchitecture"
                ]
                
                try:
                    p = subprocess.Popen(
                        sonar_cmd, cwd=str(demo_dir),
                        stdout=subprocess.PIPE, stderr=subprocess.STDOUT,
                        text=True, bufsize=1, env=env
                    )
                    assert p.stdout is not None
                    for line in p.stdout:
                        await _log(run_id, step, line, pipeline_name)
                    rc = p.wait()
                    
                    if rc != 0:
                        await _log(run_id, step, f"SonarCloud failed (code {rc}) - continuing rollback", pipeline_name)
                    else:
                        await _log(run_id, step, "SonarCloud completed", pipeline_name)
                except Exception as e:
                    await _log(run_id, step, f"SonarCloud error: {e} - continuing", pipeline_name)
                
                await _step_ok(run_id, step, pipeline_name)
        
        # STEP: Docker build (rollback)
        step = "rollback_docker_build"
        await _step_start(run_id, step, pipeline_name)
        
        build_context = str(demo_dir) if demo_dir.exists() else str(ws)
        await _log(run_id, step, f"Building Docker image: {rollback_image_tag}", pipeline_name)
        
        for line in _run_cmd(["sudo", "docker", "build", "-t", rollback_image_tag, build_context]):
            await _log(run_id, step, line, pipeline_name)
        
        await _log(run_id, step, "Docker image built!", pipeline_name)
        await _step_ok(run_id, step, pipeline_name)
        
        # STEP: Ship image (rollback)
        step = "rollback_ship_image"
        await _step_start(run_id, step, pipeline_name)
        
        await _log(run_id, step, f"Shipping image to {user}@{host}", pipeline_name)
        for line in _docker_save_and_load_over_ssh(user, host, port, rollback_image_tag):
            await _log(run_id, step, line, pipeline_name)
        
        await _log(run_id, step, "Image transferred!", pipeline_name)
        await _step_ok(run_id, step, pipeline_name)
        
        # STEP: Deploy (rollback)
        step = "rollback_deploy"
        await _step_start(run_id, step, pipeline_name)
        
        run_cmd = (
            f"docker run -d "
            f"--name {container_name} "
            f"--restart unless-stopped "
            f"-p 8080:8080 "
            f"{rollback_image_tag}"
        )
        
        await _log(run_id, step, f"Starting rollback container: {container_name}", pipeline_name)
        for line in _ssh_exec(user, host, port, run_cmd):
            await _log(run_id, step, line, pipeline_name)
        
        await _step_ok(run_id, step, pipeline_name)
        
    except Exception as e:
        await _log(run_id, step, f"Rollback failed: {e}", pipeline_name)


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
    DEPLOY_USER = "mohamed"
    DEPLOY_HOST = "188.166.77.14"
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
        sanitized_name = _sanitize_name(pipeline.name)
        image_tag = f"{sanitized_name}:run-{run_id}"
        container_name = sanitized_name
        
        # Initialize workspace
        ws = _workspace(pipeline.name)

        try:
            await _emit(run_id, {"type": "run_start"}, pipeline.name)

            # STEP: checkout
            step = "checkout"
            await _step_start(run_id, step, pipeline.name)
            ws = _workspace(pipeline.name)
            await _log(run_id, step, f"Workspace: {ws}", pipeline.name)
            await _log(run_id, step, f"Cloning {pipeline.github_url} ({pipeline.branch})", pipeline.name)
            _git_checkout(pipeline.github_url, pipeline.branch, ws)
            await _step_ok(run_id, step, pipeline.name)

            # STEP: tests Maven
            step = "maven_tests"
            await _step_start(run_id, step, pipeline.name)
            
            demo_dir = ws / "demo"
            if not demo_dir.exists():
                await _log(run_id, step, "No demo directory found, skipping tests", pipeline.name)
                await _step_ok(run_id, step, pipeline.name)
            else:
                # Build with Maven
                await _log(run_id, step, "Building with Maven (./mvnw -B clean compile)...", pipeline.name)
                for line in _run_cmd(["./mvnw", "-B", "clean", "compile"], cwd=str(demo_dir)):
                    await _log(run_id, step, line, pipeline.name)
                
                # Run tests
                await _log(run_id, step, "Running tests (./mvnw -B test)...", pipeline.name)
                for line in _run_cmd(["./mvnw", "-B", "test"], cwd=str(demo_dir)):
                    await _log(run_id, step, line, pipeline.name)
                
                await _log(run_id, step, "Tests passed successfully!", pipeline.name)
                await _step_ok(run_id, step, pipeline.name)

            # STEP: sonarcloud analysis
            step = "sonarcloud_analysis"
            await _step_start(run_id, step, pipeline.name)
            
            if not demo_dir.exists():
                await _log(run_id, step, "No demo directory found, skipping SonarCloud", pipeline.name)
                await _step_ok(run_id, step, pipeline.name)
            else:
                await _log(run_id, step, "Running SonarCloud analysis...", pipeline.name)
                await _log(run_id, step, "Results will be available on sonarcloud.io", pipeline.name)
                
                # Récupérer le token depuis la config
                sonar_token = settings.sonar_token
                if not sonar_token:
                    await _log(run_id, step, "ERROR: SONAR_TOKEN not found in .env file", pipeline.name)
                    raise RuntimeError("Missing SONAR_TOKEN - please add it to backend/.env")
                
                # Préparer l'environnement avec le token
                env = os.environ.copy()
                env['SONAR_TOKEN'] = sonar_token
                
                # Commande SonarCloud exacte
                sonar_cmd = [
                    "./mvnw",
                    "verify",
                    "org.sonarsource.scanner.maven:sonar-maven-plugin:sonar",
                    "-Dsonar.projectKey=vulzyun_bfbarchitecture"
                ]
                
                try:
                    await _log(run_id, step, f"Command: {' '.join(sonar_cmd)}", pipeline.name)
                    
                    # Exécuter avec le token dans l'environnement
                    p = subprocess.Popen(
                        sonar_cmd,
                        cwd=str(demo_dir),
                        stdout=subprocess.PIPE,
                        stderr=subprocess.STDOUT,
                        text=True,
                        bufsize=1,
                        env=env
                    )
                    assert p.stdout is not None
                    for line in p.stdout:
                        await _log(run_id, step, line, pipeline.name)
                    rc = p.wait()
                    
                    if rc != 0:
                        await _log(run_id, step, f"SonarCloud analysis failed with exit code {rc}", pipeline.name)
                        raise RuntimeError(f"SonarCloud analysis failed ({rc})")
                    
                    await _log(run_id, step, "SonarCloud analysis completed successfully!", pipeline.name)
                    await _log(run_id, step, "View results: https://sonarcloud.io/project/overview?id=vulzyun_bfbarchitecture", pipeline.name)
                    
                except Exception as e:
                    await _log(run_id, step, f"SonarCloud analysis error: {e}", pipeline.name)
                    raise
                
                await _step_ok(run_id, step, pipeline.name)

            # STEP: docker build
            step = "docker_build"
            await _step_start(run_id, step, pipeline.name)
            
            build_context = str(demo_dir) if demo_dir.exists() else str(ws)
            await _log(run_id, step, f"Building Docker image: {image_tag}", pipeline.name)
            await _log(run_id, step, f"Build context: {build_context}", pipeline.name)
            
            for line in _run_cmd(["sudo", "docker", "build", "-t", image_tag, build_context]):
                await _log(run_id, step, line, pipeline.name)
            
            await _log(run_id, step, "Docker image built successfully!", pipeline.name)
            await _step_ok(run_id, step, pipeline.name)

            # STEP: cleanup (AVANT d'envoyer la nouvelle image)
            step = "cleanup_old_deploy"
            await _step_start(run_id, step, pipeline.name)

            container_name = sanitized_name
            app_repo = sanitized_name

            # Nettoyer TOUT : TOUS les conteneurs + images de cette app
            cleanup_cmd = f"""
            set -e

            APP_REPO="{app_repo}"
            CONTAINER_NAME="{container_name}"

            echo "[cleanup] Stopping ALL running containers..."
            
            # 1. Arrêter TOUS les conteneurs en cours d'exécution (pas seulement ceux de l'app)
            RUNNING_CONTAINERS=$(docker ps -q)
            if [ -n "$RUNNING_CONTAINERS" ]; then
                echo "[cleanup] Found running containers, stopping them..."
                docker stop $RUNNING_CONTAINERS 2>/dev/null || true
                docker rm -f $RUNNING_CONTAINERS 2>/dev/null || true
                echo "[cleanup] All running containers stopped"
            else
                echo "[cleanup] No running containers found"
            fi

            # 2. Nettoyer aussi les conteneurs arrêtés de notre app
            echo "[cleanup] Removing stopped containers for: $CONTAINER_NAME"
            docker ps -aq --filter "name=$CONTAINER_NAME" | xargs -r docker rm -f 2>/dev/null || true

            # 3. Supprimer TOUTES les images de cette app
            echo "[cleanup] Removing all images for: $APP_REPO"
            docker images "$APP_REPO" --format '{{.ID}}' | xargs -r docker rmi -f 2>/dev/null || true

            echo "[cleanup] Done - all containers stopped, ready for fresh deploy"
            """.strip()

            await _log(run_id, step, f"Stopping ALL containers and cleaning images for: {app_repo}", pipeline.name)
            for line in _ssh_exec(DEPLOY_USER, DEPLOY_HOST, DEPLOY_PORT, cleanup_cmd):
                await _log(run_id, step, line, pipeline.name)
            await _step_ok(run_id, step, pipeline.name)

            # STEP: ship image (ssh)
            step = "ship_image_ssh"
            await _step_start(run_id, step, pipeline.name)
            await _log(run_id, step, f"Shipping Docker image to {DEPLOY_USER}@{DEPLOY_HOST}", pipeline.name)
            await _log(run_id, step, "This may take several minutes depending on image size...", pipeline.name)
            
            for line in _docker_save_and_load_over_ssh(DEPLOY_USER, DEPLOY_HOST, DEPLOY_PORT, image_tag):
                await _log(run_id, step, line, pipeline.name)
            
            await _log(run_id, step, f"Image {image_tag} successfully transferred!", pipeline.name)
            await _step_ok(run_id, step, pipeline.name)

            # STEP: deploy run
            step = "deploy_run"
            await _step_start(run_id, step, pipeline.name)

            # Lancer le nouveau conteneur
            run_cmd = (
                f"docker run -d "
                f"--name {container_name} "
                f"--restart unless-stopped "
                f"-p 8080:8080 "
                f"{image_tag}"
            )

            await _log(run_id, step, f"Starting new container: {container_name}", pipeline.name)
            for line in _ssh_exec(DEPLOY_USER, DEPLOY_HOST, DEPLOY_PORT, run_cmd):
                await _log(run_id, step, line, pipeline.name)

            await _step_ok(run_id, step, pipeline.name)

            # STEP: healthcheck
            step = "healthcheck"
            await _step_start(run_id, step, pipeline.name)
            healthcheck_url = f"http://{DEPLOY_HOST}:8080/swagger-ui/index.html"
            await _log(run_id, step, f"GET {healthcheck_url}", pipeline.name)
            await _log(run_id, step, "Waiting for container to be ready (timeout: 10s, retries: 30, delay: 2s)...", pipeline.name)
            
            ok, message = _healthcheck(healthcheck_url)
            if not ok:
                await _log(run_id, step, f"Healthcheck FAILED: {message}", pipeline.name)
                await _log(run_id, step, "Triggering rollback...", pipeline.name)
                await _step_ok(run_id, step, pipeline.name)
                
                # Get previous commit from git history (HEAD~1) for rollback
                previous_commit = _get_previous_commit_from_history(ws)
                if previous_commit:
                    await _log(run_id, step, f"Rolling back to HEAD~1: {previous_commit}", pipeline.name)
                
                if previous_commit:
                    await _rollback_to_previous(run_id, DEPLOY_USER, DEPLOY_HOST, DEPLOY_PORT, sanitized_name, ws, previous_commit, pipeline.name)
                    
                    # Healthcheck after rollback (rollback function already deployed everything)
                    step = "healthcheck_rollback"
                    await _step_start(run_id, step, pipeline.name)
                    healthcheck_url = f"http://{DEPLOY_HOST}:8080/swagger-ui/index.html"
                    await _log(run_id, step, f"GET {healthcheck_url}", pipeline.name)
                    await _log(run_id, step, "Checking if rolled-back version is healthy...", pipeline.name)
                    
                    ok_rollback, message_rollback = _healthcheck(healthcheck_url)
                    if ok_rollback:
                        await _log(run_id, step, f"Rollback healthcheck OK! {message_rollback}", pipeline.name)
                        await _step_ok(run_id, step, pipeline.name)
                        await _emit(run_id, {"type": "run_success"}, pipeline.name)
                        await _log(run_id, "success", "Rollback successful - Previous version is healthy!", pipeline.name)
                        pipeline.status = "success"
                        run.status = RunStatus.success
                    else:
                        await _log(run_id, step, f"Rollback healthcheck FAILED: {message_rollback}", pipeline.name)
                        await _step_ok(run_id, step, pipeline.name)
                        await _emit(run_id, {"type": "run_failed", "message": "Rollback deployed but healthcheck failed"}, pipeline.name)
                        await _log(run_id, "error", "Rollback deployed but previous version failed healthcheck", pipeline.name)
                        pipeline.status = "failed"
                        run.status = RunStatus.failed
                else:
                    await _emit(run_id, {"type": "run_failed", "message": "Healthcheck failed - no previous commit in git history"}, pipeline.name)
                    await _log(run_id, "error", "Healthcheck failed and no previous commit available (first commit?)", pipeline.name)
                    pipeline.status = "failed"
                    run.status = RunStatus.failed
                
                session.add(pipeline)
                run.finished_at = datetime.utcnow()
                session.add(run)
                session.commit()
                return
            else:
                await _log(run_id, step, f"Healthcheck OK! {message}", pipeline.name)
            await _step_ok(run_id, step, pipeline.name)

            # SUCCESS
            await _emit(run_id, {"type": "run_success"}, pipeline.name)
            await _log(run_id, "success", "Pipeline completed successfully!", pipeline.name)
            pipeline.status = "success"
            session.add(pipeline)

            run.status = RunStatus.success
            run.finished_at = datetime.utcnow()
            session.add(run)
            session.commit()



        except Exception as e:
            # Pipeline FAILED - attempt rollback
            await _emit(run_id, {"type": "run_failed", "message": str(e)}, pipeline.name)
            await _log(run_id, "error", f"Pipeline FAILED: {e}", pipeline.name)
            
            # Get previous commit from git history (HEAD~1) and attempt rollback
            previous_commit = _get_previous_commit_from_history(ws)
            
            if previous_commit:
                await _log(run_id, "error", f"Attempting rollback to previous commit from git history: {previous_commit}", pipeline.name)
                await _rollback_to_previous(run_id, DEPLOY_USER, DEPLOY_HOST, DEPLOY_PORT, sanitized_name, ws, previous_commit, pipeline.name)
            else:
                await _log(run_id, "error", "No previous commit in git history (first commit?)", pipeline.name)
            
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

