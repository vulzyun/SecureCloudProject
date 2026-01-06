from fastapi.testclient import TestClient
from app.main import app

def h(email: str, user: str | None = None):
    headers = {"X-Auth-Request-Email": email}
    if user:
        headers["X-Auth-Request-User"] = user
    return headers

def test_bootstrap_admin_can_create_pipeline():
    c = TestClient(app)

    # admin@example.com doit matcher BOOTSTRAP_ADMIN_EMAIL dans .env.example
    r = c.post(
        "/api/pipelines",
        json={"name": "p1", "repo_url": "https://example.com/repo.git", "branch": "main"},
        headers=h("admin@example.com", "admin"),
    )
    assert r.status_code == 200
    assert r.json()["name"] == "p1"

def test_viewer_cannot_create_or_run_pipeline():
    c = TestClient(app)

    # viewer calls create -> forbidden
    r = c.post(
        "/api/pipelines",
        json={"name": "pX", "repo_url": "https://example.com/x.git"},
        headers=h("viewer@example.com", "viewer"),
    )
    assert r.status_code == 403

    # create pipeline as admin, then viewer tries run -> forbidden
    r = c.post(
        "/api/pipelines",
        json={"name": "p2", "repo_url": "https://example.com/repo2.git"},
        headers=h("admin@example.com", "admin"),
    )
    pid = r.json()["id"]

    r = c.post(f"/api/pipelines/{pid}/run", headers=h("viewer@example.com", "viewer"))
    assert r.status_code == 403
