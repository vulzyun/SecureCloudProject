# Guide de Test des Rollbacks

Ce guide te montre comment tester la fonctionnalité de rollback que nous venons d'implémenter.

## 📋 Table des matières

1. [Tests Unitaires](#tests-unitaires)
2. [Tests Manuels](#tests-manuels)
3. [Tests d'Intégration](#tests-dintégration)
4. [Dépannage](#dépannage)

---

## Tests Unitaires

### Prérequis

```bash
cd backend
pip install pytest pytest-asyncio pytest-mock
```

### Exécuter les tests

```bash
# Tous les tests de rollback
pytest tests/test_rollback.py -v

# Tests spécifiques
pytest tests/test_rollback.py::test_save_previous_state_with_running_container -v

# Avec coverage
pytest tests/test_rollback.py --cov=app.pipelines.runner_real
```

### Résultats attendus

```
test_get_running_container_found PASSED
test_get_running_container_not_found PASSED
test_get_running_container_exception PASSED
test_get_container_image_found PASSED
test_save_previous_state_with_running_container PASSED
test_save_previous_state_no_container PASSED
test_rollback_success PASSED
test_rollback_no_previous_version PASSED
test_rollback_ssh_error_handling PASSED
```

---

## Tests Manuels

### Scénario 1: Première déploiement (sans rollback)

**Objectif:** Vérifier que le premier déploiement fonctionne sans rollback.

1. **Démarrer le backend:**
   ```bash
   cd backend
   python -m uvicorn app.main:app --reload --port 8000
   ```

2. **Créer un pipeline:**
   ```bash
   curl -X POST http://localhost:8000/api/pipelines \
     -H "Content-Type: application/json" \
     -H "Authorization: Bearer YOUR_TOKEN" \
     -d '{
       "name": "test-rollback",
       "repo_url": "https://github.com/YOUR_REPO.git",
       "branch": "main"
     }'
   ```

3. **Exécuter le pipeline:**
   ```bash
   curl -X POST http://localhost:8000/api/pipelines/1/run \
     -H "Authorization: Bearer YOUR_TOKEN"
   ```

4. **Vérifier les logs:**
   ```bash
   # Linux/Mac
   tail -f ~/.cicd/workspaces/test-rollback/logs/test-rollback.log
   
   # Windows PowerShell
   Get-Content $env:USERPROFILE\.cicd\workspaces\test-rollback\logs\test-rollback.log -Wait
   ```

   **Attendu:**
   ```
   >>> STEP: checkout
   >>> STEP: maven_tests
   >>> STEP: docker_build
   >>> STEP: cleanup_old_deploy
   >>> STEP: ship_image_ssh
   >>> STEP: deploy_run
   >>> STEP: healthcheck
   ✓ STEP COMPLETED: healthcheck
   🎉 Pipeline completed successfully!
   ```

---

### Scénario 2: Failure de healthcheck → Rollback

**Objectif:** Vérifier que le rollback se déclenche quand la healthcheck échoue.

1. **Déployer une première version réussie** (voir Scénario 1)

2. **Modifier le repo pour créer une image "cassée":**
   ```dockerfile
   # Ajoute ceci au Dockerfile du projet
   FROM python:3.11-slim
   WORKDIR /app
   
   # Copie l'app mais sans serveur HTTP
   COPY . .
   
   # Lance quelque chose qui n'expose pas le port 8080
   CMD ["echo", "App started but no HTTP server"]
   ```

3. **Commit et push:**
   ```bash
   git add Dockerfile
   git commit -m "test: intentionally broken app for rollback test"
   git push origin main
   ```

4. **Exécuter le pipeline une deuxième fois:**
   ```bash
   curl -X POST http://localhost:8000/api/pipelines/1/run \
     -H "Authorization: Bearer YOUR_TOKEN"
   ```

5. **Vérifier les logs:**
   ```bash
   tail -f ~/.cicd/workspaces/test-rollback/logs/test-rollback.log
   ```

   **Attendu:**
   ```
   >>> STEP: deploy_run
   [deploy_run] Starting new container: test-rollback
   ✓ STEP COMPLETED: deploy_run
   
   >>> STEP: healthcheck
   [healthcheck] GET http://100.68.111.86:8080/health
   ❌ Healthcheck FAILED - triggering rollback
   
   >>> STEP: rollback
   [rollback] Stopping failed container: test-rollback
   [rollback] Restarting previous container: <container-id>
   ✓ STEP COMPLETED: rollback
   
   ⚠️ Healthcheck failed - Previous version restored
   ```

6. **Vérifier que l'ancienne version répond:**
   ```bash
   curl http://100.68.111.86:8080/health
   # Devrait retourner {"status": "ok"} ou similaire
   ```

---

### Scénario 3: Erreur durant le build → Rollback

**Objectif:** Vérifier que le rollback fonctionne aussi en cas d'erreur durant le build.

1. **Modifier le repo pour un Maven build échoue:**
   ```bash
   # Ajoute une erreur de syntaxe dans le pom.xml
   echo "BROKEN_XML" >> pom.xml
   git add pom.xml
   git commit -m "test: broken pom.xml for rollback test"
   git push origin main
   ```

2. **Exécuter le pipeline:**
   ```bash
   curl -X POST http://localhost:8000/api/pipelines/1/run \
     -H "Authorization: Bearer YOUR_TOKEN"
   ```

3. **Vérifier les logs:**
   ```bash
   tail -f ~/.cicd/workspaces/test-rollback/logs/test-rollback.log
   ```

   **Attendu:**
   ```
   >>> STEP: maven_tests
   [maven_tests] Building with Maven (./mvnw -B clean compile)...
   ERROR
   
   ❌ Pipeline FAILED: Command failed (1): ['./mvnw', '-B', 'clean', 'compile']
   ⚠️ Attempting rollback to previous version...
   
   >>> STEP: rollback
   [rollback] Stopping failed container: test-rollback
   [rollback] Restarting previous container: <container-id>
   ✓ STEP COMPLETED: rollback
   
   ⚠️ Rollback completed! Previous version restored.
   ```

---

## Tests d'Intégration

### Afficher les événements SSE en temps réel

Pour voir les événements du pipeline en temps réel:

```bash
# Terminal 1: Afficher le stream SSE
curl -N http://localhost:8000/api/runs/1/stream

# Terminal 2: Exécuter le pipeline
curl -X POST http://localhost:8000/api/pipelines/1/run \
  -H "Authorization: Bearer YOUR_TOKEN"
```

**Attendu pour un rollback:**
```
event: log
data: {"type":"log","step":"healthcheck","message":"GET http://100.68.111.86:8080/health"}

event: log  
data: {"type":"log","step":"healthcheck","message":"❌ Healthcheck FAILED - triggering rollback"}

event: log
data: {"type":"log","step":"rollback","message":"Stopping failed container: test-rollback"}

event: log
data: {"type":"log","step":"rollback","message":"Restarting previous container: abc123"}

event: run_failed
data: {"type":"run_failed","message":"Healthcheck failed - rolled back to previous version"}
```

---

### Vérifier la base de données

```bash
# Ouvre une session SQLite avec le backend
python -c "
from app.db import engine
from app.models import Run, RunStatus
from sqlmodel import Session, select

with Session(engine) as session:
    runs = session.exec(select(Run)).all()
    for run in runs:
        print(f'Run {run.id}: {run.status} (finished at {run.finished_at})')
"
```

---

## Dépannage

### Problème: SSH ne fonctionne pas

**Symptôme:** Erreur SSH lors du cleanup ou deploy
```
RuntimeError: Connection refused / Permission denied
```

**Solution:**
1. Vérifie les credentials SSH dans `runner_real.py`:
   ```python
   DEPLOY_USER = "cloudprojet"
   DEPLOY_HOST = "100.68.111.86"
   DEPLOY_PORT = 22
   ```

2. Teste la connexion SSH:
   ```bash
   ssh -p 22 cloudprojet@100.68.111.86 "docker ps"
   ```

3. Ajoute ta clé SSH à l'agent:
   ```bash
   ssh-add ~/.ssh/id_rsa
   ```

---

### Problème: Healthcheck échoue mais rollback ne se déclenche pas

**Symptôme:** Logs affichent "Healthcheck FAILED" mais pas de rollback

**Vérification:**
1. Y a-t-il une version précédente?
   ```bash
   docker ps -a | grep test-rollback
   ```
   
   Si aucun container ancien, le rollback ne peut pas se faire:
   ```
   No previous container found, cannot rollback
   ```

2. Vérifiez les logs SSH:
   ```bash
   ssh -p 22 cloudprojet@100.68.111.86 "docker ps -a"
   ```

---

### Problème: Container ne redémarre pas après rollback

**Symptôme:** Rollback s'exécute mais l'app ne répond toujours pas

**Vérification:**
1. Le container old est-il stoppé ou supprimé?
   ```bash
   docker ps -a | grep test-rollback
   ```

2. Redémarre manuellement:
   ```bash
   docker start <old-container-id>
   docker logs <old-container-id>
   ```

---

### Problème: Impossible de sauvegarder l'état

**Symptôme:** "No previous container found" lors du premier deploy

**Comportement normal!** C'est attendu la première fois. Le rollback s'activera lors du **2e déploiement**.

---

## Checklist de Validation

- [ ] Premiers tests unitaires passent (`pytest tests/test_rollback.py`)
- [ ] Première déploiement réussit sans erreur
- [ ] État est sauvegardé correctement
- [ ] Deuxième déploiement avec healthcheck failure → Rollback ✅
- [ ] Logs affichent les étapes de rollback
- [ ] L'ancienne version répond après rollback
- [ ] Database marque le run comme `failed`
- [ ] SSE stream affiche tous les événements

---

## Notes Importantes

1. **État sauvegardé AVANT le pipeline** - C'est crucial pour pouvoir rollback à une version saine
2. **Rollback automatique sur 2 conditions:**
   - Healthcheck échoue
   - Exception durant le pipeline
3. **Si pas de version précédente** - Le pipeline simplement fail, pas de rollback possible
4. **Rollback ne supprime pas l'image** - La nouvelle image cassée reste dans Docker pour debug

---

## Prochaines Étapes

Pour aller plus loin:

- [ ] Implémenter Blue/Green deployment
- [ ] Ajouter un webhook pour notifications
- [ ] Créer un historique complet des déploiements
- [ ] Tester avec plusieurs versions en cascade

